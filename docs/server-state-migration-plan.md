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

## Dominio reference: Activities

`activities` e il dominio di riferimento per i refactor successivi.

Il pattern da riusare e:

- query keys centralizzate
- query hooks di dominio
- mutation hooks di dominio
- selector hooks per dati derivati condivisi
- adapter paginato sottile senza stato proprio
- nessun context bridge legacy

In pratica:

- source of truth canonica = React Query
- `useActivities` resta solo un adapter paginato su `useInfiniteQuery`
- il dettaglio usa sempre `useActivityDetailQuery(activityId)` come fonte primaria
- le mutazioni passano solo da hook dedicati e invalidano le query corrette
- nessun Context possiede piu dati activity canonici

## Principi operativi per i domini

### Dato canonico fuori dal Context

Il Context non puo possedere dati canonici backend del dominio.

Per `activities`, questo significa in modo esplicito:

- `ActivityContext` non possiede la lista canonica delle activity
- `ActivityContext` non possiede il detail canonico di una activity
- `ActivityContext` non possiede i participants canonici
- `ActivityContext` non possiede pagination items canonici

Se il Context resta temporaneamente, puo fare solo orchestrazione non canonica:

- trigger UI globali
- side effects coordinati
- compat layer temporaneo dei consumer

Ma non puo diventare una seconda cache del dominio.

### Detail query come fonte primaria

Le schermate dettaglio devono avere una regola netta:

- il detail usa sempre una query dedicata come fonte primaria
- eventuale dato proveniente dalla lista puo essere usato solo come `initialData` o `placeholderData`
- il dato lista non puo restare una seconda source of truth del detail

Per `activities`, questo vale in particolare per:

- `app/activity/[id].tsx`

Quindi:

- `useActivityDetailQuery(activityId)` deve essere la fonte primaria del dettaglio
- eventuale dato gia presente nella lista puo solo migliorare il first paint
- non puo decidere da solo il valore canonico mostrato dalla schermata

### Mutations: una sola scrittura canonica

Le mutazioni non possono aggiornare sia Query sia Context come doppia scrittura canonica.

Regola:

- default = mutation server-side + invalidation query
- patch manuale della cache solo se davvero giustificata
- Context non riceve scritture canoniche dalla mutation

Quindi non sono ammessi pattern del tipo:

- mutation che aggiorna React Query
- e in parallelo `setState` canonico nel Context

Se serve stato locale ottimistico, deve essere:

- esplicito
- limitato
- separato dal dato canonico

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

### Vincolo temporaneo sul NotificationContext

Finche esiste, `NotificationContext` e un bridge temporaneo di UI/orchestration.

- non puo contenere stato canonico delle notifiche
- i dati arrivano solo da React Query
- non puo reintrodurre cache locale duplicata
- puo restare solo per:
  - foreground toast
  - routing al tap
  - bridge Expo push response
  - compatibilita temporanea dei consumer

Quando i consumer saranno migrati ai query/mutation hooks del dominio, `NotificationContext` andra rimosso.

## Preparazione dominio: Activities

### Obiettivo architetturale

- `activities list` in Query
- `activity detail` in Query
- `activity participants` in Query o derivati dalla query detail/list coerente
- `activity applications` in Query
- `reviews` e `volunteer reviews` in Query
- paginazione canonica gestita da Query, non dal Context

### Regole specifiche

- `app/activity/[id].tsx` usa `useActivityDetailQuery(activityId)` come fonte primaria
- il dato proveniente dalla lista puo essere solo `initialData` o `placeholderData`
- `ActivityContext` non puo mantenere fallback locali come fonte primaria del detail
- le mutazioni `create/update/delete/enroll/unenroll/apply/review` non possono scrivere sia su Query sia su Context
- `EventEmitter` e listener equivalenti devono invalidare query, non riscrivere cache canonica nel Context

### Done criteria: Activities

- nessuna lista activity canonica in Context
- nessun detail activity canonico in Context
- nessun participants state canonico in Context
- nessun pagination items state canonico in Context
- `useActivityDetailQuery(activityId)` e la fonte primaria del dettaglio
- create/update/delete/enroll/unenroll/apply/review usano mutation hooks del dominio
- invalidation coerente di:
  - activities list
  - activity detail
  - activity applications
  - reviews
  - volunteer reviews
- nessuna schermata legge una seconda source of truth del detail

### Stato: Activities = Done

Il dominio `activities` e considerato chiuso quando risultano veri tutti questi punti:

- nessun consumer di `ActivityContext`
- nessun provider legacy `ActivityProvider`
- nessuna lista canonica fuori da Query
- paginazione solo via `useActivities`
- mutazioni solo via hook dedicati
- `lint` e `tsc` verdi
- smoke staging `activity-refactor-smoke` verde
- verifica runtime `preview` verde

Nota:

- finche la verifica runtime manuale in `preview` non e conclusa, il dominio e architetturalmente chiuso ma in attesa di validazione finale

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

## Dominio corrente: Applications

`applications` e il dominio attualmente pronto per la validazione in `preview`.

Motivo:

- aveva un bridge attivo in `ApplicationContext`
- i consumer usavano soprattutto helper di convenienza
- gli stati canonici sono chiari:
  - `PENDING`
  - `APPROVED`
  - `REJECTED`
- il dominio e abbastanza isolato da poter essere migrato senza toccare subito feed/chat

### Obiettivo architetturale

- lista candidature in Query
- selector per:
  - candidature volunteer
  - candidature NPO
  - `hasAppliedToNPO`
- mutazioni dedicate per:
  - apply to NPO
  - approve
  - reject
- nessun dato canonico applicazioni in Context

### Pattern target

- `applicationKeys`
- `queries.ts`
- `mutations.ts`
- `selectors.ts`
- niente `ApplicationContext`

### Cluster consumer principali

- Gruppo A: liste e dashboard NPO
  - [app/(npo)/(tabs)/index.tsx](/Users/francescocavaliere/aiutarsi/app/(npo)/(tabs)/index.tsx)
  - [app/(npo)/(tabs)/volunteers.tsx](/Users/francescocavaliere/aiutarsi/app/(npo)/(tabs)/volunteers.tsx)
  - [app/(npo)/report.tsx](/Users/francescocavaliere/aiutarsi/app/(npo)/report.tsx)
  - [app/(npo)/settings/index.tsx](/Users/francescocavaliere/aiutarsi/app/(npo)/settings/index.tsx)
- Gruppo B: profili e affiliazioni
  - [app/(npo)/volunteer-profile/[id].tsx](/Users/francescocavaliere/aiutarsi/app/(npo)/volunteer-profile/[id].tsx)
  - [app/(volunteer)/(tabs)/profile.tsx](/Users/francescocavaliere/aiutarsi/app/(volunteer)/(tabs)/profile.tsx)
  - [app/npo-profile/[id].tsx](/Users/francescocavaliere/aiutarsi/app/npo-profile/[id].tsx)
- Gruppo C: mutation entry points
  - [app/(volunteer)/review-application.tsx](/Users/francescocavaliere/aiutarsi/app/(volunteer)/review-application.tsx)
  - [app/(npo)/(tabs)/volunteers.tsx](/Users/francescocavaliere/aiutarsi/app/(npo)/(tabs)/volunteers.tsx)
- Gruppo D: derived insights e community
  - [hooks/useNPOInsights.ts](/Users/francescocavaliere/aiutarsi/hooks/useNPOInsights.ts)
  - [components/community/NPOCommunityScreen.tsx](/Users/francescocavaliere/aiutarsi/components/community/NPOCommunityScreen.tsx)
  - [components/community/VolunteerCommunityScreen.tsx](/Users/francescocavaliere/aiutarsi/components/community/VolunteerCommunityScreen.tsx)

### Done criteria: Applications

- nessun consumer legge applicazioni canoniche da `ApplicationContext`
- nessun helper canonico tipo `getVolunteerApplications` o `getNPOApplications` resta nel bridge
- `hasAppliedToNPO` diventa selector puro basato su Query
- mutazioni `apply/approve/reject` usano solo hook dedicati
- nessuna doppia scrittura Query + Context
- `lint` e `tsc` verdi
- smoke staging del dominio verde
- verifica runtime `preview` verde

### Stato: Applications = Architetturalmente pronto

Il dominio `applications` e considerato architetturalmente pronto quando risultano veri tutti questi punti:

- nessun consumer di `ApplicationContext`
- nessun provider legacy `ApplicationProvider`
- nessuna lista canonica candidature fuori da Query
- selector `useNPOApplications`, `useVolunteerApplications` e `useHasAppliedToNPO` usati al posto degli helper del bridge
- mutazioni `apply/approve/reject` passano solo dai mutation hook dedicati
- `lint` e `tsc` verdi
- smoke staging `application-refactor-smoke` verde
- verifica runtime `preview` da completare

### Checklist di verifica: Applications

- lista candidature volunteer coerente
- lista candidature NPO coerente
- `hasAppliedToNPO` coerente tra card, profilo ente e detail
- `apply to NPO`
- `approve`
- `reject`
- coerenza tra dashboard NPO, tab volontari, profilo volunteer e report
- foreground/background
- resume app
- assenza di drift tra query hooks e selector hooks

## Playbook riusabile per ogni dominio

Questo playbook va riutilizzato per `activities`, `applications`, `community`, `smart match`, `gamification`, `chat` e ogni dominio futuro. Il metodo deve restare stabile; cambia solo la mappa specifica del dominio.

### Step 1: freeze del Context

Se il dominio ha ancora un Context:

- dichiararlo esplicitamente come `compatibility bridge temporaneo`
- vietare nuovo stato canonico
- vietare nuova paginazione canonica
- vietare nuove business mutations nel Context
- consentire solo:
  - orchestration strettamente necessaria
  - derived/UI state strettamente necessario
  - bridge temporaneo dei consumer legacy

Obiettivo:

- impedire che il Context ricresca mentre il refactor e in corso

### Step 2: classificazione consumer per pattern

Prima di migrare i file, classificare i consumer per cluster di comportamento.

Cluster standard:

- Gruppo A: leggono solo liste canoniche
- Gruppo B: leggono derived values / aggregazioni
- Gruppo C: leggono lista + filtri + paginazione
- Gruppo D: usano helper del Context per convenienza
- Gruppo E: entry point critici o detail screens

Obiettivo:

- migrare per pattern coerenti, non in ordine casuale file-per-file

### Step 3: dominio Query completo

Per ogni dominio creare:

- `keys.ts`
- `queries.ts`
- `mutations.ts`
- `selectors.ts` se servono aggregazioni condivise
- `hooks.ts` solo se serve comporre piu hook

Regole:

- query keys centralizzate
- invalidation coerente
- una sola source of truth per i dati canonici

### Step 4: entry point critici

I detail screen o entry point critici vanno migrati presto.

Regola:

- il detail usa sempre una query primaria dedicata
- eventuale dato da lista puo essere solo `initialData` o `placeholderData`

### Step 5: mutazioni

Le mutazioni vanno spostate su mutation hooks del dominio.

Regola:

- niente doppia scrittura canonica Query + Context
- default = invalidation
- patch manuale solo se documentata e necessaria

### Step 6: paginazione

Se il dominio ha paginazione legacy in Context o in stato locale non canonico, questa e la priorita architetturale successiva.

Done criteria dello step paginazione:

- nessun `items/page/hasMore/isLoadingMore/offset` canonico nel Context
- tutte le schermate lista usano lo stesso meccanismo di paging
- nessun merge manuale di pagine nel Context

### Step 7: cluster residui

Migrare i cluster residui in questo ordine:

1. Gruppo C: lista + filtri + paginazione
2. Gruppo A: liste semplici
3. Gruppo B: aggregazioni / selector
4. Gruppo D: helper convenience

### Step 8: verifiche runtime

Non basta `lint` e `tsc`.

Checklist runtime standard per ogni dominio:

- lettura:
  - lista da ogni entry point
  - detail da lista
  - detail da accesso diretto / deep link se applicabile
  - coerenza tra card e detail
- mutazioni:
  - create / edit / delete se applicabili
  - azioni principali del dominio
- sincronizzazione:
  - invalidation dopo mutation
  - coerenza lista/detail dopo mutation
  - background/foreground
  - resume app
  - pull-to-refresh se presente
- paginazione:
  - load more
  - refresh + paginazione
  - filtri + paginazione
  - nessun duplicato
  - nessun salto record
- ruoli:
  - tutti i ruoli che consumano il dominio

### Step 9: target finale del Context

Per ogni dominio chiedersi esplicitamente:

- il Context puo sparire del tutto?

Target preferito:

- rimuovere il Context

Target accettabile solo temporaneo:

- bridge minimo, senza dati canonici

## Note

- La migrazione SDK 55 e separata e non va mischiata con questo refactor.
- Finche il refactor per domini e in corso, `preview` deve restare su SDK 54.

## Cluster attuali: Activities

### Gruppo A — leggono solo liste canoniche

- `app/(corporate)/catalog.tsx`
- `app/community/create-post.tsx`

### Gruppo B — leggono derived values / aggregazioni

- `app/(npo)/reviews.tsx`
- `app/(npo)/volunteer-profile/[id].tsx`
- `app/(volunteer)/my-reviews.tsx`
- `app/npo-profile/[id].tsx`

### Gruppo C — leggono lista + filtri + paginazione

- `app/(volunteer)/(tabs)/calendar.tsx`
- `app/(volunteer)/(tabs)/community.tsx`
- `app/(volunteer)/(tabs)/search.tsx`

### Gruppo D — usano helper del Context per convenienza

- `app/(volunteer)/settings.tsx`

### Gruppo E — entry point critici o detail screens

Gia migrati o quasi migrati:

- `app/activity/[id].tsx`
- `app/(npo)/create-activity.tsx`
- `app/(npo)/edit-activity/[id].tsx`
- `app/(volunteer)/review-application.tsx`
- `app/feedback/[id].tsx`
- `app/(npo)/review-volunteers/[id].tsx`
- `app/(npo)/(tabs)/volunteers.tsx`
- `app/(volunteer)/(tabs)/index.tsx`
- `app/(volunteer)/(tabs)/profile.tsx`
- `app/(volunteer)/report.tsx`
- `app/(npo)/(tabs)/index.tsx`
- `app/(npo)/(tabs)/projects.tsx`
- `app/(npo)/report.tsx`
- `hooks/useNPOInsights.ts`

### Priorita operativa corrente per Activities

1. congelare ufficialmente `ActivityContext`
2. rimuovere la paginazione legacy dal Context
3. migrare il Gruppo C
4. migrare Gruppo A e Gruppo B
5. lasciare Gruppo D per ultimo o eliminarne direttamente il bisogno
