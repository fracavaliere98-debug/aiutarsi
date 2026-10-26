-- A31 (2026-10-25): il ban da admin non aveva effetto. Stesso difetto gia' corretto a luglio per la
-- verifica enti (20260722090000_admin_npo_verification_rpc.sql):
--  1) app/admin/report/[id].tsx aggiornava is_banned con una PATCH diretta su profiles della persona
--     segnalata; la policy UPDATE consente solo id = auth.uid() -> 0 righe, nessun errore;
--  2) anche passando, protect_privileged_profile_fields riporta is_banned/ban_reason al valore precedente;
--  3) admin_audit_logs non ha policy INSERT -> il log dell'azione falliva in silenzio (0 righe in staging e prod).
-- Fix: una sola RPC SECURITY DEFINER che verifica il ruolo ADMIN e fa tutto in un'unica transazione.
--
-- Inoltre: la protezione di role/is_banned/ban_reason nel trigger esisteva su staging ma in nessun file del repo,
-- e su prod manca (un utente puo' darsi role ADMIN da solo). La riscrivo qui: su staging non cambia nulla,
-- su prod chiude la falla. Il ban (is_banned/ban_reason/ban_report_id) passa solo dalla RPC.

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
    new.role := old.role;
    new.is_banned := old.is_banned;
    new.ban_reason := old.ban_reason;
    new.ban_report_id := old.ban_report_id;
  end if;
  return new;
end;
$$;

create or replace function public.admin_resolve_report(
  p_report_id uuid,
  p_action text,
  p_reason text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_report public.reports%rowtype;
  v_target_role public.user_role;
  v_rows int;
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_action not in ('dismissed', 'warned', 'resolved', 'banned') then
    raise exception 'invalid action: %', p_action using errcode = '22023';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;

  if p_action = 'banned' then
    if v_report.reported_id is null then
      raise exception 'report has no reported user' using errcode = '22023';
    end if;
    if v_report.reported_id = v_admin then
      raise exception 'cannot ban yourself' using errcode = '22023';
    end if;
    select role into v_target_role from public.profiles where id = v_report.reported_id;
    if v_target_role = 'ADMIN' then
      raise exception 'cannot ban an admin' using errcode = '22023';
    end if;

    -- Solo questa transazione, dopo il controllo del ruolo, attraversa il trigger di protezione.
    perform set_config('app.bypass_profile_guard', 'true', true);
    update public.profiles
       set is_banned = true,
           ban_reason = nullif(trim(coalesce(p_reason, '')), ''),
           ban_report_id = v_report.id,
           updated_at = now()
     where id = v_report.reported_id;
    get diagnostics v_rows = row_count;
    perform set_config('app.bypass_profile_guard', 'false', true);
    if v_rows <> 1 then
      raise exception 'ban not applied (profile not found)' using errcode = 'P0002';
    end if;
  end if;

  update public.reports
     set status = p_action,
         admin_id = v_admin,
         resolution_date = now()
   where id = v_report.id;

  insert into public.admin_audit_logs (admin_id, target_id, action_type, reason, user_agent)
  values (v_admin, v_report.reported_id, upper(p_action), p_reason, left(p_user_agent, 200));

  return jsonb_build_object(
    'report_id', v_report.id,
    'action', p_action,
    'reported_id', v_report.reported_id,
    'reporter_id', v_report.reporter_id
  );
end;
$$;

revoke all on function public.admin_resolve_report(uuid, text, text, text) from public, anon;
grant execute on function public.admin_resolve_report(uuid, text, text, text) to authenticated;
