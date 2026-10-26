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

Requisito runtime: usare Node 20.x (>= 20.19.4 per Expo SDK 57 / React Native 0.86). Con versioni piu recenti di Node, Expo puo fallire in avvio.

### Build di sviluppo su iPhone (Apple ID gratuito)

Expo Go dell'App Store non apre progetti SDK 57 e l'account Apple Developer è gratuito (niente `eas build` iOS interno, niente TestFlight). Si compila in locale con Xcode e si firma con il Personal Team.

Prerequisiti (una volta): Xcode con Apple ID in Settings → Accounts, CocoaPods (`brew install cocoapods`), iPhone collegato via cavo almeno la prima volta e Modalità sviluppatore attiva (Impostazioni → Privacy e sicurezza).

```bash
IOS_FREE_TEAM=1 npx expo prebuild --platform ios --clean   # solo la prima volta o dopo modifiche native
IOS_FREE_TEAM=1 npx expo run:ios --device                  # compila, installa, avvia Metro
npx expo start --dev-client                                 # le volte successive: riapri l'app sull'iPhone
```

- `IOS_FREE_TEAM=1` (in `app.config.js`) toglie gli entitlement che il team gratuito non può firmare: push (`aps-environment`) e universal link (`associated-domains`). Senza la variabile la config è identica, quindi build EAS e OTA non cambiano. Va messa sempre davanti a `prebuild` e `run:ios`.
- Primo avvio: sull'iPhone autorizzare lo sviluppatore in Impostazioni → Generali → VPN e gestione dispositivi.
- La firma gratuita scade dopo 7 giorni: rifare `run:ios`. Va rifatto anche dopo ogni modifica nativa (dipendenze native, plugin o config in `app.json`/`app.config.js`, SDK). Dopo il primo abbinamento funziona anche senza cavo, sulla stessa Wi-Fi.
- Non testabili con questa build: notifiche push e link `https://aiutarsi.app/...` (lo schema `aiutarsiapp://` funziona).
- La build carica sempre il JS da Metro (working tree locale): gli OTA EAS non si applicano. Metro deve essere acceso.
- `npx expo run:ios` va lanciato dalla radice del progetto, non da `ios/`.
- Se `pod install` fallisce con "Failed to download ... from repo1.maven.org": è un download interrotto (Maven reindirizza a `repo.reactnative.dev`). Rilanciare `cd ios && pod install`; per Hermes in alternativa scaricare il file con `curl -fL` e usare `HERMES_ENGINE_TARBALL_PATH=<file> pod install`.

## UI e Design System

La base condivisa del design system vive in:

- `theme/`: palette primitive, token semantici, spacing, radius, typography, shadows, motion e colori per ruolo.
- `components/ui/`: primitive UI condivise come `CountBadge`, `StatusPill`, `SectionHeader` e `SegmentedControl`.

Le nuove schermate dovrebbero importare token semantici da `theme` e componenti condivisi da `components/ui`, evitando nuovi valori hardcoded quando esiste gia un token. Le regole complete sono in [docs/design-system.md](./docs/design-system.md).

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
| **Production** | `production` | `production` | push su `main` → dopo preview, il job `ota-deploy-production` (workflow `ota-deploy.yml`) aspetta l'approvazione manuale dell'ambiente GitHub `production` (required reviewers). Non dipende da tag. |
| **Production (APK demo/test)** | `production-apk` | `production` | manuale (`eas build --profile production-apk --platform android`) — APK a distribuzione interna, stesso backend di produzione, nessuna review store. Utile per test rapidi o demo prima della submission ufficiale. |

### Configurare EAS Secrets (primo deploy)

I secret **non vanno nel codice**. Impostarli una volta via CLI:

```bash
# Preview
eas env:create --name EXPO_PUBLIC_SUPABASE_URL       --value <url>  --environment preview
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY  --value <key>  --environment preview

# Production
eas env:create --name EXPO_PUBLIC_SUPABASE_URL       --value <url>  --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY  --value <key>  --environment production
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

Il repository installa anche un hook locale `pre-push` che *potrebbe* eseguire `npm run smoke:ios` prima del push. È **disabilitato di default** (2026-07-06: richiede un simulatore iOS locale ed era solo bloccante senza uno disponibile). Per farlo girare comunque:

```bash
RUN_LOCAL_SMOKE=1 git push origin main
```

```
push to main
  └─► ota-deploy.yml
        ├─ env contract check
        ├─ regression suite
        ├─ optional Maestro smoke
        └─ eas update --branch preview --environment preview

manual workflow_dispatch
  └─► eas-build.yml
        └─ eas build --platform android --profile preview --environment preview
```

### Altri Workflow

- **OTA Deploy** (`ota-deploy.yml`): Run su push verso `main`. Esegue controlli statici/regression e pubblica OTA preview.
- **EAS Build** (`eas-build.yml`): Run manuale. Esegue build Android preview su EAS Cloud.

**Fingerprint e OTA.** `runtimeVersion` usa la policy `fingerprint`: ogni modifica nativa (nuova dipendenza nativa, plugin o config nativa, SDK) cambia il runtime. Gli OTA pubblicati dopo quel commit arrivano solo alle build EAS fatte da quel commit in poi; le build già installate restano all'ultimo JS compatibile. Dopo una modifica nativa servono nuove build EAS (preview con `eas-build.yml`, production con `eas build --profile production`/`production-apk`) prima che gli OTA tornino a raggiungere i tester. Esempio: `expo-dev-client` aggiunto il 2026-10-26 (commit `e309228`).
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

- React Native 0.86 / Expo SDK 57
- TypeScript · Expo Router · NativeWind
- Supabase (Postgres + Auth + Realtime + Storage)
- Google Gemini / Gemma AI
- EAS Build + EAS Update

## Documentazione

- Architettura tecnica: [docs/architecture.md](./docs/architecture.md)
- Design system: [docs/design-system.md](./docs/design-system.md)
- Contratto ambienti: [docs/env-contract.md](./docs/env-contract.md)
- Checklist release breve: [docs/prod-migration-checklist.md](./docs/prod-migration-checklist.md)
- Piano go-to-market / lancio pilota: [docs/go-to-market-pilot.md](./docs/go-to-market-pilot.md)
