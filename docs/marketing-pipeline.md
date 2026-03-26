# Marketing Pipeline: App -> Spline

Questa pipeline serve a trasformare schermate reali di AiutarSi in animazioni 3D riutilizzabili per:

- ads Meta / TikTok / Reels
- teaser in-app
- landing page marketing
- screenshot motion per presentazioni
- mini video da 5 a 8 secondi

## Obiettivo

Usare schermate vere dell'app come contenuto dello schermo del device 3D in Spline, mantenendo una pipeline consistente e veloce.

## Struttura file

```text
assets/marketing/
  screens/
  exports/
```

- `screens/`: PNG grezzi catturati dall'app
- `exports/`: MP4 o PNG sequence esportati da Spline

## Frame attivi in questa fase

I frame target sono definiti in `utils/marketingFrames.ts`.

I tre frame prioritari attivi adesso sono:

1. Community volontario con Gemma
2. Onboarding intro
3. Centro notifiche

## Flusso operativo

1. Apri `app/dev/marketing-capture.tsx`
2. Scegli il frame da preparare
3. Verifica il preview
4. Usa `Esporta PNG automatico`
5. Il file viene salvato localmente nella document directory, in `marketing/screens/`
6. Copia il filename suggerito
7. Importa il PNG in Spline
8. Applica il PNG al materiale dello schermo del device 3D
9. Esporta:
   - MP4 per adv
   - PNG sequence per montaggio in Jitter / Premiere

## Export automatico in app

La schermata dev usa `react-native-view-shot` per esportare i preview direttamente dall'app.

Questo non sostituisce ancora un sistema batch completo, ma permette già di:

- generare PNG consistenti
- mantenere naming uniforme
- ridurre errori manuali

## Scene Spline consigliate

### `hero-device`

Usa questa scena per:

- singolo iPhone
- headline forte
- ads verticali 9:16
- landing hero

Direzione:

- camera lenta
- leggera rotazione
- sfondo chiaro atmosferico
- ombre morbide

### `stack-devices`

Usa questa scena per:

- storytelling multi-screen
- caroselli
- dettaglio attività + community
- creatività comparative

Direzione:

- 2 o 3 device sfalsati
- layering morbido
- profondità bassa

## Export consigliati

- `1080x1920` per Stories / Reels / TikTok
- `1080x1350` per feed verticale
- `1080x1080` per square

Durate:

- `6-10s` per ad
- `2-4s loop` per uso in app

## Mini video

Le specifiche video sono definite in `utils/marketingFrames.ts` tramite `marketingVideoSpecs`.
Il manifest operativo per gli output è in `assets/marketing/videos/manifest.json`.

I mini video attivi in questa fase sono:

1. `community_hook_6s_v1.mp4`
2. `onboarding_brand_8s_v1.mp4`
3. `notifications_loop_5s_v1.mp4`

Ogni mini video include:

- durata
- preset scena consigliato
- frame sorgente
- shotlist testuale

La shotlist si copia direttamente da `marketing-capture`.

## Spline senza AI

Non è necessario usare Spline AI per questa pipeline.

Workflow consigliato:

1. crea o duplica un template device in Spline
2. importa lo screenshot PNG reale
3. applica il PNG come texture dello schermo
4. anima camera, rotazione e profondità a mano
5. esporta MP4

Questo evita il costo dell'AI add-on e rende il risultato più controllabile.

Storyboard iniziale pronto:

- `docs/spline-storyboard-community.md`
- `docs/spline-storyboard-onboarding.md`
- `docs/spline-storyboard-notifications.md`
- `docs/spline-checklist.md`

## Uso in app

Per l'app Expo non usare Spline live come runtime principale.

Strategia consigliata:

1. crea l'animazione in Spline
2. esporta video
3. usa `expo-video` per riprodurre l'asset in app

Questo riduce rischio, peso runtime e problemi cross-platform.

## Nota tecnica

In questa fase il repo include un export automatico dei preview marketing, ma non ancora un recorder video in-app. La schermata dev serve a:

- standardizzare il naming
- esportare PNG consistenti
- allineare il lavoro tra design, prodotto e marketing

Se in una seconda fase vogliamo automatizzare anche i mini video, il passo successivo sarà introdurre una pipeline di frame sequence o recorder dedicato per clip marketing.
