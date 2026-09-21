# Migrazione a Expo SDK 57 — studio e piano (21/09/2026)

Stato: PIANO, nessuna modifica al codice applicativo. Sostituisce `docs/sdk-55-upgrade-plan.md` del branch `upgrade/expo-sdk-55` (fermo ad aprile, solo bump dipendenze).

## Decision Log

- **Contesto.** L'app è su SDK 54 (RN 0.81.5, React 19.1). Expo Go sull'App Store supporta solo l'SDK più recente (57); l'SDK 58 è in beta (RN 0.88) e Expo Go passerà al 58 poco dopo la stabile. Il test su iPhone con Expo Go è quindi bloccato.
- **Opzioni.** (A) restare su 54 e testare con development build / simulatore; (B) migrare a 57 e continuare con Expo Go; (C) saltare a 58 beta.
- **Scelta.** Migrare a **57** (B) *e* smettere di dipendere da Expo Go per i test seri (A): l'app usa moduli nativi che Expo Go non copre bene (maps, notifiche push, Sentry, updates). Non passare al 58 finché non è stabile: richiede Node 22+, iOS 27 con SceneDelegate, rework del core di expo-router e R8 di default.
- **Trade-off.** 3 SDK in un colpo (55, 56, 57) = più superficie di rischio; mitigato procedendo per gradini con verifica a ogni gradino. Drop di iOS 15 (min iOS 16.4 da SDK 56).

## Requisiti degli store: cosa risulta oggi (VERIFIED su fonti ufficiali)

- **App Store:** dal 28/04/2026 gli upload richiedono Xcode 26 / SDK iOS 26. Expo dichiara SDK 54 e 55 già conformi (immagine EAS di default con Xcode 26). `eas.json` non fissa nessuna immagine → siamo conformi. **Nessuna urgenza store dall'SDK.**
- **Google Play:** dal 31/08/2026 nuovi app/aggiornamenti devono avere target API 36 (estensione richiedibile fino al 01/11/2026); le app esistenti devono targettare almeno API 35 per restare visibili. RN 0.81 usa `targetSdk = 36`, `compileSdk = 36`, `minSdk = 24` → conformi.
- Da SDK 56: Xcode ≥ 26.4, iOS minimo **16.4** (oggi 15.1). Da RN 0.85: Node ≥ 20.19.4 (CI usa Node 20 → ok).

## Matrice versioni (da `expo/bundledNativeModules.json` di SDK 57.0.24)

expo ~57.0.24 · react/react-dom 19.2.3 · react-native 0.86.3 · expo-router ~57.0.22 · expo-notifications ~57.0.20 · expo-updates ~57.0.23 · expo-location ~57.0.19 · expo-image-picker ~57.0.19 · expo-constants ~57.0.19 · expo-file-system ~57.0.7 · expo-calendar ~57.0.4 · expo-video ~57.0.4 · expo-image ~57.0.5 · expo-splash-screen ~57.0.9 · expo-linking ~57.0.10 · reanimated 4.5.1 · worklets 0.10.1 · gesture-handler ~2.32.0 · screens ~4.26.0 · safe-area-context ~5.7.0 · svg 15.15.4 · maps 1.27.2 · webview 13.16.1 · view-shot 5.1.0 · eslint-config-expo ~57.0.2. Sentry: `@sentry/react-native` è escluso da `expo install --fix`; tenere la 8.x più recente (peer `react-native >= 0.65`).

## Rischi specifici del nostro codice

1. **OTA / runtimeVersion (alto).** `runtimeVersion.policy = "appVersion"` con versione `1.0.0`: un OTA con codice SDK 57 pubblicato su un binario SDK 54 con la stessa versione lo manda in crash. Il workflow OTA parte a ogni push su `main`. Regola: nessun codice SDK 57 su `main` finché non esistono build 57; nel branch passare a `policy: "fingerprint"` (o bump di versione).
2. **NativeWind 2.0.11 (alto per la UI).** 88 file usano `className`. La v2 non è più mantenuta; compatibilità con RN 0.86 non verificabile a tavolino. Spike per primo (bundle + render sul simulatore). Piano B: NativeWind 4 (lavoro a parte) o migrazione a StyleSheet dei soli punti che rompono.
3. **`@react-navigation/*` (medio, bug silenzioso).** Da SDK 56 expo-router include react-navigation in versione interna. `hooks/useBottomScreenInset.ts` importa `BottomTabBarHeightContext` da `@react-navigation/bottom-tabs`: con due copie il contesto non è più quello del router e l'inset del tab bar diventa 0 senza errori. Fix: importare da `expo-router/react-navigation` e togliere i pacchetti `@react-navigation/*` dal package.json (codemod: `npx expo-codemod sdk-56-expo-router-react-navigation-replace`).
4. **Reanimated 4.1→4.5 / worklets 0.5→0.10 (medio).** `babel.config.js` elenca ancora `react-native-reanimated/plugin` (esiste ancora in 4.5.1) mentre `babel-preset-expo` 57 gestisce già worklets: verificare che non ci sia doppia trasformazione. 19 file usano reanimated.
5. **Hermes V1 di default (SDK 56).** Regressioni di memoria e startup risolte in 57.0.9 / 57.0.17: partire da ≥ 57.0.24 (ok).
6. **expo-file-system (basso).** Usiamo `expo-file-system/legacy` (2 file): esiste ancora in 57. Nessuna azione ora; migrare al nuovo API in un secondo momento.
7. **expo-calendar (basso).** L'API originale è deprecata (warning a runtime): usare `expo-calendar/legacy` in `utils/calendar.ts` per ora.
8. **app.json.** Rimuovere `newArchEnabled` e `edgeToEdgeEnabled` (chiavi tolte in 55). `predictiveBackGestureEnabled` da riverificare con `expo-doctor`. Edge-to-edge Android è comunque obbligatorio (target API 36): controllare gli insets su Android.
9. **Nessun impatto atteso** (verificato via grep): `allowsFullscreen` (expo-video), `experimentalBlurMethod`, `addClipboardListener`, `removeSubscription`, `expo-av`, `@expo/vector-icons` non sono usati. Le API di expo-notifications che usiamo esistono ancora in 57 (verificato sui tipi).
10. **Dipendenze non importate da nessun file JS** (riducono superficie): `react-native-volume-manager`, `react-native-view-shot`, `expo-blur`, `expo-symbols`, `clsx`, `tailwind-merge`, `@react-navigation/elements`, `@react-navigation/native`, `@expo/vector-icons`. Da rimuovere prima della migrazione (peer da tenere: gesture-handler, screens, svg, worklets, system-ui, react-native-web/react-dom).
11. **Android:** non c'è un device Android. L'emulatore di Android Studio (gratis) copre notifiche, edge-to-edge e maps.
12. **iOS 16.4:** i telefoni fermi a iOS 15 (iPhone 6s/7) non potranno installare l'app. Il target include utenti anziani/poco digitali: decisione di prodotto da confermare.

## Piano

**Fase 0 — Baseline (su `main`, ~1h).**
- Tag `backup-pre-sdk57`. Verificare se esiste già un binario installato (TestFlight/APK) con runtimeVersion `1.0.0`.
- Rimuovere le dipendenze inutilizzate del punto 10 (commit separato, verifica: tsc + regressione + `npx expo export` + `pod install`).
- Baseline: `npx tsc --noEmit`, `npm run test:regression`, `npx expo-doctor`, `npx expo export --platform ios` e `android`, smoke Maestro (`npm run smoke:ios`, già presente in repo).

**Fase 1 — Branch `upgrade/expo-sdk-57` da `main` (il vecchio `upgrade/expo-sdk-55` è obsoleto).** Un commit per gradino, con gli stessi controlli a ogni gradino (tsc, eslint, regressione, `expo export` iOS+Android, `expo-doctor`):
- 54→55: chiavi app.json, `eas update --environment` (già usato negli script), nessun uso di API rimosse.
- 55→56: codemod router/react-navigation, `useBottomScreenInset`, iOS 16.4, fetch di Expo come default.
- 56→57: versioni della matrice, Sentry 8.x più recente, runtimeVersion `fingerprint`, riesame babel (reanimated/worklets).
- Nel branch aggiornare anche `.github/workflows` (eas-cli pin) e la doc.

**Fase 2 — Build nativa e test (sul tuo Mac, senza device).**
- `npx expo prebuild --clean` → `npx expo run:ios` (simulatore) e `npx expo run:android` (emulatore).
- Gate automatico: `npm run smoke:ios` (login, feed community, iscrizione attività).
- Matrice manuale minima, per ruolo: registrazione/login/reset password, iscrizione attività, candidatura ente, conferma presenze + XP + notifiche, segnalazione post/utente + inbox admin, chat, mappa/posizione, storie, deep link, push, calendario, foto profilo, tab bar/inset su Android.
- Da fare *prima di tutto il resto*: spike NativeWind (rischio 2).

**Fase 3 — Preview.** Build EAS `preview` dal branch (workflow Android esistente; iOS su device richiede Apple Developer Program), OTA sul canale `preview` isolato dal runtimeVersion, backend staging.

**Fase 4 — Merge.** Solo con Fase 2–3 verdi: merge su `main`, aggiornamento checklist prod, nuove build produzione. Il gate di rilascio store resta quello di `docs/prod-migration-checklist.md`.

**Fase 5 — SDK 58** (dopo la stabile, valutando Node 22 in CI, SceneDelegate iOS 27, rework router, R8): decisione separata.

## Cosa posso fare io / cosa serve da te

- Io: Fasi 0–1 (pruning, codemod, bump, fix di codice, tsc/eslint/regressione, `expo export`, aggiornamento doc) — in locale, senza push.
- Tu: Fase 2 (build simulatore/emulatore, Maestro, prove manuali), decisione iOS 16.4, eventuale Apple Developer Program per test su iPhone reale.
