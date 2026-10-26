-- A41 (2026-10-26): un utente bannato sparisce dall'app per gli altri. Decisione di Francesco 26/10:
-- "se un utente e' bannato scompare sia dalle attivita', sia come volontario/follower di enti: la sua
-- card non deve essere piu' mostrata. Anche le chat con utenti bannati diventano non utilizzabili."
-- Estende A37 (che nascondeva il profilo e lo toglieva dalla scoperta) alle righe che legano il bannato
-- ad altri: iscrizioni, candidature, follower, recensioni, valutazioni di presenza.
-- Regola unica: una riga che coinvolge un bannato la vede solo lui stesso e l'admin.
-- Policy RESTRICTIVE (in AND con quelle esistenti): non allargano mai l'accesso, lo restringono.
-- Le funzioni security definer (es. admin_resolve_report, conteggi) non sono toccate.

-- 1) Iscrizioni alle attivita'
drop policy if exists "Banned hidden (participants)" on public.activity_participants;
create policy "Banned hidden (participants)" on public.activity_participants
  as restrictive for select to public
  using (user_id = auth.uid() or public.is_current_user_admin() or not public.is_user_banned(user_id));

-- 2) Candidature (volontario o ente bannato)
drop policy if exists "Banned hidden (applications)" on public.applications;
create policy "Banned hidden (applications)" on public.applications
  as restrictive for select to public
  using (
    public.is_current_user_admin()
    or ((volunteer_id = auth.uid() or not public.is_user_banned(volunteer_id))
        and (npo_id = auth.uid() or not public.is_user_banned(npo_id)))
  );

-- 3) Follower (follower o ente bannato)
drop policy if exists "Banned hidden (followers)" on public.npo_followers;
create policy "Banned hidden (followers)" on public.npo_followers
  as restrictive for select to public
  using (
    public.is_current_user_admin()
    or ((follower_id = auth.uid() or not public.is_user_banned(follower_id))
        and (npo_id = auth.uid() or not public.is_user_banned(npo_id)))
  );

-- 4) Recensioni del volontario sull'attivita' e valutazioni di presenza dell'ente
drop policy if exists "Banned hidden (reviews)" on public.reviews;
create policy "Banned hidden (reviews)" on public.reviews
  as restrictive for select to public
  using (
    public.is_current_user_admin()
    or ((volunteer_id = auth.uid() or not public.is_user_banned(volunteer_id))
        and (npo_id = auth.uid() or not public.is_user_banned(npo_id)))
  );

drop policy if exists "Banned hidden (volunteer reviews)" on public.volunteer_reviews;
create policy "Banned hidden (volunteer reviews)" on public.volunteer_reviews
  as restrictive for select to public
  using (
    public.is_current_user_admin()
    or ((volunteer_id = auth.uid() or not public.is_user_banned(volunteer_id))
        and (npo_id = auth.uid() or not public.is_user_banned(npo_id)))
  );

-- 5) Chat private con un bannato: nessuno puo' piu' scrivere (il bannato era gia' bloccato da check_request).
--    Le chat di gruppo delle attivita' restano usabili dagli altri partecipanti.
create or replace function public.is_private_conversation_with_banned(p_conversation_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.conversations c
    join public.conversation_participants cp on cp.conversation_id = c.id
    join public.profiles p on p.id = cp.user_id
    where c.id = p_conversation_id
      and c.type = 'PRIVATE'
      and cp.user_id <> auth.uid()
      and coalesce(p.is_banned, false)
  );
$$;
revoke all on function public.is_private_conversation_with_banned(uuid) from public, anon;
grant execute on function public.is_private_conversation_with_banned(uuid) to authenticated;

drop policy if exists "messages_no_send_to_banned" on public.messages;
create policy "messages_no_send_to_banned" on public.messages
  as restrictive for insert to authenticated
  with check (not public.is_private_conversation_with_banned(conversation_id));

create or replace function public.send_chat_message(p_conversation_id uuid, p_sender_id uuid, p_content text, p_metadata json default '{}'::json)
 returns table(id uuid, conversation_id uuid, sender_id uuid, content text, metadata jsonb, created_at timestamp with time zone)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_row public.messages%ROWTYPE;
BEGIN
  IF p_sender_id <> auth.uid() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = p_sender_id
  ) THEN
    RAISE EXCEPTION 'not_participant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.blocked_users bu
    JOIN public.conversation_participants cp
      ON cp.conversation_id = p_conversation_id
     AND cp.user_id <> p_sender_id
    WHERE bu.blocker_id = cp.user_id
      AND bu.blocked_id = p_sender_id
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  -- A41: chat privata con un utente bannato non piu' utilizzabile.
  IF public.is_private_conversation_with_banned(p_conversation_id) THEN
    RAISE EXCEPTION 'recipient_unavailable';
  END IF;

  UPDATE public.conversation_participants AS cp
  SET
    hidden_at = NULL,
    inbox_visible_at = COALESCE(cp.inbox_visible_at, now())
  WHERE cp.conversation_id = p_conversation_id;

  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    content,
    metadata
  )
  VALUES (
    p_conversation_id,
    p_sender_id,
    p_content,
    COALESCE(p_metadata, '{}'::json)
  )
  RETURNING * INTO v_row;

  RETURN QUERY
  SELECT
    v_row.id,
    v_row.conversation_id,
    v_row.sender_id,
    v_row.content,
    v_row.metadata,
    v_row.created_at;
END;
$function$;
