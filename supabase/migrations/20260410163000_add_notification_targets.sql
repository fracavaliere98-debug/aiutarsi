alter table if exists public.notifications
  add column if not exists related_application_id uuid null,
  add column if not exists related_npo_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_related_application_id_fkey'
  ) then
    alter table public.notifications
      add constraint notifications_related_application_id_fkey
      foreign key (related_application_id) references public.applications(id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_related_npo_id_fkey'
  ) then
    alter table public.notifications
      add constraint notifications_related_npo_id_fkey
      foreign key (related_npo_id) references public.profiles(id)
      on delete set null;
  end if;
end $$;
