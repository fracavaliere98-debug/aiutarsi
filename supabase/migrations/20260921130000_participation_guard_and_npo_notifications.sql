-- 1) Blocco lato DB: nessuna iscrizione (nuova o riattivata) a un'attività CANCELLATA.
--    Prima il blocco esisteva solo nella UI: chiamando direttamente l'API un volontario
--    poteva iscriversi a un'attività annullata.
--    BEFORE INSERT scatta anche sul percorso upsert (merge-duplicates) usato da joinActivity,
--    quindi copre sia la nuova iscrizione sia il "re-join" idempotente.
--    Le UPDATE che non cambiano status (es. telefono/messaggio) non sono toccate.
create or replace function public.block_join_cancelled_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if new.status in ('REGISTERED', 'APPROVED')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select a.status into v_status from public.activities a where a.id = new.activity_id;
    if v_status = 'CANCELLATA' then
      raise exception 'ACTIVITY_CANCELLED'
        using hint = 'Non ci si può iscrivere a un''attività annullata.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_join_cancelled_activity on public.activity_participants;
create trigger trg_block_join_cancelled_activity
  before insert or update of status on public.activity_participants
  for each row execute function public.block_join_cancelled_activity();

-- 2) Notifica all'ente quando un volontario si iscrive / si ritira da una sua attività.
--    - Solo azioni fatte dal volontario stesso (auth.uid() = user_id): le scritture di
--      sistema/service role (cascade da cancellazione account, azioni dell'ente) non notificano.
--      auth.uid() riflette il chiamante originale anche dentro SECURITY DEFINER.
--    - Solo per attività APERTA/IN_CORSO (nessun rumore su completate/annullate).
--    - Dedup: stesso volontario + stessa attività + stesso tipo entro 10 minuti → una sola notifica
--      (evita spam se il volontario si iscrive e si ritira ripetutamente).
--    - Tipi: VOLUNTEER_ENROLLED (già previsto dal client) e VOLUNTEER_WITHDRAWN (nuovo).
create or replace function public.notify_npo_on_participation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.activity_participants;
  v_type text;
  v_activity record;
  v_name text;
begin
  if tg_op = 'INSERT' then
    v_row := new;
    v_type := 'VOLUNTEER_ENROLLED';
  else
    v_row := old;
    v_type := 'VOLUNTEER_WITHDRAWN';
  end if;

  if v_row.status not in ('REGISTERED', 'APPROVED') then
    return coalesce(new, old);
  end if;

  if auth.uid() is distinct from v_row.user_id then
    return coalesce(new, old);
  end if;

  select a.id, a.title, a.npo_id, a.status
    into v_activity
    from public.activities a
   where a.id = v_row.activity_id;

  if not found or v_activity.npo_id is null or v_activity.status not in ('APERTA', 'IN_CORSO') then
    return coalesce(new, old);
  end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Un volontario')
    into v_name
    from public.profiles p
   where p.id = v_row.user_id;

  if not found then
    return coalesce(new, old);
  end if;

  if exists (
    select 1
      from public.notifications n
     where n.user_id = v_activity.npo_id
       and n.type = v_type
       and n.related_activity_id = v_activity.id
       and n.payload ->> 'volunteerId' = v_row.user_id::text
       and n.created_at > now() - interval '10 minutes'
  ) then
    return coalesce(new, old);
  end if;

  insert into public.notifications (user_id, type, title, message, related_activity_id, read, payload)
  values (
    v_activity.npo_id,
    v_type,
    case when v_type = 'VOLUNTEER_ENROLLED' then 'Nuova iscrizione' else 'Iscrizione ritirata' end,
    case when v_type = 'VOLUNTEER_ENROLLED'
         then v_name || ' si è iscritto a "' || coalesce(v_activity.title, 'Attività') || '"'
         else v_name || ' si è ritirato da "' || coalesce(v_activity.title, 'Attività') || '"'
    end,
    v_activity.id,
    false,
    jsonb_build_object('volunteerId', v_row.user_id::text)
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_notify_npo_on_participation_change on public.activity_participants;
create trigger trg_notify_npo_on_participation_change
  after insert or delete on public.activity_participants
  for each row execute function public.notify_npo_on_participation_change();

-- Le funzioni trigger non devono essere invocabili direttamente via RPC.
revoke all on function public.block_join_cancelled_activity() from public, anon, authenticated;
revoke all on function public.notify_npo_on_participation_change() from public, anon, authenticated;

-- Rollback:
--   drop trigger trg_notify_npo_on_participation_change on public.activity_participants;
--   drop trigger trg_block_join_cancelled_activity on public.activity_participants;
--   drop function public.notify_npo_on_participation_change();
--   drop function public.block_join_cancelled_activity();
