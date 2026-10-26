-- A31 (2026-10-26), dopo la prova di Francesco su staging:
--  1) una segnalazione si decide UNA volta sola: prima admin_resolve_report accettava una seconda decisione
--     (es. 'Ignora' dopo 'BAN' riscriveva lo stato a dismissed lasciando l'utente bannato);
--  2) 'Nascondi' (resolved) e' tolto: non nascondeva nessun contenuto. Decisione di Francesco: le scelte
--     possibili sono solo dismissed (Ignora), warned (Avvertimento), banned (BAN). Le segnalazioni gia'
--     chiuse come 'resolved' restano nello storico.
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

  if p_action not in ('dismissed', 'warned', 'banned') then
    raise exception 'invalid action: %', p_action using errcode = '22023';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;

  if coalesce(v_report.status, 'pending') <> 'pending' then
    raise exception 'already_decided' using errcode = '22023', detail = v_report.status;
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
