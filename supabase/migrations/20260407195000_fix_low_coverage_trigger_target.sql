create or replace function public.trigger_sync_npo_low_coverage_job_from_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_npo_low_coverage_job(new.id);
  return new;
end;
$$;

create or replace function public.trigger_sync_npo_low_coverage_job_from_participation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_npo_low_coverage_job(coalesce(new.activity_id, old.activity_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists tr_sync_npo_low_coverage_job_on_activity_change on public.activities;
create trigger tr_sync_npo_low_coverage_job_on_activity_change
after insert or update of status, date_start, slots_total, title on public.activities
for each row
execute function public.trigger_sync_npo_low_coverage_job_from_activity();

drop trigger if exists tr_sync_npo_low_coverage_job_on_participation on public.activity_participants;
create trigger tr_sync_npo_low_coverage_job_on_participation
after insert or update of status or delete on public.activity_participants
for each row
execute function public.trigger_sync_npo_low_coverage_job_from_participation();

revoke all on function public.trigger_sync_npo_low_coverage_job_from_activity() from public, anon, authenticated;
revoke all on function public.trigger_sync_npo_low_coverage_job_from_participation() from public, anon, authenticated;

grant execute on function public.trigger_sync_npo_low_coverage_job_from_activity() to service_role;
grant execute on function public.trigger_sync_npo_low_coverage_job_from_participation() to service_role;
