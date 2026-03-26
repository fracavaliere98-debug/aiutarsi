# AiutarSi — Architettura Tecnica

Questo documento descrive l'architettura tecnica reale del progetto sulla base del codice presente nel repository. Va letto come riferimento operativo, non come documento di marketing.

## 1. Stack Principale

- App mobile: React Native con Expo SDK 54
- Routing: Expo Router con file-based routing
- UI: NativeWind + componenti custom + alcuni stili inline
- Stato e data fetching: combinazione di React Context e TanStack React Query
- Persistenza locale: AsyncStorage
- Backend: Supabase
  - PostgreSQL
  - Auth
  - Realtime
  - Storage
  - Edge Functions
- Build e release: EAS Build + EAS Update
- Test end-to-end: Maestro

Riferimenti:
- [package.json](/Users/francescocavaliere/aiutarsi/package.json)
- [app/_layout.tsx](/Users/francescocavaliere/aiutarsi/app/_layout.tsx)
- [providers/QueryProvider.tsx](/Users/francescocavaliere/aiutarsi/providers/QueryProvider.tsx)

## 2. Struttura Applicativa

L'app e organizzata per aree funzionali e ruoli:

- `app/(volunteer)`: flussi e schermate per volontari
- `app/(npo)`: flussi e schermate per enti
- `app/(corporate)`: area corporate
- `app/admin`: moderazione, segnalazioni, verifiche
- `components/`: libreria UI e blocchi funzionali
- `context/`: provider applicativi
- `services/`: logica di accesso dati e integrazione con Supabase
- `hooks/`: hook applicative e di integrazione
- `supabase/functions/`: Edge Functions server-side

L'architettura non e rigidamente a layer. Esiste un service layer, ma in diversi punti la UI interroga Supabase direttamente. Il pattern reale e quindi ibrido:

- `UI -> Context -> Service -> Supabase`
- `UI -> Supabase` in alcuni casi

## 3. Stato e Data Fetching

La gestione stato non e basata solo su React Query.

### Context applicativi

I provider principali sono:

- `AuthProvider`
- `ActivityProvider`
- `NotificationProvider`
- `ApplicationProvider`
- `GamificationProvider`
- `SmartMatchProvider`
- `ChatProvider`
- `CommunityProvider`
- `StoriesProvider`

Questi provider gestiscono stato globale, orchestrazione di flussi, side effect e routing.

### React Query

TanStack React Query e usato per caching, invalidazione e query asincrone in diverse aree, soprattutto:

- attivita
- candidature
- chat
- gamification

Quindi il modello corretto e:

- stato globale e flussi: Context
- caching, query e mutation: React Query

Riferimenti:
- [context/ActivityContext.tsx](/Users/francescocavaliere/aiutarsi/context/ActivityContext.tsx)
- [context/ApplicationContext.tsx](/Users/francescocavaliere/aiutarsi/context/ApplicationContext.tsx)
- [hooks/useChat.ts](/Users/francescocavaliere/aiutarsi/hooks/useChat.ts)

## 4. Persistenza Locale

`AsyncStorage` viene usato per:

- sessione locale e serializzazione utente
- cleanup auth/logout
- preferenze Smart Match
- stato onboarding
- piccoli flag e cache di supporto

Non emerge dal codice una vera architettura offline-first completa. E piu corretto parlare di persistenza locale di supporto, non di modalita offline/online avanzata.

Riferimenti:
- [services/AuthService.ts](/Users/francescocavaliere/aiutarsi/services/AuthService.ts)
- [services/SmartMatchPreferencesService.ts](/Users/francescocavaliere/aiutarsi/services/SmartMatchPreferencesService.ts)
- [utils/supabase.ts](/Users/francescocavaliere/aiutarsi/utils/supabase.ts)

## 5. Backend Supabase

Supabase e il backend centrale dell'app.

Funzioni principali:

- autenticazione utenti
- database relazionale
- storage file
- realtime per notifiche e aggiornamenti
- edge functions per AI e integrazioni server-side

### Tabelle rilevanti dal codice

Le entita usate in modo evidente nel repository includono:

- `profiles`
- `activities`
- `activity_participants`
- `applications`
- `npo_followers`
- `notifications`
- `volunteer_reviews`
- `reviews`
- tabelle relazionali per skill e interessi
- tabelle chat/conversazioni
- tabelle per verifiche NPO

La tabella `profiles` e l'entita utente centrale e discrimina i ruoli applicativi.

### RPC usate lato app

Dal codice risultano almeno queste procedure:

- `get_activities_near_me`
- `get_activities_with_match`

Riferimenti:
- [services/ActivityService.ts](/Users/francescocavaliere/aiutarsi/services/ActivityService.ts)
- [types/supabase.ts](/Users/francescocavaliere/aiutarsi/types/supabase.ts)

## 6. Service Layer

I servizi principali realmente presenti sono:

### AuthService

Responsabilita:

- login / registrazione
- lettura e persistenza utente locale
- self-healing del profilo se il record `profiles` manca
- update profilo
- gestione verifica NPO

Riferimento:
- [services/AuthService.ts](/Users/francescocavaliere/aiutarsi/services/AuthService.ts)

### ActivityService

Responsabilita:

- CRUD attivita
- query geolocalizzate
- matching
- gestione partecipanti
- notifiche collegate al ciclo di vita attivita
- review volontari

Riferimento:
- [services/ActivityService.ts](/Users/francescocavaliere/aiutarsi/services/ActivityService.ts)

### NPOService

Responsabilita:

- follower delle NPO
- candidature spontanee a enti

Riferimento:
- [services/NPOService.ts](/Users/francescocavaliere/aiutarsi/services/NPOService.ts)

### ChatService

Responsabilita:

- conversazioni private e di gruppo
- messaggi
- leave conversation
- moderazione minima chat
- avvio chat di gruppo collegate ad attivita

Riferimento:
- [services/ChatService.ts](/Users/francescocavaliere/aiutarsi/services/ChatService.ts)

### StorageService

Responsabilita:

- upload avatar
- upload immagini attivita
- upload asset community/stories
- upload documenti di verifica

Riferimento:
- [services/StorageService.ts](/Users/francescocavaliere/aiutarsi/services/StorageService.ts)

### GemmaService

Responsabilita:

- richieste AI per smart match explanation
- draft insight per NPO
- draft post community
- curation descrizioni attivita

Nota importante:
il naming storico usa "Gemma", ma l'infrastruttura AI reale e mista. Nel repo esistono edge functions e integrazioni che non vanno descritte semplicemente come un unico provider AI lato frontend.

Riferimento:
- [services/GemmaService.ts](/Users/francescocavaliere/aiutarsi/services/GemmaService.ts)

## 7. Edge Functions

Le Edge Functions presenti nel repository sono:

- `activity-curator-ai`
- `auth-hook`
- `community-moderator-ai`
- `gemma-help-assistant`
- `generate-embedding`
- `image-optimizer`
- `push-notifications`

Questo punto e importante perche amplia il quadro rispetto a una semplice descrizione "Gemma AI":

- esiste moderazione AI della community
- esiste generazione embedding
- esiste delivery push server-side
- esistono hook auth e ottimizzazione immagini

Riferimenti:
- [supabase/functions/activity-curator-ai/index.ts](/Users/francescocavaliere/aiutarsi/supabase/functions/activity-curator-ai/index.ts)
- [supabase/functions/gemma-help-assistant/index.ts](/Users/francescocavaliere/aiutarsi/supabase/functions/gemma-help-assistant/index.ts)
- [supabase/functions/generate-embedding/index.ts](/Users/francescocavaliere/aiutarsi/supabase/functions/generate-embedding/index.ts)
- [supabase/functions/push-notifications/index.ts](/Users/francescocavaliere/aiutarsi/supabase/functions/push-notifications/index.ts)

## 8. Integrazioni Esterne

Dal codice risultano in modo esplicito queste integrazioni:

- Supabase
- Expo Notifications
- Expo Location
- react-native-maps
- Google Generative AI SDK
- Expo Updates
- Maestro

La parte AI va descritta con cautela:

- lato mobile c'e `@google/generative-ai` come dipendenza
- lato server esistono piu edge functions AI
- alcuni audit del repo mostrano anche integrazioni con endpoint esterni lato function

Quindi la formulazione piu corretta e:

- "stack AI ibrido via Supabase Edge Functions, con naming storico Gemma/Gemini"

## 9. Flussi Applicativi Principali

### 9.1 Autenticazione e Profilazione

Flusso principale:

1. registrazione tramite Supabase Auth
2. creazione o recupero record `profiles`
3. completamento onboarding per volontari o NPO
4. persistenza locale del profilo utente

Esiste logica di self-healing lato auth per ricreare o riallineare il profilo quando manca.

### 9.2 Ciclo di Vita Attivita

Flusso reale ad alto livello:

1. NPO crea attivita
2. il sistema salva dettagli, coordinate, skill e metadati
3. il volontario cerca attivita tramite feed, geolocalizzazione o matching
4. il volontario entra nel flusso di candidatura/partecipazione
5. la NPO approva o rifiuta
6. vengono inviate notifiche e, in alcuni casi, viene avviata la conversazione di gruppo
7. a fine attivita si sbloccano review e punti impatto

### 9.3 Smart Match

Lo Smart Match non e solo un output LLM.

Il flusso reale e piu vicino a questo:

1. recupero attivita candidate via RPC e filtri
2. calcolo score e compatibilita lato backend/query
3. eventuale arricchimento narrativo tramite AI
4. rendering di motivazioni piu leggibili lato UI

Quindi e corretto distinguere:

- matching strutturato
- spiegazione AI del matching

### 9.4 Community e Stories

Esiste un sottosistema social con:

- post community
- stories
- draft AI per copy NPO
- moderazione

Riferimenti:
- [context/CommunityContext.tsx](/Users/francescocavaliere/aiutarsi/context/CommunityContext.tsx)
- [context/StoriesContext.tsx](/Users/francescocavaliere/aiutarsi/context/StoriesContext.tsx)

### 9.5 Chat

La messaggistica e parte dell'architettura principale, non secondaria.

Include:

- conversazioni private
- gruppi legati ad attivita
- pagine lista e dettaglio messaggi

Riferimenti:
- [app/messages/index.tsx](/Users/francescocavaliere/aiutarsi/app/messages/index.tsx)
- [app/messages/[id].tsx](/Users/francescocavaliere/aiutarsi/app/messages/[id].tsx)

### 9.6 Admin e Moderazione

Il repo contiene un'area admin con:

- gestione segnalazioni
- moderazione
- gestione richieste di verifica
- feedback/FAQ

Riferimenti:
- [app/admin/(tabs)/index.tsx](/Users/francescocavaliere/aiutarsi/app/admin/(tabs)/index.tsx)
- [app/admin/(tabs)/verifications.tsx](/Users/francescocavaliere/aiutarsi/app/admin/(tabs)/verifications.tsx)

### 9.7 Verifica NPO

La verifica NPO e oggi un flusso applicativo esplicito:

- upload documentazione
- creazione richiesta di verifica
- review admin
- approvazione o rifiuto con note
- notifiche alla NPO

Riferimenti:
- [components/npo/NPOVerificationFlow.tsx](/Users/francescocavaliere/aiutarsi/components/npo/NPOVerificationFlow.tsx)
- [app/admin/verification/[id].tsx](/Users/francescocavaliere/aiutarsi/app/admin/verification/[id].tsx)

## 10. Notifiche e Realtime

Le notifiche sono una capability strutturale dell'app:

- tabella `notifications`
- contesto applicativo dedicato
- supporto foreground e push
- edge function server-side per push
- realtime Supabase per aggiornare l'interfaccia

Riferimenti:
- [context/NotificationContext.tsx](/Users/francescocavaliere/aiutarsi/context/NotificationContext.tsx)
- [hooks/usePushNotifications.ts](/Users/francescocavaliere/aiutarsi/hooks/usePushNotifications.ts)

## 11. Sicurezza, Secret e Configurazione

### Lato frontend

Nel client risultano esposti solo valori pubblici compatibili con il modello Supabase:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Questo e accettabile solo se le policy RLS e le autorizzazioni lato backend sono corrette.

### Lato server

Le integrazioni sensibili devono vivere in:

- Supabase secrets per Edge Functions
- EAS secrets
- GitHub Actions secrets

Il repository contiene documentazione operativa su credenziali e pipeline, ma non deve essere considerato garanzia formale che tutti i secret siano configurati correttamente in ogni ambiente.

Riferimenti:
- [README.md](/Users/francescocavaliere/aiutarsi/README.md)
- [app.json](/Users/francescocavaliere/aiutarsi/app.json)

## 12. Osservazioni Architetturali

### Punti forti

- stack coerente per una mobile app Expo moderna
- Supabase usato in modo esteso e pragmatico
- buon numero di servizi dedicati
- presenza di area admin, chat, notifiche, community e AI
- React Query gia integrato nelle aree piu sensibili a cache e invalidazioni

### Debolezze o aree ibride

- separazione UI / service / backend non uniforme
- mix tra Context e React Query non sempre standardizzato
- naming storico AI non sempre allineato all'infrastruttura reale
- molta logica di business distribuita tra context, servizi e schermate

### Formula sintetica corretta

Una descrizione architetturale piu aderente al repo oggi e:

> AiutarSi e una mobile app React Native/Expo basata su Supabase, con architettura frontend ibrida tra Context e React Query, service layer pragmatico ma non esclusivo, funzionalita social/chat/admin, e un sottosistema AI orchestrato via Supabase Edge Functions.

