# Local Pre-Push Smoke Flow

Questo repo usa un hook `pre-push` locale per bloccare il push se gli smoke test iOS con Maestro non passano.

## Installazione iniziale

```bash
npm run hooks:install
```

Prerequisiti:

- Xcode installato e selezionato con `xcode-select`
- almeno un simulatore iOS installato in Xcode
- `maestro` disponibile nel `PATH`
- Java disponibile nel `PATH` (`openjdk` va bene)
- `pod install` eseguibile localmente

## Cosa succede a ogni push

L'hook `.githooks/pre-push` esegue:

```bash
npm run smoke:ios
```

Lo script:

1. genera `ios/` con `expo prebuild` se manca
2. esegue `pod install` se `ios/Pods` manca
3. avvia il simulatore iOS
4. avvia Metro in modalità dev client
5. builda e installa l'app sul simulatore
6. esegue i flow Maestro:
   - `maestro/flows/login.yaml`
   - `maestro/flows/community_activity_posts.yaml`
   - `maestro/flows/enroll_activity.yaml`

Se uno smoke test fallisce, il push viene bloccato.

## Override temporaneo

Per saltare il pre-push una volta:

```bash
SKIP_LOCAL_SMOKE=1 git push
```

## Configurazione simulatore

Default:

```bash
IOS_SMOKE_SIMULATOR="iPhone 17"
```

Override:

```bash
IOS_SMOKE_SIMULATOR="iPhone 15" npm run smoke:ios
```
