# Server State Migration Plan

Questo documento definisce la convenzione architetturale e il piano operativo per migrare progressivamente lo stato server verso React Query, partendo da `preview` su SDK 54.

## Baseline di partenza

- Branch di lavoro applicativo: `main`
- Baseline `preview` corrente:
  - update group `a71c1862-4f61-4ed2-a5db-c16abaa19ddc`
  - messaggio `Reset preview to SDK54 stable before domain migration`
  - commit `5321f3a`
- Backup Git:
  - `backup-pre-domain-migration-main-2026-04-10`
  - `backup-pre-sdk55-main-2026-04-10`
- Backup database:
  - `backups/prod-schema-2026-04-10.sql`
  - `backups/prod-data-2026-04-10.sql`
  - `backups/staging-schema-2026-04-10.sql`
  - `backups/staging-data-2026-04-10.sql`

## Fase 0: regole comuni

Queste regole vanno applicate prima del primo refactor di dominio.

```ts
// Source of truth rules
// 1. Server state lives in React Query
// 2. Context is only for app orchestration and ephemeral global UI state
// 3. Realtime never writes canonical state into Context
// 4. AsyncStorage never stores canonical backend entities
// 5. Every domain exposes query hooks + mutation hooks
// 6. Realtime defaults to query invalidation, not manual cache patching
// 7. Manual cache patches are allowed only when explicitly justified
// 8. Query keys are centralized per domain and reused everywhere
// 9. Each domain has exactly one source of truth for canonical data
```

## Decisioni operative

- Nessun "Context wrapper di funzioni" se non aggiunge vera orchestrazione.
- Preferire:
  - `keys.ts`
  - `queries.ts`
  - `mutations.ts`
  - `hooks.ts` solo se serve comporre piu hook
- Realtime:
  - default = `invalidateQueries`
  - patch cache solo se c'e un motivo chiaro e documentato
- AsyncStorage:
  - solo preferenze locali
  - draft locali
  - piccoli flag persistenti
  - mai entita backend canoniche

## Convenzione query keys

Le query keys devono essere centralizzate per dominio e riutilizzate ovunque.

Esempio:

```ts
export const notificationKeys = {
  all: ['notifications'] as const,
  list: (userId: string) => [...notificationKeys.all, 'list', userId] as const,
  unreadCount: (userId: string) => [...notificationKeys.all, 'unread-count', userId] as const,
};
```

Regole:

- includere sempre il `userId` quando il dato e user-scoped
- usare key stabili, non oggetti anonimi non normalizzati
- ogni invalidazione deve passare dalle key centralizzate del dominio

## Ordine di migrazione dei domini

1. `notifications`
2. `activities`
3. `applications`
4. `community`
5. `smart match`
6. `gamification`
7. `chat`
8. `altro`

## Done criteria globali

Un dominio si considera migrato quando:

- esiste una sola source of truth per i dati canonici
- il dato canonico vive in React Query
- Context non possiede copie canoniche dello stesso dato
- Realtime non scrive direttamente in Context il dato canonico
- AsyncStorage non salva entita backend canoniche del dominio
- il dominio espone query hooks e mutation hooks coerenti
- i flussi principali sono stati verificati in `preview`

## Fase 1: Notifications

### Obiettivo

Spostare la gestione canonica delle notifiche da `NotificationContext` a React Query, mantenendo eventuali effetti UI solo dove servono davvero.

### Target architetturale

- lista notifiche in Query
- unread count in Query o derivato coerente dalla cache Query
- mutation dedicate:
  - `markAsRead`
  - `markAllAsRead`
  - `clearAll`
- realtime usato per invalidare o aggiornare in modo controllato la cache Query
- routing al tap e foreground toast preservati

### Done criteria: Notifications

- nessuna lista notifiche canonica in Context
- nessun unread count canonico duplicato in `useState` separato
- `NotificationContext`, se resta, gestisce solo orchestrazione UI non canonica
- realtime non fa `setState` canonico nel Context
- tutte le query usano query keys centralizzate del dominio
- `AsyncStorage` non contiene notifiche canoniche
- badge, lista e dettaglio risultano coerenti

### Checklist di verifica: Notifications

- login
- logout
- login con utente diverso
- riapertura app con sessione persistita
- foreground/background
- nuova notifica via realtime
- `mark as read`
- `mark all as read`
- routing corretto su:
  - activity
  - chat
  - candidature
  - profilo NPO
- coerenza tra badge, lista e dettaglio

## Workflow dominio per dominio

Per ogni dominio:

1. creare un tag Git di backup
2. eseguire il refactor su `main`
3. pubblicare un OTA `preview` dedicato
4. verificare il dominio in `preview`
5. passare al dominio successivo solo dopo validazione

## Note

- La migrazione SDK 55 e separata e non va mischiata con questo refactor.
- Finche il refactor per domini e in corso, `preview` deve restare su SDK 54.
