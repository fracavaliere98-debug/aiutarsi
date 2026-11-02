-- A26 (02/11/2026): registro delle accettazioni di Termini e Condizioni e Informativa privacy.
--
-- Chi si registra spunta due caselle (Privacy Policy, Termini). L'app manda terms_version e
-- privacy_version nei metadati della registrazione; il trigger handle_new_user salva una riga per
-- documento con la data decisa dal SERVER (now()), non dal telefono. La versione e' la data del testo
-- (shared/termsContent.ts -> TERMS_VERSION, shared/privacyPolicyContent.ts -> PRIVACY_POLICY_VERSION).
--
-- Regole:
--  * la tabella si legge solo per le proprie righe (RLS); nessun client puo' scrivere, modificare o cancellare;
--  * se i metadati mancano o hanno un formato diverso da AAAA-MM-GG non si salva nulla e la registrazione
--    non fallisce (account creati da script, dashboard o altri percorsi); il blocco "senza caselle non si
--    procede" sta nell'app (schermate, AuthContext, AuthService);
--  * le righe si cancellano con l'account (on delete cascade).
--
-- Rollback: drop table public.legal_acceptances; poi ripristinare handle_new_user dalla migration
-- 20261026110000 (hash md5 della definizione precedente: 7b9bd843091fbb6edd0433a7ef58fc2b).

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document text not null check (document in ('terms', 'privacy')),
  version text not null check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  accepted_at timestamptz not null default now(),
  source text not null default 'registration' check (source in ('registration', 'reaccept'))
);

create index if not exists legal_acceptances_user_doc_idx
  on public.legal_acceptances (user_id, document, accepted_at desc);

alter table public.legal_acceptances enable row level security;

drop policy if exists "legal_acceptances_select_own" on public.legal_acceptances;
create policy "legal_acceptances_select_own"
  on public.legal_acceptances
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.legal_acceptances from public, anon, authenticated;
grant select on table public.legal_acceptances to authenticated;

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role public.user_role;
  v_terms text := nullif(new.raw_user_meta_data->>'terms_version', '');
  v_privacy text := nullif(new.raw_user_meta_data->>'privacy_version', '');
begin
  v_role := case upper(coalesce(new.raw_user_meta_data->>'role', ''))
    when 'NPO' then 'NPO'::public.user_role
    when 'CORPORATE' then 'CORPORATE'::public.user_role
    else 'VOLUNTEER'::public.user_role
  end;

  perform set_config('app.bypass_profile_guard', 'true', true);
  insert into public.profiles (id,email,email_confirmed,full_name,avatar_url,role,npo_name,company_name,npo_vat_id,referral_code)
  values (new.id,new.email,coalesce(new.email_confirmed_at is not null,false),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'displayName'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'avatar'),
    v_role,
    coalesce(new.raw_user_meta_data->>'npo_name', new.raw_user_meta_data->>'npoName'),
    coalesce(new.raw_user_meta_data->>'company_name', new.raw_user_meta_data->>'companyName'),
    new.raw_user_meta_data->>'npo_vat_id', public.generate_referral_code(new.id))
  on conflict (id) do update set email = excluded.email, email_confirmed = excluded.email_confirmed, updated_at = now();
  perform set_config('app.bypass_profile_guard', 'false', true);

  if v_terms ~ '^\d{4}-\d{2}-\d{2}$' then
    insert into public.legal_acceptances (user_id, document, version) values (new.id, 'terms', v_terms);
  end if;
  if v_privacy ~ '^\d{4}-\d{2}-\d{2}$' then
    insert into public.legal_acceptances (user_id, document, version) values (new.id, 'privacy', v_privacy);
  end if;

  return new;
end;
$function$;
