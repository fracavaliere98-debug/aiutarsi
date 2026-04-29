# Environment Contract

This project keeps runtime app env, staging smoke env, and release env deliberately separate.

## Runtime App

Local app runtime reads:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Production app runtime also expects:

- `EXPO_PUBLIC_SENTRY_DSN`

## EAS Environments

Preview builds and OTA updates must use the EAS `preview` environment:

- `eas update --branch preview --environment preview`
- `eas build --profile preview --environment preview`

Production builds and OTA updates must use the EAS `production` environment:

- `eas update --branch production --environment production`
- `eas build --profile production --environment production`

Workflow files must not write `.env` manually. EAS environment selection is the source of truth for app runtime env in CI.

## Staging Smoke

Staging smoke scripts require:

- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY`

Smoke scripts must fail before network calls when these env vars are missing. They must not fall back to embedded URLs, embedded keys, or `EXPO_PUBLIC_*`.

## Audit Scripts

Audit scripts that need Supabase access must receive their env explicitly from CI or local shell. They should not create `.env` files in workflow steps.

## Validation

Run the contract checker with:

```bash
npm run validate:env-contract
```

For release smoke with staging checks:

```bash
npm run release:smoke
```

For local smoke without staging network checks:

```bash
npm run release:smoke -- --skip-staging
```
