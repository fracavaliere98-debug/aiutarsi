# AiutarSi — App Volontariato 🤝

App mobile per connettere volontari e NPO in Italia. Costruita con React Native + Expo.

## Sviluppo locale

```bash
nvm use                  # usa Node 20 da .nvmrc
cd aiutarsi
cp .env.example .env
npm install
npx expo start        # Avvia Metro
npx expo start --android
npx expo start --ios
```

Requisito runtime: usare Node 20.x. Con versioni piu recenti di Node, Expo SDK 54 puo fallire in avvio.

## Segreti e credenziali

`credentials.json` non deve contenere segreti versionati. Le credenziali Android locali ora vengono generate da variabili d'ambiente:

```bash
export EAS_ANDROID_KEYSTORE_PATH=credentials/android/keystore.jks
export EAS_ANDROID_KEYSTORE_PASSWORD=...
export EAS_ANDROID_KEY_ALIAS=...
export EAS_ANDROID_KEY_PASSWORD=...
npm run generate:credentials
```

Il file generato `credentials.json` e ignorato da git. Se i valori precedenti sono stati gia committati, vanno ruotati fuori banda.

---

## Ambienti (Environments)

L'app usa tre ambienti distinti gestiti da EAS:

| Ambiente | Profilo `eas.json` | Canale OTA | Trigger |
|---|---|---|---|
| **Development** | `development` | — | manuale (`expo start`) |
| **Preview** | `preview` | `preview` | push su `main` → GitHub Actions |
| **Production** | `production` | `production` | tag `v*.*.*` → GitHub Actions |

### Configurare EAS Secrets (primo deploy)

I secret **non vanno nel codice**. Impostarli una volta via CLI:

```bash
# Preview
eas secret:create --name SUPABASE_URL       --value <url>  --environment preview
eas secret:create --name SUPABASE_ANON_KEY  --value <key>  --environment preview

# Production
eas secret:create --name SUPABASE_URL       --value <url>  --environment production
eas secret:create --name SUPABASE_ANON_KEY  --value <key>  --environment production
```

### Configurare GitHub Secrets

Andare su GitHub → repo → **Settings → Secrets & Variables → Actions**:

| Secret | Quando | Come ottenerlo |
|---|---|---|
| `EXPO_TOKEN` | Subito | [expo.dev/accounts/fracava/settings/access-tokens](https://expo.dev/accounts/fracava/settings/access-tokens) |
| `EXPO_PUBLIC_SUPABASE_URL` | Preview/Audit | Supabase Dashboard -> Settings -> API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Preview/Audit | Supabase Dashboard -> Settings -> API |
| `MAESTRO_CLOUD_API_KEY` | Maestro Cloud | [console.mobile.dev](https://console.mobile.dev) -> API Keys |
| `MAESTRO_PROJECT_ID` | Maestro Cloud | [console.mobile.dev](https://console.mobile.dev) -> Project Settings |
| `SENTRY_AUTH_TOKEN` | Quando integri Sentry | sentry.io → Settings → API → Auth Tokens |
| `GOOGLE_PLAY_KEY` | Quando attivi `eas submit` | Google Play Console → API access |

---

## CI/CD Pipeline

```
push to main
  └─► Maestro smoke tests (emulatore Android)
        ├─ PASS → eas update --branch preview
        └─ FAIL → pipeline bloccata, NO OTA update

git tag v1.2.3 && git push --tags
  └─► eas build --profile production (APK + IPA)
        └─► eas update --branch production
```

### Altri Workflow

- **Full QA Check** (`full-qa-check.yml`): Run su ogni PR verso `main`. Esegue build nativa (se necessaria) e test Maestro in emulatore.
- **EAS Build & Maestro Cloud** (`eas-build.yml`): Run su push/PR verso `main`. Esegue build su EAS Cloud e test su Maestro Cloud.
- **Generate Master Audit Report** (`generate-audit.yml`): Run su push verso `main`. Rigenera la documentazione in `audit/`.

---

## Rollback OTA (Emergenza)

Se un aggiornamento OTA causa problemi in produzione:

```bash
# 1. Lista gli update recenti
eas update:list --branch production

# 2. Rollback all'ID precedente
eas update:rollback --branch production --update-id <ID>
```

---

## Test con Maestro

I flow di smoke test sono in `maestro/flows/`:

```bash
# Esegui localmente (richiede device/emulatore connesso)
maestro test maestro/flows/login.yaml
maestro test maestro/flows/enroll_activity.yaml

# Tutti i flow
maestro test maestro/flows/
```

> ⚠️ Creare un account di test su Supabase Dashboard:
> - email: `test.maestro@aiutarsi.it`
> - password: `TestMaestro123!`
> - role: `VOLUNTEER`

---

## Stack

- React Native 0.81 / Expo SDK 54
- TypeScript · Expo Router · NativeWind
- Supabase (Postgres + Auth + Realtime + Storage)
- Google Gemini / Gemma AI
- EAS Build + EAS Update
