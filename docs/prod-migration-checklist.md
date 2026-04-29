# Prod Migration Checklist

## Scope
- Move the app from the current staging Supabase project to a dedicated production project.
- Avoid runtime references to the staging project in app code, scripts, functions, cron jobs, and operational docs.
- Execute the cutover with a rollback path.

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
- [ ] Run `npm run bootstrap:runtime-settings` with:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Verify that the script upserts:
  - `functions_base_url`
  - `process_notification_jobs_url`

### 3.1 Informational Audit Docs Still Mention Staging
These are not runtime blockers, but should be updated or clearly labeled:
- `audit/MASTER_REPORT.md`
- `audit/api_docs.md`

## Step 4: Production Environment Bootstrap
Before first production build:
- [ ] Create Supabase production project.
- [ ] Add production URL and anon key to EAS/Expo env.
- [ ] Add production service secrets for Edge Functions.
- [ ] Recreate storage buckets and policies.
- [ ] Enable required extensions: `pg_cron`, `pg_net`, others used by migrations.
- [ ] Push all migrations to production.
- [ ] Deploy all Edge Functions to production.
- [ ] Run `npm run bootstrap:runtime-settings` against production.
- [ ] Configure auth providers, redirect URLs, and deep links.
- [ ] Verify support email, privacy policy URL, and store metadata.

## Step 5: Data Policy
Decide explicitly:
- [ ] Production starts empty except seed/config data.
- [ ] No user/chat/test data copied from staging.
- [ ] Seed only reusable static data:
  - levels
  - FAQ/help content
  - skills/interests/categories
  - static app configuration

## Step 6: Verification After Bootstrap
Production smoke checklist:
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

Use this as the final release pass before shipping store builds.

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
