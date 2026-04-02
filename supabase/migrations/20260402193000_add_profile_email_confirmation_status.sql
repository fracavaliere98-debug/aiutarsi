alter table public.profiles
add column if not exists email_confirmed boolean not null default false;

update public.profiles p
set email_confirmed = coalesce(u.email_confirmed_at is not null, false)
from auth.users u
where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  v_referred_by_id uuid;
begin
  begin
    v_referred_by_id := (new.raw_user_meta_data->>'referred_by_id')::uuid;
  exception when others then
    v_referred_by_id := null;
  end;

  insert into public.profiles (
    id,
    email,
    email_confirmed,
    full_name,
    avatar_url,
    role,
    npo_name,
    company_name,
    referred_by,
    referral_code
  )
  values (
    new.id,
    new.email,
    coalesce(new.email_confirmed_at is not null, false),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'displayName'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'avatar'),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'VOLUNTEER'::public.user_role),
    coalesce(new.raw_user_meta_data->>'npo_name', new.raw_user_meta_data->>'npoName'),
    coalesce(new.raw_user_meta_data->>'company_name', new.raw_user_meta_data->>'companyName'),
    v_referred_by_id,
    substring(new.id::text, 1, 8)
  )
  on conflict (id) do update
  set email = excluded.email,
      email_confirmed = excluded.email_confirmed,
      updated_at = now();

  return new;
end;
$$;

create or replace function public.sync_profile_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, email_confirmed, role, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.email_confirmed_at is not null, false),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'VOLUNTEER'::public.user_role),
    now()
  )
  on conflict (id) do update
  set email = excluded.email,
      email_confirmed = excluded.email_confirmed,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmation_changed on auth.users;

create trigger on_auth_user_email_confirmation_changed
after update of email, email_confirmed_at on auth.users
for each row
when (old.email is distinct from new.email or old.email_confirmed_at is distinct from new.email_confirmed_at)
execute function public.sync_profile_email_confirmation();
