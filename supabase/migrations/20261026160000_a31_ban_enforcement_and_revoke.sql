-- A31 (2026-10-26), richiesta di Francesco: il ban deve valere anche nel database, e l'admin deve poterlo revocare.
--
-- 1) Blocco del ban sulla Data API (tabelle e funzioni): public.check_request() gira prima di OGNI richiesta
--    PostgREST (pgrst.db_pre_request, meccanismo documentato da Supabase). Un utente con profiles.is_banned
--    non puo' fare richieste di scrittura (POST/PUT/PATCH/DELETE, comprese le RPC). Restano ammesse le letture
--    e rpc/get_my_profile, che serve all'app per mostrare la schermata "Account sospeso" con la motivazione.
--    Risposta: HTTP 403, code USER_BANNED. Un solo punto invece di una regola per ognuna delle 27 tabelle
--    scrivibili e delle ~15 funzioni server che scrivono.
-- 2) Lo Storage non passa da PostgREST: policy RESTRICTIVE su storage.objects per insert/update/delete.
-- 3) Revoca: admin_revoke_ban(user_id, reason, user_agent), solo ADMIN, toglie is_banned/ban_reason/ban_report_id,
--    scrive l'audit log (UNBANNED) e notifica l'utente. La segnalazione resta 'banned' nello storico.
-- Non coperti (documentato): Realtime (sola lettura nell'app), edge function chiamate col token dell'utente.

create or replace function public.check_request()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_method text := upper(coalesce(current_setting('request.method', true), ''));
  v_path   text := coalesce(current_setting('request.path', true), '');
  v_uid    uuid;
begin
  if v_method in ('', 'GET', 'HEAD', 'OPTIONS') then
    return;
  end if;
  if v_path in ('/rpc/get_my_profile', 'rpc/get_my_profile') then
    return;
  end if;
  v_uid := auth.uid();
  if v_uid is null then
    return;
  end if;
  if exists (select 1 from public.profiles where id = v_uid and is_banned is true) then
    raise sqlstate 'PGRST' using
      message = json_build_object('code', 'USER_BANNED', 'message', 'Account sospeso', 'details', null, 'hint', null)::text,
      detail = json_build_object('status', 403)::text;
  end if;
end;
$$;
revoke all on function public.check_request() from public;
grant execute on function public.check_request() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.check_request';
notify pgrst, 'reload config';

drop policy if exists "Banned users cannot write storage (insert)" on storage.objects;
drop policy if exists "Banned users cannot write storage (update)" on storage.objects;
drop policy if exists "Banned users cannot write storage (delete)" on storage.objects;
create policy "Banned users cannot write storage (insert)" on storage.objects
  as restrictive for insert to authenticated
  with check (not public.is_current_user_banned());
create policy "Banned users cannot write storage (update)" on storage.objects
  as restrictive for update to authenticated
  using (not public.is_current_user_banned())
  with check (not public.is_current_user_banned());
create policy "Banned users cannot write storage (delete)" on storage.objects
  as restrictive for delete to authenticated
  using (not public.is_current_user_banned());

create or replace function public.admin_revoke_ban(
  p_user_id uuid,
  p_reason text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_banned boolean;
  v_prev text;
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select is_banned into v_banned from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  if v_banned is not true then
    raise exception 'not_banned' using errcode = '22023';
  end if;

  v_prev := coalesce(current_setting('app.bypass_profile_guard', true), 'false');
  perform set_config('app.bypass_profile_guard', 'true', true);
  update public.profiles
     set is_banned = false,
         ban_reason = null,
         ban_report_id = null,
         updated_at = now()
   where id = p_user_id;
  perform set_config('app.bypass_profile_guard', v_prev, true);

  insert into public.admin_audit_logs (admin_id, target_id, action_type, reason, user_agent)
  values (v_admin, p_user_id, 'UNBANNED', nullif(trim(coalesce(p_reason, '')), ''), left(p_user_agent, 200));

  insert into public.notifications (user_id, type, title, message, read)
  values (p_user_id, 'SUCCESS', 'Account riattivato',
          'Il tuo account AiutarSi è stato riattivato. Puoi di nuovo usare l''app, nel rispetto delle regole della community.', false);

  return jsonb_build_object('user_id', p_user_id, 'action', 'unbanned');
end;
$$;
revoke all on function public.admin_revoke_ban(uuid, text, text) from public, anon;
grant execute on function public.admin_revoke_ban(uuid, text, text) to authenticated;
