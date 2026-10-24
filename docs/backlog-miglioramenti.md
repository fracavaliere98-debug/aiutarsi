# Backlog miglioramenti

Punti segnalati e non ancora affrontati: solo da verificare/valutare, non
implementati (salvo dove indicato). Ogni voce ha una checkbox e la data in
cui è stata annotata; quando si passa all'implementazione, spostare il punto
nel piano/doc pertinente (o in una issue) e rimuoverlo da qui.

## 2026-09-22

- [x] **Gemma — accesso a documentazione aggiornata. VERIFICATO 2026-09-22:
  no, è statica e datata (FATTO: risolto lo stesso giorno, vedi sotto).** Il
  contesto passato a Gemma (`supabase/functions/gemma-help-assistant/index.ts`)
  viene costruito da `buildHelpCenterContextForRole()` in `shared/helpCenterContent.ts`
  — un elenco di FAQ scritte a mano nel codice, non collegato a nessuna fonte
  di documentazione live (non legge `docs/`, non fa retrieval, nessun
  aggiornamento automatico). Ultima modifica a quel file prima di oggi: 31
  marzo 2026 (commit `8d8b9eb`) — quasi 6 mesi, mentre nel frattempo era
  arrivata la conferma presenza/XP (migration `20260921150000_attendance_confirmation.sql`).

  **FATTO 2026-09-22**: aggiunte le FAQ sulla conferma presenza (volontario:
  perché vede "In attesa conferma"; NPO: come confermare) in
  `shared/helpCenterContent.ts`. Soprattutto, aggiunto un meccanismo che rende
  l'aggiornamento non più opzionale: `HELP_CENTER_LAST_REVIEWED` (costante in
  testa al file) più un nuovo contract test,
  `scripts/test_help_center_freshness_contract.ts`, dentro
  `npm run test:regression` (quindi nella Definition of Done). Il test
  confronta quella data con la migration Supabase più recente nel repo: se la
  data non è aggiornata, la regression suite FALLISCE con un messaggio che
  dice esattamente cosa fare. Non è un promemoria che si può ignorare in
  silenzio — è un gate meccanico eseguito ad ogni "Done". Limite onesto: il
  test forza a *rivedere* il file quando cambia qualcosa, non garantisce che
  il contenuto scritto sia sempre corretto (quello resta un giudizio umano).

- [x] **Reminder conferma presenza — CTA per il volontario. FATTO
  2026-09-22** (ok esplicito dato dall'utente in chat lo stesso giorno,
  insieme al punto 72h sotto — cambio di comportamento visibile a
  NPO/volontari, come richiesto dalla regola di progetto). Nella schermata
  attività, nel box "In attesa conferma" (`app/activity/[id].tsx`, ramo
  `isWaitingPresenceConfirmation`) è stato aggiunto un bottone "Invia
  promemoria all'ente" che chiama la nuova RPC
  `request_attendance_confirmation_reminder(activity_id)` (migration
  `20260922100000_attendance_auto_confirm_and_reminder.sql`, applicata su
  **staging**, non ancora su produzione). La RPC verifica che il chiamante
  sia davvero un iscritto in attesa su quell'attività e inserisce una
  notifica `ATTENDANCE_REMINDER` alla NPO, con un cooldown di 24h per
  attività (non per singolo volontario, per evitare spam se più volontari la
  usano lo stesso giorno) — ritorna un codice testuale (`sent` /
  `already_sent_recently` / `already_confirmed` / `not_a_participant` /
  `activity_not_completed`) mappato in altrettanti messaggi `showToast` per
  l'utente, mai un `Alert.alert` (convenzione feedback UI del progetto).
  Service layer: `ActivityService.requestAttendanceConfirmationReminder()` +
  hook `useRequestAttendanceReminderMutation()` in
  `hooks/activities/mutations.ts`.

  - [x] **Verificato 2026-09-22: NO, non esisteva nessuna regola di
    auto-conferma dopo 72h — IMPLEMENTATA lo stesso giorno.** In
    `supabase/migrations/20260921150000_attendance_confirmation.sql` solo la
    NPO proprietaria poteva impostare `volunteer_reviews.is_present = true`
    (trigger `guard_volunteer_review_attendance`, security definer, nessun
    bypass lato client): nessun cron, nessun trigger a tempo, quindi un
    volontario non confermato restava senza XP/ore/badge a tempo indefinito.
    Aggiunta la funzione `auto_confirm_stale_attendance()` (migration
    `20260922100000_attendance_auto_confirm_and_reminder.sql`, cron orario
    `auto-confirm-stale-attendance-hourly`, applicata su **staging**): per le
    attività `COMPLETATA` da più di 72h, i partecipanti che non hanno ancora
    **nessuna** riga in `volunteer_reviews` (la NPO non si è mai espressa, né
    presente né assente — chi è stato segnato assente dalla NPO NON viene
    toccato) vengono confermati presenti con `confirmed_by = 'auto'`. La
    guardia esistente forza `confirmed_by = 'npo'` in ogni altro caso, anche
    se un client lo mandasse esplicitamente — solo il cron, tramite un flag
    di sessione (`set_config`), può scrivere `'auto'`. Vedi voce di Decision
    Log in fondo a questo file per il ragionamento su "che motivazione ha la
    NPO di confermare, allora?" e su come si è deciso di tracciare/mostrare
    la distinzione npo/auto.
  - [x] **Verificato 2026-09-22: SÌ, esiste già.** `hooks/useNPOInsights.ts`
    genera un insight `type: 'ATTENDANCE'` con **priorità 1** (la più alta)
    quando ci sono attività `COMPLETATA` con presenze non confermate ("Conferma
    le presenze ✅" → naviga a `/(npo)/review-volunteers/:id`). È montato in
    `app/(npo)/(tabs)/index.tsx` tramite `<InsightCarousel />`, quindi visibile
    in home NPO. Nota: lo stato "silenziato" (`dismissInsight`) è solo in
    memoria (`useState`, non persistito) e l'insight viene ricalcolato dal
    dato live ad ogni render — quindi non è possibile farlo sparire in modo
    permanente finché la conferma resta pendente. C'è anche una notifica
    separata (tabella `notifications`, tipo `ACTIVITY_COMPLETED`, "Conferma le
    presenze") inserita dal trigger `notify_participants_on_activity_change`
    a fine attività.

- [x] **Tracciamento e visibilità conferma npo/auto — FATTO 2026-09-22.**
  Aggiunta la colonna `volunteer_reviews.confirmed_by` (`'npo'` di default |
  `'auto'`, scrivibile solo dal cron — vedi punto 72h sopra). Resa visibile in
  app su richiesta esplicita dell'utente (non solo tracciamento interno): su
  `components/ActivityCard.tsx` (la card condivisa, usata in 7 schermate sia
  volontario che NPO — non la `EnrolledActivityCard.tsx`, risultata codice
  morto, non importata da nessuna schermata), quando il volontario loggato ha
  una presenza confermata su un'attività `COMPLETATA`, in alto a destra sulla
  card compare una piccola icona pollice in su: **verde** se `confirmed_by !==
  'auto'` (conferma diretta della NPO), **grigia** se `confirmed_by === 'auto'`
  (scattata da sola dopo 72h). Al tocco mostra una spiegazione via `showToast`
  (mai `Alert.alert`, per coerenza con la convenzione feedback UI). La card
  legge il dato da `useVolunteerReviewsQuery()` (già cache-condivisa da React
  Query, nessun prop nuovo da passare nei 7 punti di utilizzo).

## Lavoro futuro (solo annotato, non implementato)

- **Reputazione NPO.** Segnalato dall'utente il 2026-09-22 come idea per il
  futuro, non da implementare ora: un punteggio/indicatore di reputazione per
  ogni NPO basato sul suo comportamento in app. Input menzionati
  esplicitamente dall'utente: se confermano le presenze o lasciano che
  scattino in automatico dopo 72h (ora misurabile grazie a `confirmed_by`,
  vedi sopra), recensioni ricevute, numero di attività organizzate, numero di
  volontari coinvolti, numero di follower, segnalazioni ricevute (tabella
  `reports`, già esistente per altri scopi). Nessun disegno di schema o UI
  ancora fatto: da riprendere come una vera epic (discovery completa, non un
  fix) quando si deciderà di affrontarla — coinvolge scelte di prodotto
  (cosa pesa quanto, se mostrarla pubblicamente o solo internamente/agli
  admin) più che tecniche.

## Decision Log

### 2026-09-22 — Auto-conferma presenza dopo 72h + visibilità npo/auto

**Contesto.** La conferma presenza (migration `20260921150000`) richiede
un'azione attiva della NPO senza scadenza: se la NPO non risponde, il
volontario resta indefinitamente senza XP/ore/badge/possibilità di
recensire — un problema reale per l'esperienza volontario, aggravato dal
fatto che target dell'app includono utenti che potrebbero non capire perché
sono "bloccati". L'utente ha fatto notare durante la discussione un problema
consequente: se dopo 72h la presenza viene comunque confermata in automatico,
quale motivazione resta alla NPO per confermare attivamente?

**Opzioni considerate per la visibilità della distinzione npo/auto:**
1. Tracciare `confirmed_by` solo internamente (nessuna UI) — proposta
   inizialmente da Claude come opzione più conservativa in attesa di
   validazione.
2. Tracciare e mostrare in modo neutro/testuale (es. un tag "auto" nella
   lista recensioni).
3. Tracciare e mostrare in modo visivamente immediato sulla card attività —
   scelta dall'utente: icona pollice in su, verde se confermata dalla NPO,
   grigia se confermata in automatico, in alto a destra sulla card.

**Scelta:** opzione 3. Motivazione esplicita dell'utente: rendere visibile la
differenza è ciò che dà alla NPO un incentivo reale a confermare
attivamente (la conferma automatica è un fallback per il volontario, non una
funzione equivalente per la NPO) — coerente con l'idea, annotata come lavoro
futuro, di una reputazione NPO che userebbe proprio questo dato come input.

**Trade-off/limiti accettati:**
- La conferma automatica presume sempre presenza (`is_present = true`): non
  può in alcun modo sostituire una NPO che segna attivamente degli assenti —
  se la NPO non fa nulla, tutti i non ancora segnati vengono confermati
  presenti, il che è il comportamento desiderato (dare comunque XP al
  volontario) ma non equivale a "verificare" la presenza reale.
  - Il cron è orario (`cron.schedule('auto-confirm-stale-attendance-hourly',
    '0 * * * *', ...)`), quindi lo scatto avviene entro un'ora dal
    superamento delle 72h, non esattamente al secondo.
- Nessuna valutazione GDPR è stata fatta per questa modifica specifica: non
  introduce nuovi dati personali (riusa `is_present`/`volunteer_id` già
  esistenti), solo una colonna aggiuntiva (`confirmed_by`) che descrive il
  processo di conferma, non la persona — valutazione legale non ritenuta
  necessaria per questo motivo, ma non è stata richiesta una conferma
  esplicita all'utente su questo punto.
- Rate-limit del reminder: 24h per attività (non per singolo volontario), per
  evitare spam alla NPO se più volontari usano la CTA lo stesso giorno; come
  effetto collaterale, se un volontario invia il reminder e un altro lo rifà
  poco dopo, il secondo riceve `already_sent_recently` anche se non ha mai
  inviato lui stesso un reminder per quell'attività — accettato come
  trade-off ragionevole vista la finalità (evitare spam alla NPO), non
  ancora comunicato esplicitamente all'utente come limite del design.

**Stato deploy:** migration applicata solo su **staging**
(`pavnfiladmnwbptwlwpr`); il deploy su produzione (`ibyjkqowokxrlormkwzw`)
richiede un ok esplicito separato, non ancora richiesto/dato in questa
sessione.

## Decision Log — patch-package per crash "Couldn't find a navigation context" (2026-09-22)

**Contesto:** primo test reale su device dopo la migrazione SDK 54->57 +
NativeWind v2->v4. Crash critico (ErrorBoundary, `critical_crash`) su due
schermate scollegate tra loro (`app/(volunteer)/(tabs)/calendar.tsx`,
`app/feedback/[id].tsx`), stesso messaggio: `Couldn't find a navigation
context. Have you wrapped your app with 'NavigationContainer'?`.

**Causa reale (verificata leggendo il codice installato, non ipotizzata):**
il messaggio è fuorviante. `expo-router` vendorizza react-navigation
internamente; il suo `NavigationStateContext.js` dà al valore di default del
context dei getter (`getKey`, `getState`, ...) che lanciano volutamente
questo errore se letti fuori da un Navigator reale. Il vero colpevole è
`react-native-css-interop` 0.2.7 (dipendenza transitiva di NativeWind): la
sua utility di debug `printUpgradeWarning -> stringify`
(`render-component.js`) costruisce un messaggio di warning facendo
`Object.entries(value)` ricorsivo senza try/catch — quando tra le props di
un componente è raggiungibile uno di questi context "a trappola",
`Object.entries` innesca il getter e l'eccezione non gestita crasha la
schermata invece di limitarsi a un warning in console. Bug upstream
confermato su GitHub, non risolto in nativewind 4.2.7 (ultima stabile) né
nelle preview 5.0.0: https://github.com/nativewind/nativewind/issues/1536 ,
https://github.com/nativewind/nativewind/issues/1711. I maintainer
collegano il trigger a `shadow-*`, `opacity-*` e le scorciatoie
colore/opacità (`bg-x/NN`, `text-x/NN`); nel nostro codice sono usate ~350
volte in `app/`+`components/`.

**Opzioni valutate:**
1. Sostituire le utility class incriminate con inline style, schermata per
   schermata.
2. Patchare `react-native-css-interop` alla fonte con `patch-package`.
3. Solo diagnosi, nessuna azione immediata.

**Scelta:** opzione 2, confermata esplicitamente dall'utente. Motivazione:
la scala (~350 occorrenze in tutto l'app) rende l'opzione 1 impraticabile
come fix completa (avrebbe lasciato scoperte tutte le schermate non ancora
osservate in crash); il bug è dev-only (`printUpgradeWarning` è dentro un
`if (process.env.NODE_ENV !== "production")`), quindi non può verificarsi
in una build di produzione — solo in Expo Go/dev client, che è esattamente
dove si sta ancora testando questa migrazione.

**Implementazione:** `patches/react-native-css-interop+0.2.7.patch` rende
`stringify` a prova di eccezione (try/catch attorno a `Object.entries` e a
ogni proprietà, fallback `"[Unserializable]"` invece di propagare).
`patch-package` aggiunto a `devDependencies` + `"postinstall": "patch-package"`
in `package.json`. Nessuna classe NativeWind dell'app toccata: zero cambi
visivi, solo il logging di debug diventa crash-safe. Contract test statico:
`scripts/test_css_interop_stringify_patch_contract.ts`.

**Trade-off/limiti accettati:**
- `package-lock.json` NON è stato aggiornato da questa sessione (impossibile
  farlo senza eseguire `npm install`, operazione che il sandbox di sviluppo
  non esegue su questo repo per il rischio di installare binari nativi
  Linux invece di macOS sulla cartella condivisa — vedi nota operativa più
  sotto). **Azione richiesta all'utente prima del prossimo push:** un
  `npm install` (non `npm ci`) sul proprio Mac, per aggiornare il lockfile e
  far scattare il postinstall che applica la patch — senza questo, `npm ci`
  in CI fallirà per lockfile fuori sync.
- La patch è stata applicata anche a mano, direttamente sul file installato
  in `node_modules` in questa sessione, per sbloccare subito il test su
  device: è temporanea (sparisce al prossimo `npm install`/`npm ci` pulito)
  finché l'utente non esegue il passo sopra, dopo il quale diventa
  permanente/riproducibile via `postinstall`.
- Il meccanismo di "upgrade" di NativeWind che la warning originale segnalava
  (remount di un componente quando cambiano a runtime stili
  pseudo-classe/transition/variabile) resta presente e non è stato
  investigato: la patch rende solo il *logging* di quel caso crash-safe, non
  elimina un eventuale remount/flicker visivo reale in produzione — non
  osservato finora, non trattato come bug verificato.
- Non risolve il bug upstream per altri progetti: è una patch locale a
  questo repo, da rimuovere se/quando `nativewind`/`react-native-css-interop`
  la risolvono a monte (issue linkate sopra da tenere d'occhio).

**Nota operativa (promemoria, non nuova):** né la sandbox cloud né
`device_bash` eseguono `npm install`/`npm ci` su questa cartella condivisa —
rischio già concretizzato una volta in questa sessione (binari nativi
platform-specific corrotti). La generazione del file di patch è stata fatta
con `npx patch-package react-native-css-interop`, che installa una copia
pulita del solo package in una cartella temporanea isolata (non tocca
`node_modules`/`package-lock.json` del progetto) solo per calcolare il
diff — operazione diversa e verificata sicura, a differenza di un
`npm install`/`npm ci` sul progetto.

### Addendum — la prima revisione della patch causava un freeze (2026-09-22, stesso giorno)

**Regressione osservata su device**: dopo il primo `npm install` dell'utente (patch applicata con successo), l'errore con messaggio è sparito ma è stato sostituito da un **freeze** (app non risponde, nessun errore visibile) esattamente negli stessi punti — tab Calendario -> "Lista", e nella finestra feedback attività selezionando una voce di "come ti senti?" (componente `SelectableChip`, stessa famiglia di re-render "upgrade" di NativeWind).

**Causa della regressione**: la revisione 1 della patch avvolgeva `Object.entries(value)` e ogni accesso a proprietà in try/catch, ma non limitava in altro modo la ricorsione. Le props di un componente possono includere `children` con elementi React che portano campi di debug (`_owner`, `_source`) che risalgono l'intero fiber tree; intercettare l'eccezione della singola proprietà "a trappola" ha permesso al walk di continuare in quel grafo, di fatto enorme/non delimitato, invece di interrompersi subito come faceva involontariamente l'eccezione originale non gestita. Risultato: stesso trigger, ma lavoro sincrono molto più lungo sul thread JS invece di un crash immediato — percepito come blocco dell'app.

**Fix (revisione 2)**: aggiunto, oltre al try/catch già presente, un limite di profondità (`MAX_DEPTH = 4`) e un budget massimo di nodi visitati (`MAX_NODES = 300`) alla ricorsione di `stringify`— qualunque valore oltre il limite diventa `"[Truncated]"` invece di continuare la discesa. Dato che questa stringa serve solo a un `console.log` di debug, non deve essere completa: è accettabile perdere dettaglio in cambio della garanzia che il lavoro totale sia sempre limitato da una costante, indipendentemente dalla forma dell'oggetto raggiungibile dalle props. `patches/react-native-css-interop+0.2.7.patch` e `scripts/test_css_interop_stringify_patch_contract.ts` aggiornati di conseguenza (il contract test ora verifica anche la presenza del limite di profondità/nodi, non solo del try/catch, per evitare che questa specifica regressione si ripeta).

**Non ancora verificato su device dopo questa seconda revisione** — richiede un altro giro di test dell'utente su calendario/tab Lista e sulla selezione "come ti senti?" nel feedback attività.

## Decision Log — Fix del loop di rigenerazione embedding (2026-10-24)

**Stato in breve:** il fix del loop è **verificato solo su staging**; in
produzione è **parziale, non completo** (completamento tracciato nella task
A20 del Registro AiutarSi).

**Contesto e problema.** Smart Match usa un vettore di 384 numeri (embedding)
per ogni profilo e per ogni attività. I trigger `trigger_update_profile_embedding`
e `trigger_update_activity_embedding` erano `AFTER INSERT OR UPDATE` su qualsiasi
colonna; la edge function `generate-embedding` scrive `UPDATE <tabella> SET
embedding = ...`, che rilanciava lo stesso trigger: loop auto-alimentato
(~120-160 chiamate/min, quota Gemini free tier esaurita, backfill impossibile).
Effetti collaterali dello stesso difetto: ogni UPDATE di `profiles.last_seen_at`
(heartbeat ogni 30 s) e ogni cambio di `activities.status` (cron ogni 15 min)
generava una chiamata a Gemini. Conseguenze: quota sprecata e consigli di Smart
Match poco affidabili (vettori rigenerati di continuo o a metà).

**Opzioni considerate** (scheda D01 del Registro):
1. **A) Solo guardie sui trigger.** Il trigger resta com'è, con controlli per non
   ripartire. Il più semplice, ma il loop non è escluso per struttura.
2. **B) Trigger solo sulle colonne sorgente, più dedup per transazione.** Il
   trigger scatta solo se cambiano i dati con cui si costruisce l'embedding;
   una transazione che tocca più righe produce una sola richiesta.
3. **C) Coda con cron.** Le modifiche finiscono in una coda e un job periodico
   rigenera gli embedding. La più robusta, ma richiede più costruzione.

**Scelta: B**, applicata su staging il 24/10/2026 (migration
`20261020210000_fix_embedding_trigger_loop.sql`), confermata da Francesco.
La coda C è rimandata finché i numeri reali non la giustificano.

Cosa fa la migration (verificato leggendo il file nel repo):
- un solo percorso, `public.request_embedding_refresh(tabella, id)`, che invia
  alla edge function solo i campi usati per costruire il testo (niente
  email/telefono/embedding nel payload);
- trigger limitati alle colonne sorgente e con `WHEN ... IS DISTINCT FROM`
  (`profiles`: INSERT, UPDATE OF bio; `activities`: INSERT, UPDATE OF title,
  category, description; `user_skills`/`user_interests` → profili;
  `activity_skills` → attività), tutti via `trg_request_embedding_refresh`;
- constraint trigger DEFERRED con dedup per transazione: N righe di
  competenze/interessi nella stessa transazione producono 1 sola chiamata;
- niente più `embedding = NULL` come segnale: se la generazione fallisce resta
  il vecchio vettore.

Scrivere `embedding`, `last_seen_at`, `status` ecc. non rilancia più nulla: il
loop non è strutturalmente più possibile.

**Stato verificato su staging (24/10/2026):** 0 trigger vecchi, 7 trigger
nuovi, 0 funzioni vecchie, funzioni di supporto non eseguibili da `anon` e
`authenticated`, migration registrata, nessuna chiamata di embedding negli
ultimi 10 minuti, vettori a 384 dimensioni, backfill fatto.

**Stato di produzione (letta in sola lettura il 24/10/2026): PARZIALE, NON
COMPLETO.** Uguali a staging: 7 trigger, funzione principale (stesso hash), 10
job programmati. Differenze ancora aperte (tutte TODO in A20):

| # | Differenza in prod rispetto a staging |
|---|---|
| a | Restano 5 funzioni vecchie (`on_*_change_for_embedding`) |
| b | `request_embedding_refresh` e `trg_request_embedding_refresh` sono eseguibili da `anon` e `authenticated` |
| c | La migration `20261020210000` non è registrata |
| d | La edge function `generate-embedding` è v5 con codice diverso; su staging è v36 |

Oggi prod ha 0 profili e 0 attività, quindi nessun loop è in corso.

**Trade-off e rischi accettati:**
- La voce esce con un fix verificato solo su staging: chi la legge non deve
  pensare che prod sia a posto.
- Prod può ripartire con il loop quando arriveranno dati reali (5 funzioni
  vecchie ancora presenti). ASSUMED, non testato: prod oggi ha 0 dati.
- Funzioni di supporto aperte ad `anon`/`authenticated`: impatto reale non
  valutato. ASSUMED.
- `generate-embedding` diversa tra prod e staging: il comportamento in prod può
  non coincidere con quello verificato. ASSUMED.

**Prossimi passi:**
1. Task A20: pulire le 5 funzioni vecchie, chiudere i permessi sulle 2 funzioni
   di supporto, registrare la migration, riallineare `generate-embedding` dal
   sorgente del repo. Ogni scrittura su prod richiede l'ok esplicito.
2. Prima di ogni evento production-facing (demo, onboarding NPO reale),
   rilevare di nuovo le differenze prod/staging, anche per `ezbr_sha256` delle
   edge function.

**Nota sulle fonti:** i dati di staging e produzione di questa voce arrivano
dalle letture della task A10 del Registro; la descrizione della migration è
stata riletta dal file nel repo.

## Decision Log — Funzioni edge di test (`*-smoke`) solo su staging (2026-10-24)

**Contesto.** Otto edge function di test (`activity`, `application`, `chat`,
`community`, `gamification`, `notification`, `smart-match`, `story-views`
`-smoke`) creano utenti (`auth.admin.createUser`), attività e messaggi con la
service role e poi li cancellano. Erano pubblicate anche su prod. Nel codice non
c'è alcun controllo oltre a `verify_jwt`, e la chiave anon, pubblica, lo supera:
in teoria chiunque la conosca poteva chiamarle su prod e creare utenti e dati
di prova veri. Letto nel codice (VERIFIED); non provato chiamandole su prod,
perché la prova avrebbe creato utenti nell'auth di prod.

**Opzioni considerate.**
1. Controllo "solo staging" nel codice e ripubblicazione su prod: la funzione
   resta raggiungibile.
2. Togliere le funzioni da prod: nessuna superficie esposta.
3. Lasciarle: rischio appena prod ha dati veri.

**Scelta.** Opzione 2 come soluzione principale, più il controllo dell'opzione 1
nel repo come rete di sicurezza (difesa in profondità): `rejectIfNotStaging` in
`supabase/functions/_shared/stagingOnly.ts` risponde 403 se `SUPABASE_URL` non
è quello di staging. Principio: il codice di test non va in produzione; un
controllo dentro una funzione raggiungibile non basta, perché un suo errore
darebbe accesso completo con la service role.

**Trade-off.** La cancellazione da prod è definitiva ma reversibile dal repo
(basta ripubblicare); prod non ha smoke test finché non si decide di farli lì,
con un controllo di accesso dedicato. Il riallineamento prod/staging non si
applica a queste funzioni. Il test `scripts/test_smoke_functions_staging_only_contract.ts`
impedisce di aggiungere una nuova funzione `*-smoke` senza il controllo.

**Stato.** Codice e test pronti nel repo; cancellazione da prod e ripubblicazione
su staging: vedi task A25 del Registro.
