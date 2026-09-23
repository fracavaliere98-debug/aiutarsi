# Prod Migration Checklist

## Scope
- Move the app from the current staging Supabase project to a dedicated production project.
- Avoid runtime references to the staging project in app code, scripts, functions, cron jobs, and operational docs.
- Execute the cutover with a rollback path.

> **Aggiornato 2026-07-15** — questo documento era rimasto disallineato dallo stato reale per mesi (Step 3/4 segnati come "non fatti" mentre in realtà lo erano quasi tutti). Verificato punto per punto via Supabase MCP contro i progetti reali (`aiutarsi-prod` = `ibyjkqowokxrlormkwzw`, `aiutarsi_staging` = `pavnfiladmnwbptwlwpr`) prima di aggiornare le spunte sotto. Non fidarsi ciecamente di questo file in futuro senza una riverifica se sono passate settimane.

## Step 1: Runtime App Cleanup
- [x] Remove hardcoded Expo `projectId` from runtime push registration.
- [x] Remove hardcoded Supabase project ref from auth/session storage cleanup.
- [x] Derive runtime values from `EXPO_PUBLIC_SUPABASE_URL` and Expo config.
- [x] Verify with targeted lint.

Files updated:
- `utils/runtimeConfig.ts`
- `hooks/usePushNotifications.ts`
- `services/AuthService.ts`
- `context/AuthContext.tsx`

## Step 2: Script and Test Cleanup
- [x] Remove hardcoded staging URL and anon key from local test scripts.
- [x] Make scripts read from env and fail fast if env is missing.
- [x] Verify script syntax.

Files updated:
- `scripts/dist_auth/test_auth_flow.js`
- `test-gemma.js`

## Step 3: Cron and Environment-Safe Scheduling
- [x] Replace direct hardcoded cron URL with a DB wrapper and runtime setting.
- [x] Preserve existing staging behavior during migration.
- [x] Make fresh bootstraps safe by removing legacy hardcoded scheduling from the old migration file.
- [x] Verify remote schema contains `runtime_settings` and `invoke_process_notification_jobs(...)`.

Files involved:
- `supabase/migrations/20260331170000_schedule_process_notification_jobs.sql`
- `supabase/migrations/20260401101500_make_notification_cron_environment_safe.sql`

Automated production bootstrap:
- [x] `runtime_settings` on prod is populated with prod-specific values (`functions_base_url`, `process_notification_jobs_url` both point to `ibyjkqowokxrlormkwzw`, not staging) — verified via direct query, 2 rows present. Whether this happened via `npm run bootstrap:runtime-settings` or a manual insert isn't recorded, but the end state is correct.

### 3.1 Informational Audit Docs Still Mention Staging
These are not runtime blockers, but should be updated or clearly labeled:
- `audit/MASTER_REPORT.md`
- `audit/api_docs.md`

## Step 4: Production Environment Bootstrap
- [x] Create Supabase production project. — `ibyjkqowokxrlormkwzw`, `ACTIVE_HEALTHY`, created 2026-03-06.
- [ ] Add production URL and anon key to EAS/Expo env. — `eas.json` already uses `"environment": "production"` (EAS Environments) on `build.production`, meaning the *wiring* is in place, but the actual variable values in the EAS dashboard are not verifiable from here (no EAS API access). **Needs manual confirmation.**
- [x] Add production service secrets for Edge Functions. — the only custom secret used by any edge function is `HUGGINGFACE_API_KEY` (`gemma-help-assistant`, `activity-curator-ai`, `community-moderator-ai`, `generate-embedding` — all HuggingFace router calls for chat/embeddings). All 4 functions read it from `public.internal_secrets` (`key = 'HUGGINGFACE_API_KEY'`) first and only fall back to the env var if that lookup fails. Verified directly: the row exists on prod with a value of the same length (37 chars) as staging's. No Dashboard Edge Function secret is required given this fallback chain.
- [x] Recreate storage buckets and policies. — `avatars`, `activities`, `community_media` (public), `verification_docs` (private) all present on prod, RLS hardened 2026-07-15 (removed public listing policies).
- [x] Enable required extensions. — `pg_cron`, `pg_net`, `postgis`, `vector`, `pg_trgm`, `uuid-ossp`, `pgcrypto` all installed on prod.
- [x] Push all migrations to production. — identical migration list to staging, verified 2026-07-15 (includes today's 3 new migrations).
- [x] Migration `notifications_server_side` applicata su staging e prod il 2026-09-21 (test in transazione con rollback su staging): INSERT client su `notifications` revocato, notifiche generate da trigger/RPC (`send_npo_invite`, `admin_send_notification`). Chiude la vulnerabilità di spoofing notifiche.
- [x] Smoke test edge su staging (`smoke:activities|notifications|chat|gamification|smart-match|stories:staging`): **tutti OK il 2026-09-21**, lanciati dall'utente dal Mac dopo le migration `notifications_server_side` e le altre del 21/09 (esito riferito dall'utente, output non archiviato). Eseguiti anche `smoke:account-deletion:staging` (dry run, `dueCount: 0`) e `release:smoke` completo (env contract, lint, tsc, expo-doctor 18/18, regression, 6 smoke staging): tutti OK, esito riferito dall'utente. Verifica DB delle migration fatta anche via SQL in transazioni con rollback. Edge function: sorgente repo == staging == prod per le 6 funzioni driftate (verificato 21/09 confrontando il codice; l'`ezbr_sha256` non è confrontabile tra progetti perché il bundle cambia con il layout dei path).
- [ ] **Universal/App Links `https://aiutarsi.app/{activity,npo-profile,volunteer-profile,referral}/…`** — lato repo fatto (`associatedDomains` iOS e `intentFilters` Android in `app.json`, esclusi dalla variante preview in `app.config.js`; fallback `landing/app/not-found.tsx` con pulsante "Apri nell'app"). **Mancano, richiedono dati che non sono nel repo**: (1) pubblicare su `aiutarsi.app` `/.well-known/apple-app-site-association` (JSON senza estensione, `Content-Type: application/json`, con `appIDs: ["<TEAM_ID>.com.aiutarsi.app"]` e `components` per i 4 prefissi) e `/.well-known/assetlinks.json` (package `com.aiutarsi.app` + SHA-256 del certificato di firma Play/EAS: `eas credentials`); (2) l'host statico deve servire `404.html` per i percorsi sconosciuti; (3) serve una nuova build EAS nativa (gli entitlement non arrivano via OTA). Finché non è fatto, i link condivisi funzionano solo dal messaggio con lo schema `aiutarsiapp://` e mostrano la pagina di fallback sul web.
- [x] Migration `activities_no_hard_delete` e `participation_guard_and_npo_notifications` applicate su staging e prod il 2026-09-21 (dopo test in transazione con rollback su staging: ente proprietario può UPDATE ma non DELETE, altro utente né UPDATE né DELETE; iscrizione a attività annullata rifiutata anche via upsert; notifica all'ente con dedup). Su prod verificati: 2 trigger presenti, funzioni non invocabili via RPC, nessuna policy DELETE/ALL su `activities`, advisor di sicurezza invariati rispetto alla baseline. Le versioni registrate nei due progetti differiscono da quelle dei file (timestamp di applicazione), come già per le migration precedenti.
- [x] Deploy all Edge Functions to production. — redeployed again 2026-09-21 (`gemma-help-assistant`, `activity-curator-ai`, `community-moderator-ai`, `generate-embedding`, `process-notification-jobs`, `process-account-deletions`) from current repo source, after `list_edge_functions` (compared by `ezbr_sha256`, not just version number) showed all 6 had drifted from staging again since the 2026-07-15 sync. DB migrations re-verified identical on both projects before redeploying (no missing-dependency risk). Security advisors re-checked after deploy: no new findings, same accepted baseline (~83, unchanged categories). **Process gap, not yet fixed**: nothing auto-syncs prod edge functions when staging changes — this has now drifted and been manually re-fixed twice (07-15, 09-21). Worth adding a CI check or scheduled diff (`ezbr_sha256` comparison) that flags drift instead of relying on someone noticing before the next production-facing event.
- [x] Run `npm run bootstrap:runtime-settings` against production. — see Step 3 note above; end state verified correct.
- [ ] Configure auth providers, redirect URLs, and deep links. — **not verified.** Requires checking the Supabase Dashboard (Authentication → Providers/URL Configuration) directly; not exposed via the Supabase MCP tools available in this session.
- [ ] Verify support email, privacy policy URL, and store metadata. — **not verified.** Requires App Store Connect / Play Console access, outside any tool available here.

Known residual gap (accepted, low severity): `pg_net` extension lives in schema `public` on prod instead of `extensions` (matches staging's pre-2026-07-06 state before its own cleanup). `ALTER EXTENSION ... SET SCHEMA` is not supported by Postgres for this extension — fixing it would require `DROP`/`CREATE EXTENSION` on a live production database. Given it's a WARN-level, non-exploitable finding (all pg_net objects verified to live in the `net` schema regardless of the extension's nominal schema), this was deliberately left as-is rather than risked. Revisit only in a planned maintenance window.

## Step 5: Data Policy
- [x] Production starts empty except seed/config data. — as of 2026-07-15, the 6 leftover test/dev profiles (created Feb–Apr during bootstrap testing, confirmed by the user to be test accounts) were deleted via `DELETE FROM auth.users` (cascades through `profiles` and all dependent tables via `ON DELETE CASCADE`). Verified: `profiles` count 0, `auth.users` count 0 on prod.
- [x] No user/chat/test data copied from staging. — confirmed never done; prod and staging have always been separate, staging retains its own large test dataset.
- [x] Seed only reusable static data — `levels` (10 rows) and `runtime_settings` (2 rows) are present on prod. Note: this app does **not** have separate `skills`/`interests`/`categories` master tables — those are free-text values normalized at the application/function level (e.g. `normalize_activity_category`, `user_skills.skill_value`), so there is nothing further to seed for them. FAQ/help content is served from `shared/helpCenterContent.ts` in the repo (deployed as part of the `gemma-help-assistant` edge function), not a DB table — no separate seeding needed there either.

## Step 6: Verification After Bootstrap
Production smoke checklist — **not yet run**:
- [ ] Login
- [ ] Volunteer onboarding
- [ ] NPO onboarding
- [ ] Avatar upload
- [ ] Activity creation
- [ ] Application / enrollment flow
- [ ] Community posting
- [ ] Notifications enqueue + processing
- [ ] Gemma help center
- [ ] Volunteer report
- [ ] NPO report

## Rollback
- [ ] Backup staging and production schemas before cutover.
- [ ] Keep previous function deploy artifacts available.
- [ ] Be able to disable cron quickly.
- [ ] Be able to disable push processing quickly.
- [ ] Keep previous production build/update identifiers documented.

## Short Release Checklist

Use this as the final release pass before shipping store builds. **Not started.**

### Build
- [ ] `main` is clean and pushed.
- [ ] `preview` and `production` OTA are aligned with the target commit.
- [ ] `npx -y expo-doctor` passes.
- [ ] `npm run lint` passes.
- [ ] `npx tsc --noEmit --pretty false` passes.
- [ ] `npm run validate:env-contract` passes.
- [ ] `npm run release:smoke` passes.
- [ ] Staging smoke scripts pass for the critical domains in scope.
- [ ] Run `eas build --platform android --profile production`.
- [ ] Run `eas build --platform ios --profile production`.

**2026-09-21 — interim demo/test build, separate from the store release above.** No test build of any kind existed yet as of this date. Identified `eas.json`'s existing `production-apk` profile (`environment: "production"`, `distribution: "internal"`, Android `buildType: apk`) as the right one for an installable, no-review-needed APK against the production backend — useful both for manual QA and for demoing to pilot NPOs before the real store release above. Command handed to the user (`eas build --profile production-apk --platform android`), not yet run. Blocked on device access, not on anything technical: the user has no Android device (own phone is iPhone with Expo Go) — plan is to test the two critical flows (NPO creates an activity, volunteer applies) via `npx expo start` + Expo Go first, since `react-native-maps` isn't supported in Expo Go on iOS and will likely fail there (Expo Go limitation, not an app bug), then borrow/buy a cheap Android device before any live NPO demo. A real iOS native build (beyond Expo Go) would additionally require an Apple Developer Program enrollment ($99/yr), independent of App Store publication. `README.md`'s "Ambienti" table updated the same day to list this `production-apk` profile (it existed in `eas.json` already but wasn't documented there).

**2026-09-21 — conferma presenze da parte dell'ente (APPLICATA su staging e su PROD il 21/09/2026 con ok esplicito; `process-notification-jobs` ridistribuita su entrambi, `ezbr_sha256` identico `c56c29c0…`, prod v13 / staging v7).** Migration `20260921150000_attendance_confirmation.sql` + edge function `_shared/notificationJobs.ts` (promemoria recensione solo con presenza confermata; ricordarsi di ridistribuire le funzioni che lo importano, confrontando `ezbr_sha256` prod vs staging). Chiude un exploit reale: il volontario poteva auto-impostarsi APPROVED/CHECKED_IN e farmare +200 XP per ogni toggle. Regola: XP/ore/badge partono solo quando l'ente proprietario conferma `volunteer_reviews.is_present = true` su attività COMPLETATA (idempotente, presenza non revocabile). Prima di prod: verificare che nessuna riga esistente in `activity_participants` dipenda da APPROVED/CHECKED_IN per flussi non migrati.

**2026-09-21/22 — migrazione Expo SDK 54 -> 57 (React Native 0.81 -> 0.86), branch `upgrade/expo-sdk-57`, MERGIATO su `main` localmente il 22/09. Il merge è stato fatto via device_bash (operazione locale, nessuna rete richiesta); il push di `main` su origin NON è stato fatto da questo ambiente — stesso limite tecnico SSH/FUSE già noto per i push dei branch, va fatto dall'utente dal suo Mac. Finché `main` non è pushato, nessun OTA automatico parte.** Motivo: Expo Go supporta solo l'ultimo SDK stabile, bloccando il test su iPhone dell'utente. Dettagli completi, rischi verificati e piano fase per fase in [docs/sdk-57-migration-plan.md](./sdk-57-migration-plan.md). Rilevante per questa checklist: `app.json`'s `runtimeVersion.policy` è passato da `"appVersion"` a `"fingerprint"` (mitigazione del rischio OTA piu alto del piano). **Effetto pratico da tenere a mente al prossimo rilascio**: qualsiasi binario nativo gia installato (staging o produzione) con la vecchia policy `appVersion` NON ricevera gli OTA pubblicati da questo branch dopo il merge — serve una nuova build nativa (EAS build, non solo `eas update`) prima che l'OTA su `preview`/`production` torni a funzionare per quei device. Non fare l'item "`preview` e `production` OTA sono allineati al target commit" sopra assumendo che basti un `eas update`: dopo il merge di questo branch serve prima `eas build` su entrambi i profili.

**Chiarimento (2026-09-23, dopo il push di `main`): questo vincolo si applica solo se esiste già un binario standalone installato da qualche parte.** Ad oggi non è così: nessun `eas build` è mai stato eseguito per questo progetto (vedi la nota del 2026-09-21 sull'"interim demo/test build" più sotto — non ancora fatto), e finora l'unico modo di eseguire l'app è stato `npx expo start` + Expo Go. Expo Go non applica il matching runtimeVersion/fingerprint di `expo-updates` (quello è specifico dei build standalone con `expo-updates` nativo incorporato) — carica semplicemente il bundle JS corrente dal dev server, quindi il push di `main` non lo tocca in alcun modo negativo. **Di conseguenza, `eas build` NON è necessario ora solo per "riparare" gli OTA**: lo resta comunque, ma per motivi indipendenti già pianificati — `react-native-maps` non funziona in Expo Go su iOS (serve un build vero per validare le schermate con mappa) e una demo a NPO pilota richiede un'app installabile, non Expo Go sul telefono dello sviluppatore. Il vincolo OTA/fingerprint sopra torna rilevante solo dal momento in cui il primo build standalone (staging o produzione) viene effettivamente creato e installato su un device.

**2026-09-22 — auto-conferma presenza dopo 72h + reminder volontario→NPO + tracciamento npo/auto (APPLICATA su staging E su PROD lo stesso giorno, con ok esplicito).** Migration `20260922100000_attendance_auto_confirm_and_reminder.sql`: nuova colonna `volunteer_reviews.confirmed_by`, nuova funzione+cron `auto_confirm_stale_attendance` (oraria), nuova RPC `request_attendance_confirmation_reminder`. Nessuna edge function coinvolta (solo cron `pg_cron` + trigger/RPC lato Postgres), quindi nessun redeploy di funzioni da confrontare via `ezbr_sha256` per questo item. Security/performance advisors su staging verificati dopo l'apply: nessuna nuova segnalazione legata a questa migration (solo i findings pre-esistenti su `volunteer_reviews`/`activity_participants`, non introdotti da qui). Applicata su prod (`ibyjkqowokxrlormkwzw`) dopo ok esplicito dell'utente; security advisor su prod verificati subito dopo: stesso baseline di staging, nessuna nuova segnalazione legata a questa migration (`request_attendance_confirmation_reminder` compare tra i SECURITY DEFINER eseguibili da `authenticated`, per design — stesso pattern delle ~75 RPC analoghe già esistenti; `auto_confirm_stale_attendance` correttamente non eseguibile da client). Nessuna edge function coinvolta, quindi nessun redeploy/confronto `ezbr_sha256` necessario per questo item. Dettagli completi (contesto, opzioni considerate, trade-off) nella voce di Decision Log del 2026-09-22 in [docs/backlog-miglioramenti.md](./backlog-miglioramenti.md).

### Artifact Verification
- [ ] Android artifact is generated and downloadable.
- [ ] iOS artifact is generated and downloadable.
- [ ] Confirm version / build numbers are incremented as expected.
- [ ] Confirm bundle identifiers / package name match store targets.
- [ ] Smoke-check the production artifacts on real devices or emulator/simulator where possible.

### Submit
- [ ] Android submit credentials are available (`google-services-key.json` or equivalent workflow path).
- [ ] iOS submission path is defined (manual/TestFlight or `submit.production.ios`).
- [ ] Submit Android build to the intended Play track.
- [ ] Submit iOS build to TestFlight / App Store Connect.

### Post-release Smoke
- [ ] Open the released app and verify login.
- [ ] Verify onboarding and a core volunteer flow.
- [ ] Verify an NPO flow.
- [ ] Verify chat, notifications, and stories.
- [ ] Verify production routing from notifications.
- [ ] Verify Sentry stays quiet on the new release for the key flows.
