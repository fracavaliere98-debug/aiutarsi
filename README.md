# AiutarSi — App Volontariato 🤝

App mobile per connettere volontari e NPO in Italia. Costruita con React Native + Expo.

## Sviluppo locale

```bash
cd AiutarSiApp
npm install
npx expo start        # Avvia Metro
npx expo start --android
npx expo start --ios
```

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

I flow di smoke test sono in `.maestro/flows/`:

```bash
# Esegui localmente (richiede device/emulatore connesso)
maestro test .maestro/flows/login.yaml
maestro test .maestro/flows/enroll_activity.yaml

# Tutti i flow
maestro test .maestro/flows/
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
- Google Gemini API
- EAS Build + EAS Update
