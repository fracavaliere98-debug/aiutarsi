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
- [x] Deploy all Edge Functions to production. — all 5 previously-stale functions (`gemma-help-assistant`, `activity-curator-ai`, `community-moderator-ai`, `generate-embedding`, `process-notification-jobs`) redeployed from current repo source 2026-07-15; hash-verified aligned with staging for the ones that should match (`auth-hook`, `image-optimizer`, `notify-user`, `push-notifications`, `auth-confirmation-status`).
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
