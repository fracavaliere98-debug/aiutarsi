-- Bug: app/admin/verification/[id].tsx aggiorna is_verified/verification_status su profiles
-- con una PATCH diretta usando la sessione dell'admin. La RLS UPDATE su profiles permette
-- solo "id = auth.uid()", e l'admin sta scrivendo sulla riga di un ALTRO utente (la NPO da
-- verificare): la query non tocca nessuna riga, nessun errore visibile, ma il bollino non si
-- aggiorna mai. verification_requests.status passa correttamente ad 'approved'/'rejected'
-- (quella riga sì appartiene implicitamente al flusso admin via RLS separata), la notifica
-- parte comunque (passo indipendente): da qui la sensazione di "approvato ma non successo nulla".
--
-- Fix: una RPC SECURITY DEFINER che verifica esplicitamente che il chiamante sia un ADMIN
-- prima di scrivere su una riga profiles altrui.
create or replace function public.admin_set_npo_verification(
  p_user_id uuid,
  p_is_verified boolean,
  p_verification_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'ADMIN'
  ) then
    raise exception 'not authorized';
  end if;

  if p_verification_status not in ('none', 'pending', 'verified', 'rejected') then
    raise exception 'invalid verification_status: %', p_verification_status;
  end if;

  -- Autorizza il trigger protect_privileged_profile_fields_trigger (2026-07-21) a lasciar
  -- passare la scrittura su is_verified/verification_status per QUESTA transazione: quel
  -- trigger blocca di default chiunque non sia service_role, ed è corretto farlo anche per
  -- gli admin autenticati normalmente — solo questa RPC, dopo aver verificato il ruolo sopra,
  -- ha il permesso di attraversarlo.
  perform set_config('app.bypass_profile_guard', 'true', true);

  update public.profiles
  set is_verified = p_is_verified,
      verification_status = p_verification_status,
      updated_at = now()
  where id = p_user_id;
end;
$$;

revoke all on function public.admin_set_npo_verification(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_npo_verification(uuid, boolean, text) to authenticated;

-- Il trigger deve riconoscere il bypass impostato sopra, altrimenti annullerebbe comunque
-- la scrittura (auth.role() per un admin normale è 'authenticated', non 'service_role').
create or replace function public.protect_privileged_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role'
     and coalesce(current_setting('app.bypass_profile_guard', true), 'false') is distinct from 'true' then
    new.is_verified := old.is_verified;
    new.impact_points := old.impact_points;
    new.verification_status := old.verification_status;
  end if;
  return new;
end;
$$;
