create or replace function public.handle_new_gamification_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.gamification_state (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
