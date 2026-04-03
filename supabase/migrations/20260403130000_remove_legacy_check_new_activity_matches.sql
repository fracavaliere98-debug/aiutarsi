drop trigger if exists tr_on_activity_inserted_matches on public.activities;

drop function if exists public.call_check_activity_matches();
