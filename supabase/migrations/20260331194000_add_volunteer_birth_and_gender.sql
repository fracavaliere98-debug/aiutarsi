alter table public.profiles
add column if not exists gender text,
add column if not exists date_of_birth date;

alter table public.profiles
drop constraint if exists profiles_gender_check;

alter table public.profiles
add constraint profiles_gender_check
check (gender is null or gender in ('FEMALE', 'MALE', 'OTHER', 'PREFER_NOT_TO_SAY'));

