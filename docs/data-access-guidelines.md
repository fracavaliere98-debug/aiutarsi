# Linee Guida — Accesso ai Dati e Service Layer

Questo documento non introduce un'architettura nuova: **formalizza regole già in vigore nel codice**, alcune già scritte in [architecture.md](./architecture.md) e [server-state-migration-plan.md](./server-state-migration-plan.md), altre applicate di fatto nei service ma mai messe per iscritto finora (in primis: resilienza delle chiamate Supabase dirette). Va letto insieme a quei due documenti, non al posto loro.

## 1. Dove vive lo stato: regola già stabilita, qui solo richiamata

Per i domini migrati (`activities`, `applications`, `community`, `smart match`, `gamification`, `notifications`, `chat`, `stories`, `story_views`) vale la regola già chiusa in `server-state-migration-plan.md`:

- la UI non legge il backend direttamente
- la UI legge solo tramite domain hooks canonici (`queries.ts` / `selectors.ts`)
- le mutation vivono nei domini (`mutations.ts`), non fuori
- il Context non è nel path del server state di quei domini

Non ripetiamo qui le regole di dominio (query keys, invalidation, `initialData`/`placeholderData` sul detail, ecc.): sono in `server-state-migration-plan.md`, "Fase 0: regole comuni" e "Recap architetturale canonico".

**Nota di manutenzione**: quel documento è nato come piano di migrazione ma la sezione "Closure Status" dichiara ormai tutti i domini `chiuso`. Va trattato come riferimento architetturale corrente, non come lavoro in corso — vale la pena, in un secondo momento, separare la parte "regole permanenti" (Fase 0, recap, playbook riusabile) dal log storico della migrazione, così chi lo apre per la prima volta non lo scambia per un piano ancora aperto.

## 2. Dati utente/sessione: `AuthContext` → `AuthService` è la scelta corretta

Risposta diretta alla domanda che ha aperto questo documento: sì, passare da `AuthService` (tramite `AuthContext`) per leggere o scrivere il profilo dell'utente corrente è la best practice, non una preferenza stilistica. È esplicitamente il confine accettato in `server-state-migration-plan.md`:

> Residui ammessi: `AuthContext` per sessione e utente autenticato, `ToastContext` per feedback UI effimero, `NotificationsRuntimeBridge` come orchestration UI/runtime.

In pratica, per il profilo dell'utente autenticato (`profiles` della propria riga, non il profilo di un altro utente):

- **lettura**: da `user` esposto da `useAuth()` — quasi mai serve una fetch dedicata, il profilo corrente è già in memoria
- **scrittura**: sempre `updateUserProfile(partialData)` da `useAuth()`, mai `supabase.from('profiles').update(...)` chiamato dalla schermata

Motivi concreti, non teorici:

1. `updateUserProfile` passa da `authService.updateProfile()`, che gestisce upload avatar se il valore è un URI locale (`file://`/`content://`/`data:`), filtra i campi ammessi sulla tabella, e aggiorna `setUser(...)` in `AuthContext` al termine — quindi lo stato locale resta sincronizzato subito dopo il salvataggio.
2. `AuthService` è il punto in cui è stato applicato il fix del bug "profilo in caricamento infinito" (`withTimeout` su `getProfileById`/`getUsers`/`getCurrentUser`/`updateProfile`) — bypassarlo significa perdere quella protezione.
3. Se in futuro cambia lo schema o la mappatura camelCase↔snake_case dei campi profilo, c'è un solo punto da aggiornare.

**Per il profilo di un ALTRO utente** (es. profilo NPO visto da un volontario, profilo volontario visto da un ente), il canale corretto resta comunque `AuthService` (`getProfileById`/`fetchUserById`/`getUsers`), non una query diretta nella schermata — stessa logica, stesso confine.

## 3. Nessuna chiamata Supabase diretta da schermate o componenti

Regola esplicita, prima non scritta da nessuna parte ma già violata almeno una volta nel codice attuale:

**Una schermata (`app/**`) o un componente (`components/**`) non chiama mai `supabase.from(...)`, `supabase.rpc(...)` o `supabase.auth.*` direttamente.** Passa sempre da:

- un **service** (`services/*.ts`) per dati non ancora migrati a React Query, oppure
- un **domain hook** (`hooks/<dominio>/queries.ts` / `mutations.ts`) per i domini già migrati

**Controesempio reale da correggere**: `app/(npo)/settings/privacy.tsx` oggi fa fetch e update di `profiles` con `supabase.from(...)` direttamente nella schermata. Doppia violazione: bypassa sia la regola di questa sezione sia la regola della Sezione 2 (dovrebbe leggere `user.allow_calls`/`user.show_email` da `useAuth()` e salvare con `updateUserProfile()`, esattamente come fa già `app/(volunteer)/settings/privacy.tsx`).

## 4. Ogni chiamata diretta a Supabase deve avere un timeout esplicito

Regola nuova, nata da un bug reale (profilo ente in caricamento infinito, poi confermato sistemico su altri service il 24/07/2026): `@supabase/supabase-js` su React Native può restare bloccato a tempo indefinito — senza errore, senza reject — se il lock interno di rinnovo sessione resta "impegnato" (refresh partito e mai completato, app in background a metà chiamata). Una query così non lancia un'eccezione: semplicemente non risolve mai, e qualunque `try/catch` attorno non se ne accorge.

**Regola**: qualunque `supabase.from(...)`, `supabase.rpc(...)` o `supabase.auth.*` chiamata direttamente da un service deve essere avvolta in un timeout esplicito, usando il pattern già stabilito:

```ts
import { withTimeout } from '../utils/withTimeout';

const { data, error } = await withTimeout(
    supabase.from('profiles').select('...').eq('id', userId).single(),
    'profiles.getById', // label descrittiva, compare nel messaggio di errore
    8000                // ms, 8000 è lo standard usato finora
);
```

Se un service ha già un `_withTimeout` privato (`ChatService`, `ActivityService`), riusare quello — non introdurre un terzo pattern. Il tipo del parametro deve essere `PromiseLike<T>`, non `Promise<T>`: i query builder di Supabase sono thenable ma non `Promise` nativi, e `Promise<T>` fa fallire `tsc`.

**Non applicare questa regola come riflesso automatico**: prima di avvolgere una chiamata, verificare che sia genuinamente sul percorso critico (una fetch bloccante da cui dipende una schermata o un'azione utente), non un match falso positivo di un grep (`Array.from()` non è `supabase.from()` — è già successo di scambiarli in un audit).

**Timeout tipici usati finora**: 8000ms per query dati generiche, 5000ms per `auth.getSession()` in `getCurrentUser` (gira ad ogni avvio app), 1500ms per i controlli veloci di token cache in `_getAccessToken()`.

## 4b. Mai `await` di Supabase dentro `onAuthStateChange` (decisione 26/10/2026)

Causa verificata di una parte dei blocchi descritti al punto 4: `@supabase/auth-js` esegue le callback di `onAuthStateChange` tenendo il lock di sessione e ne aspetta la fine (per esempio `updateUser()` → evento `USER_UPDATED`). Ogni query supabase-js deve leggere la sessione da quello stesso lock. Se la callback fa `await` di una query Supabase (anche indiretta, come `authService.getCurrentUser()`) si crea un deadlock: tutte le query dell'app restano ferme finché un timeout non lo sblocca. Sintomo osservato: circa 8 s di blocco dopo ogni salvataggio del profilo, con `profiles.getUsers timeout` / `Exception fetching users`, mentre il server rispondeva in ~300 ms.

- Le callback di `onAuthStateChange` non sono `async` e non fanno `await`. Il lavoro asincrono va spostato fuori dal lock con `setTimeout(() => { ... }, 0)`, come indica la documentazione Supabase.
- Un risultato arrivato dopo un evento più recente (o dopo `SIGNED_OUT`) si scarta (numero di sequenza in `AuthContext`).
- Il token utente per le chiamate REST dirette (`utils/profileRest.ts`) si allega in base alla sessione, non ai parametri della chiamata: senza token la richiesta parte con la chiave anon, che da A26 non legge `profiles`.
- Contract test: `scripts/test_auth_state_change_no_deadlock_contract.ts`.

## 5. Convenzione feedback UI: `showToast` vs `Alert.alert` vs `alert()` nativo

Confermata il 24/07/2026, dopo un censimento completo dell'uso reale in `app/**` (49 chiamate `Alert.alert` in 16 file, 3 chiamate `alert()` nativo). Prima non esisteva nessuna convenzione: nello stesso set di schermate equivalenti (impostazioni ente/volontario) si trovavano tutti e tre i pattern usati in modo intercambiabile, a volte invertito tra le due varianti dello stesso schermo.

**Regola (3 categorie)**:

1. **`showToast(...)` — il default.** Esito di un'azione (successo, errore, info) che non richiede una decisione dell'utente prima di proseguire: salvataggi, errori di rete, validazioni fallite, conferme "fatto". Si chiude da solo, non blocca l'interazione. Se un caso non rientra chiaramente nelle categorie 2 o 3, va qui.
2. **`Alert.alert(...)` con 2+ bottoni — solo conferme con scelta esplicita.** Riservato a decisioni distruttive o irreversibili dove serve un tap esplicito su un'opzione tra due o più (es. "Elimina account", "Elimina attività", sblocco utente, approvazione/rifiuto admin). Un toast non può sostituire una domanda con scelta binaria: questa categoria resta invariata.
3. **`Alert.alert(...)` con un solo bottone "OK" — solo se blocca davvero un cambio di stato o l'informazione è critica da non perdere.** Va usato SOLO quando il tap su "OK" ha un effetto reale (es. chiude una modalità di modifica, come "Controlla la nuova email" che in `(npo)/settings/security.tsx` richiama `setIsEditingEmail(false)` nel suo `onPress`) oppure quando la perdita del messaggio avrebbe conseguenze concrete e il contenuto non può essere raccorciato in un toast. Non va usato per i normali messaggi "Errore"/"Successo" senza logica di continuazione: quelli sono categoria 1, anche se storicamente molti file (es. `(volunteer)/settings/security.tsx` prima del fix) usavano `Alert.alert` a un bottone come sinonimo di "errore generico" — è esattamente il pattern da eliminare.
4. **`alert()` nativo — mai.** Rompe lo stile dell'app, non è tradotto/brandizzato. Sempre sostituito da categoria 1 o 3 secondo la regola sopra.

**Applicato (24/07/2026)**: eliminati i 3 `alert()` nativi rimasti (`app/(volunteer)/review-application.tsx` x2, `app/(npo)/settings/edit-profile.tsx` x1, `app/onboarding/profile.tsx` x1) → tutti categoria 1. Convertiti i 5 `Alert.alert` a un bottone di `app/(volunteer)/settings/security.tsx` (validazione password/email, nessuna logica di continuazione) → categoria 1. `app/(npo)/settings/security.tsx` era già conforme (usa `showToast` per la validazione e `Alert.alert` solo per il caso con `onPress` reale).

**Non ancora fatto**: le altre ~44 chiamate `Alert.alert` sparse in auth (`login.tsx`, `reset-password.tsx`, `register/corporate.tsx`, `confirm-email.tsx`), messaggistica (`messages/[id].tsx`), area admin (`admin/verification/[id].tsx`, `admin/report/[id].tsx`), `edit-activity/[id].tsx`, `blocked-users.tsx`, `community/create-post.tsx`, `npo-profile/[id].tsx` e `_layout.tsx` non sono state riclassificate una per una — molte hanno probabilmente callback `onPress` con effetti reali (navigazione, chiusura stato) che vanno verificati caso per caso prima di convertirle, non sostituite alla cieca. Vanno riprese come passata separata, file per file, applicando le stesse 4 categorie.

## 6. Come verificare che le regole reggano nel tempo

Il repo usa contract test statici (`scripts/test_*_contract.ts`, letti come testo e verificati con assert su pattern regex/struttura, agganciati a `npm run test:regression`) invece di soli test runtime. Esempi già esistenti per queste regole:

- `scripts/test_service_query_timeout_contract.ts` — verifica che i service abbiano un numero minimo di chiamate avvolte in `withTimeout`
- `scripts/test_activity_organizer_and_onboarding_contract.ts` — verifica che `AuthService` avvolga `getProfileById`/`getUsers`/`getCurrentUser` alla fonte

Quando si formalizza una nuova regola in questo documento, il passo successivo naturale è un contract test dedicato che la verifichi (es. "nessun file sotto `app/**`/`components/**` importa `utils/supabase` direttamente, salvo whitelist esplicita" per la Sezione 3).

## 6b. Attività: si annullano, non si eliminano (deciso 21/09/2026)

- Un'attività non viene mai eliminata fisicamente: l'ente la **annulla** (`ActivityService.cancelActivity` → `status = 'CANCELLATA'`), resta nello storico (tab "Annullate" dell'ente) con la scheda visibile e il badge "Cancellata".
- L'annullo notifica una sola volta i volontari iscritti (`ACTIVITY_UPDATE` con `activityId`, generata dal trigger `notify_participants_on_activity_change`, non dal client); è ammesso solo da `APERTA`/`IN_CORSO`, e un'attività annullata non è più modificabile né riattivabile dall'app.
- Lato DB, dopo la migration `20260921120000_activities_no_hard_delete.sql`, `activities` non ha policy DELETE (INSERT/UPDATE espliciti per l'ente proprietario). Il cascade da cancellazione account passa dal service role e non è toccato.
- Lato DB (migration `20260921130000_participation_guard_and_npo_notifications.sql`): il trigger `block_join_cancelled_activity` rifiuta con `ACTIVITY_CANCELLED` ogni iscrizione (nuova o riattivata, anche via upsert) a un'attività `CANCELLATA`; la UI mostra un messaggio dedicato in `review-application.tsx`.
- Iscrizione/ritiro di un volontario → notifica all'ente proprietario, generata dal trigger `notify_npo_on_participation_change` (non dal client): tipi `VOLUNTEER_ENROLLED` / `VOLUNTEER_WITHDRAWN`, solo per azioni del volontario stesso su attività `APERTA`/`IN_CORSO`, con dedup di 10 minuti per (volontario, attività, tipo).
- **Modello di iscrizione (decisione 21/09/2026):** esistono solo due percorsi. (1) Iscrizione a un'attività: immediata, senza approvazione (`joinActivity` scrive `REGISTERED`). (2) Candidatura all'ente: richiede approvazione dell'ente (tabella `applications`). Il ramo "candidatura ad attività con approvazione" (`submitActivityApplication`, `updateActivityApplicationStatus`, hook `useApplyToActivity/Approve/RejectActivityApplication`) è stato rimosso e non deve tornare (coperto da `test_activity_enrollment_contract.ts`). Restano in lettura i `PENDING/APPROVED/REJECTED` legacy di `activity_participants` solo per report/insight; su staging e prod non ce ne sono (verificato 21/09: solo `REGISTERED`).
- Contract test: `scripts/test_activity_cancel_contract.ts`.

## 7. Violazioni note da correggere (stato: 24/07/2026)

- ~~Spoofing notifiche~~ **Corretto 21/09/2026** (migration `20260921140000_notifications_server_side.sql`, staging + prod): il client non inserisce più in `notifications` (INSERT revocato ad `anon`/`authenticated`, policy `System/Trigger insert` rimossa). Le notifiche nascono da trigger (`notify_on_application_change`, `notify_participants_on_activity_change`) o dalle RPC `send_npo_invite` (inviti NPO→volontario, con verifica di ruolo/dedup) e `admin_send_notification` (solo ADMIN; service `AdminNotificationService`). Regola permanente: nuove notifiche = trigger/RPC/edge function, mai `.from('notifications').insert` dal client (coperto da `test_activity_cancel_contract.ts`).

- ~~`app/(npo)/settings/privacy.tsx`: fetch/update `profiles` diretti~~ **Corretto 29/09/2026**: ora legge da `AuthContext.user` e scrive via `updateUserProfile()`, stesso pattern già in uso in `app/(volunteer)/settings/privacy.tsx` (usato come riferimento). `allow_calls`/`show_email` erano già in `PROFILE_COLUMNS_NO_EMBEDDING`, nessun cambio lato AuthService necessario.
- `app/(npo)/settings/security.tsx`: toggle "Autenticazione a due fattori" senza alcuna persistenza reale (fuori scope di queste linee guida, ma segnalato: è un problema di fiducia utente, non di data access).
- ~~Sezione 5: ~44 chiamate `Alert.alert` fuori dalle schermate impostazioni~~ **Corretto 29/09/2026**: passata completa file per file su auth (`login.tsx`, `reset-password.tsx`, `register/corporate.tsx`, `confirm-email.tsx`), messaggistica (`messages/[id].tsx`), admin (`verification/[id].tsx`, `report/[id].tsx`), `(npo)/edit-activity/[id].tsx`, `blocked-users.tsx`, `community/create-post.tsx`, `npo-profile/[id].tsx`, `_layout.tsx`. 40 chiamate reali censite (non 44, probabile drift dal 24/07): 32 convertite a categoria 1 (`showToast`), 8 lasciate invariate perché già conformi — 5 categoria 2 (conferme distruttive/esplicite: blocco/sblocco utente in `messages/[id].tsx` e `blocked-users.tsx`, annullamento attività in `edit-activity/[id].tsx`, approvazione verifica NPO in `admin/verification/[id].tsx`) e 3 categoria 3 (un bottone con `onPress` reale: reset password riuscito in `reset-password.tsx`, email già confermata in `confirm-email.tsx`, riavvio app per OTA update in `_layout.tsx`). `npx tsc --noEmit` ed `eslint` puliti su tutti i file toccati.

Corrette in questa sessione (non più in lista): `alert()` nativo in `review-application.tsx`/`(npo)/settings/edit-profile.tsx`/`onboarding/profile.tsx`; `Alert.alert` a un bottone senza continuazione in `(volunteer)/settings/security.tsx`.

Questa sezione va aggiornata man mano che le violazioni vengono chiuse, così il documento resta uno specchio dello stato reale e non una lista aspirazionale.

### Conferma presenze e XP (decisione 21/09/2026)
- Iscrizione = `activity_participants` REGISTERED (il volontario non può scrivere APPROVED/CHECKED_IN: RLS).
- Una sola strada (verificato 26/10, A32): i vecchi trigger che premiavano a CHECKED_IN o a fine attivita' sono stati rimossi insieme alla seconda versione di `award_activity_completion_to_user`.
- XP, ore, livelli e badge si assegnano solo quando l'ente proprietario conferma la presenza (`volunteer_reviews.is_present = true`, attività COMPLETATA, volontario iscritto) tramite il trigger `on_volunteer_attendance_confirmed`; idempotente via `processed_activity_ids`. Lo stato del partecipante non cambia.
- La recensione dell'attività da parte del volontario resta condizionata alla presenza confermata; i promemoria (`REVIEW_REMINDER`) partono solo per chi è stato confermato.
- Notifiche (tutte server-side): fine attività → volontari ("riceverai XP alla conferma") e ente ("Conferma le presenze"); conferma → volontario ("hai guadagnato N XP", livello raggiunto); badge → `BADGE_UNLOCKED`.

### Segnalazioni (decisione 21/09/2026)
- Tabella unica letta dagli admin: `reports` (`content_type` = message | profile | community_post, `evidence_snapshot`, `is_ai_generated`). Il motivo è salvato come "<Categoria>: <testo>" e la categoria si ricava con `utils/reportCategory.ts` (la tabella non ha una colonna categoria).
- `community_reports` è legacy: nessun client né edge function deve più scriverci (nessun admin la legge). Da rimuovere in una migration dedicata dopo verifica.
- Il moderatore AI scrive in `reports` con `reporter_id` NULL e `is_ai_generated = true` (prima usava un reporter inesistente e il flag andava perso).
- L'ammonimento ("warned") notifica l'utente segnalato via `admin_send_notification`.

### Stato di verifica degli enti: una sola fonte (decisione 26/10/2026, A28)
- `profiles.verification_status` (none | pending | verified | rejected) è l'unica fonte. `profiles.is_verified` è derivata dal database (`is_verified = (verification_status = 'verified')`) da un trigger e protetta da un vincolo CHECK: nessun client, edge function o script la scrive.
- Il passaggio a `pending` lo fa il database quando arriva una riga in `verification_requests` (trigger). Il client non scrive `verification_status`; la schermata dell'ente legge lo stato da `AuthContext.user`.
- Approvazione/rifiuto: solo `admin_review_verification(request_id, approve, notes)`, che aggiorna richiesta e profilo nella stessa transazione. `admin_set_npo_verification` non esiste più. `verification_requests` resta storico e note.
- Le regole di accesso ai profili dei volontari (A26) leggono `is_verified`, che per costruzione coincide con `verification_status = 'verified'`.
- Contract test: `scripts/test_verification_single_source_contract.ts`.

### Contatti condivisi con l'ente (decisione 26/10/2026, A29/A30)
- Il volontario sceglie cosa condividere con **quell'ente** quando si iscrive a un'attività (`activity_participants.email/phone/message`) o si candida (`applications.email/phone/message`). L'email è precompilata dal profilo ma modificabile o cancellabile; telefono ed email sono facoltativi.
- La email del profilo non è mai visibile a un ente (`get_public_profiles` la restituisce solo a se stessi e all'admin). Il toggle «Mostra email» è stato tolto; `profiles.show_email` resta come colonna inerte fino alla pulizia P9.
- Telefono, email e messaggio delle iscrizioni, e email/telefono delle candidature, non si leggono con una SELECT diretta (permessi per colonna). Si leggono solo con `get_shared_contacts_for_npo` (via `NPOService.getSharedContacts`), che li restituisce all'ente verificato destinatario e li nasconde se l'iscrizione è annullata/rifiutata o la candidatura è rifiutata (una iscrizione annullata sparisce del tutto).
- `activity_participants` non è più leggibile da utenti anonimi (policy solo `authenticated`); gli utenti loggati vedono solo `activity_id, user_id, status, created_at`.
- Dove li vede l'ente: scheda candidatura (tab Volontari), lista iscritti nel dettaglio attività, sezione «Contatti condivisi con te» nel profilo del volontario. Componenti: `ContactRow` (`components/ui`), `SharedContactBlock`, `SharedContactsSection` (`components/npo`).
- Un errore di lettura dei contatti non si nasconde con una lista vuota: la query espone `isError` e la schermata lo dice.
- Niente upsert (`on_conflict` + `resolution=merge-duplicates`, `.upsert()`) sulle tabelle con SELECT per colonna (`activity_participants`, `applications`, `profiles`) se il payload contiene colonne non leggibili: `ON CONFLICT DO UPDATE` legge `excluded.<colonna>` e Postgres richiede il SELECT su quella colonna, quindi risponde 403 / 42501 «permission denied for table». Si usa INSERT e, se la riga esiste già (23505), UPDATE della stessa riga con `RETURNING` solo su colonne leggibili. Caso reale: l'iscrizione alle attività falliva per tutti dal rilascio di A30 su staging (26/10/2026), corretta in `profileRest.joinActivity`.
- Niente `*` nelle letture di `profiles`, né diretta (`.from('profiles').select('*')`) né annidata (`follower:follower_id(*)`, `profiles(*)`): il ruolo authenticated legge solo alcune colonne e `*` risponde 403 / 42501 «permission denied for table profiles». Si elencano le colonne che la schermata usa davvero. Caso reale: la lista follower dell'ente (`NPOService.getFollowers`) restava vuota su staging (26/10/2026, A38).
- Inviti degli enti alle attivita' (D08, 26/10/2026): ogni invito mirato e' una riga di `npo_activity_invites` (una per attivita' + volontario, per sempre) e il server (`send_npo_invite`) ne accetta al massimo 5 per attivita' (`INVITE_LIMIT_REACHED`). Lo stato "gia' invitato" e il contatore si leggono dalla tabella, mai dalle notifiche (si cancellano dopo 20 giorni) e mai solo dallo stato locale della schermata. Dalla scheda attivita' l'ente invita SOLO i suoi volontari (candidatura all'ente APPROVATA) e li vede solo tramite `get_suggested_volunteers_for_activity`: nome, foto e compatibilita', nessun contatto, posizione o competenza. I follower si invitano a una attivita' solo dal flusso "Salvataggio Last Minute" (tab Follower, CTA "Invita il follower a questa attivita'"); il tetto di 5 inviti e' unico per attivita', condiviso dai due flussi.
- Accesso alle chat (A26 P6a, 26/10/2026): le chat private si aprono SOLO con la RPC `start_private_conversation_between`, che rifiuta con `CHAT_NOT_ALLOWED` se uno dei due e' bannito, se c'e' un blocco in una qualunque direzione o se manca la relazione (ente -> volontario: candidatura, iscrizione a una sua attivita' o follow; volontario -> volontario: approvati dallo stesso ente; chiunque -> ente/azienda: sempre; una chat gia' avviata con messaggi si puo' sempre riaprire, salvo ban/blocco). Il client non inserisce mai chat private ne' partecipanti a mano: le policy di INSERT su `conversations`/`conversation_participants` valgono solo per le chat di gruppo di un'attivita' (ente proprietario o iscritto), e `sync_group_conversation_participants` controlla chi chiama. Nell'app l'errore e' `ChatNotAllowedError` (da `hooks/chat/mutations`) e si mostra con `CHAT_NOT_ALLOWED_TOAST`, mai come guasto. Contract test: `scripts/test_chat_access_contract.ts`.
- Privacy nelle chat (A26 P6b, 26/10/2026): una chat in comune NON sblocca il profilo di un volontario non pubblico (`can_view_profile_row` non ha piu' l'eccezione della conversazione condivisa): lo sblocca la sua risposta (`profile_access_level`). Nome e foto dell'altro in inbox, intestazione e messaggi arrivano da `get_public_profiles` ("Marta B.", nessuna foto) quando l'embed `profiles` e' null (`ChatService._fillHiddenProfiles`). `get_chat_inbox` e `get_unread_messages_count` valgono solo per chi chiama (service_role escluso, per le edge function): ogni nuova funzione SECURITY DEFINER con un parametro id utente deve controllare `auth.uid()`. Il volontario che riceve il primo messaggio da un ente vede la nota «Se rispondi, accetti di condividere il tuo profilo pubblico con [Ente]. Email e telefono restano privati.» (derivata dai messaggi, non salvata).
- Solo maggiorenni (A26 P7, 27/10/2026): il divieto 18+ vale anche sul server. Il trigger `enforce_adult_profile_trigger` su `profiles` rifiuta con `ADULT_REQUIRED` una data di nascita da minorenne (o prima del 1900) e il completamento del profilo (`profile_completed` da falso a vero) di un VOLONTARIO senza data di nascita. I profili esistenti non cambiano finche' non si riscrive la data o si completa il profilo. Il controllo del client (`isAdult`) resta per dare il messaggio subito. Nell'app l'errore si mostra in `app/onboarding/profile.tsx`. Contract test: `scripts/test_adult_only_contract.ts`.
- Privacy policy (A26 P8, 27/10/2026): il testo sta SOLO in `app/privacy-policy.tsx` e descrive quello che l'app fa davvero (dati raccolti, chi li vede, fornitori esterni, conservazione). Non e' stato rivisto da un legale (non c'e' un consulente): e' scritto dai fatti verificati. Il contract test `scripts/test_privacy_policy_contract.ts` legge le edge function e `utils/monitoring.ts` e fallisce se l'app manda dati a un fornitore (Google, Expo, HuggingFace, OpenAI, Anthropic) o a Sentry con l'email senza che la policy lo dica. Se cambi cosa raccogli, chi lo vede o a chi lo mandi: aggiorna la policy e la data `PRIVACY_POLICY_LAST_UPDATE`.
- `profile_public` non esiste piu' (A26 P9, 27/10/2026): la visibilita' del profilo la decide solo il server (`profile_access_level`, `get_public_profiles`), non un interruttore dell'utente. Non rimetterlo in `update_my_profile_core`, nei select o nei tipi; `scripts/test_profile_public_removed_contract.ts` fallisce se ricompare nel codice.
- Funzioni `SECURITY DEFINER` con id utente (A26 P10, 27/10/2026): una funzione che prende un id utente come parametro deve usare `auth.uid()` (o accettare l'id solo se `auth.role() = 'service_role'`, per le edge function). `get_activities_with_match` forza l'id al chiamante, `is_conversation_participant` risponde solo per se stessi, i promemoria (`sync_activity_reminder_job*`) non sono chiamabili dai client. Non toccata: `is_user_banned(uuid)`, usata dalle policy con id di altri utenti. `scripts/test_definer_user_id_contract.ts` controlla la migration.
- Contract test: `scripts/test_shared_contacts_contract.ts`, `scripts/test_join_activity_no_upsert_contract.ts`, `scripts/test_profile_embed_columns_contract.ts`.

### Campi protetti del profilo (decisione 25-26/10/2026, A22/A31/R04)
- Il trigger `protect_privileged_profile_fields` (BEFORE UPDATE su `profiles`) riporta al valore precedente: `is_verified`, `impact_points`, `verification_status`, `role`, `is_banned`, `ban_reason`, `ban_report_id`, `created_at`, `badges`, `referred_by`, `referral_code`, `email`, `email_confirmed`. Vale su staging e prod (26/10).
- Il trigger decide con `auth.role()`, cioè con il ruolo del TOKEN della richiesta, non con l'utente che esegue la funzione: anche una funzione `SECURITY DEFINER` chiamata da un utente viene bloccata. Per scrivere uno di questi campi la funzione server deve prima verificare chi chiama e poi impostare `set_config('app.bypass_profile_guard', 'true', true)` (esempi: `admin_resolve_report`, `admin_review_verification`, `sync_gamification_to_profile`, `set_my_referrer`). Anche le scritture fatte da Supabase Auth senza token utente sono soggette al trigger: per questo `handle_new_user` e `sync_profile_email_confirmation` impostano l'eccezione (e filtrano il ruolo dai metadata: solo NPO/CORPORATE, il resto diventa VOLUNTEER).
- Chi accende l'eccezione la rimette al valore precedente subito dopo la scrittura (`v_prev`), altrimenti resta accesa per tutta la transazione (difetto trovato e corretto in `sync_gamification_to_profile`, 26/10).
- Il client non scrive mai questi campi: se servono, si aggiunge una funzione server dedicata, non un'eccezione nel trigger.

### Segnalazioni: chiusura e ban (decisione 25/10/2026, A31)
- Chiusura di una segnalazione solo con `admin_resolve_report(report_id, action, reason, user_agent)` via `adminNotificationService.resolveReport`: verifica ADMIN, aggiorna `reports`, applica il ban sul profilo segnalato e scrive `admin_audit_logs` nella stessa transazione. Non banna se stessi né un altro admin.
- Decisioni possibili (26/10/2026): `dismissed` (Ignora), `warned` (Avvertimento: notifica urgente all'utente segnalato), `banned` (BAN: schermata "Account sospeso"). `resolved` ("Nascondi") è stato tolto perché non nascondeva nessun contenuto; resta solo nelle segnalazioni storiche. In tutti i casi chi ha segnalato riceve «Abbiamo gestito la tua segnalazione».
- Una segnalazione si decide una volta sola: il server rifiuta una seconda decisione (`already_decided`) e la schermata di dettaglio mostra la decisione presa (stato, data, admin) al posto dei pulsanti.
- Il ban vale anche nel database (26/10/2026): `public.check_request()` è la funzione pre-request di PostgREST (`alter role authenticator set pgrst.db_pre_request`). Per un utente con `is_banned` rifiuta ogni richiesta di scrittura alla Data API (tabelle e RPC) con HTTP 403 `USER_BANNED`; restano ammesse le letture e `rpc/get_my_profile` (schermata "Account sospeso"). Lo Storage, che non passa da PostgREST, ha policy RESTRICTIVE su `storage.objects` per insert/update/delete. Non coperti: Realtime (sola lettura nell'app) e le edge function chiamate col token dell'utente. Attenzione: `check_request` gira su OGNI richiesta, un errore lì blocca tutta l'API; si modifica solo con una prova reale (lettura e scrittura) subito dopo.
- Revoca: solo `admin_revoke_ban(user_id, reason, user_agent)` via `adminNotificationService.revokeBan`, con conferma esplicita (`Alert.alert`) dalla schermata della segnalazione chiusa con BAN. Toglie il ban, scrive `UNBANNED` nell'audit log e notifica "Account riattivato"; la segnalazione resta `banned` nello storico.
- Nessuna scrittura diretta da client su `profiles` di altri utenti né su `admin_audit_logs` (non ha policy di inserimento).
- Contract test: `scripts/test_reports_admin_contract.ts`.

### Utente bannato: cosa vedono gli altri (decisione 26/10/2026, A37)
- Chi non è admin, aprendo il profilo di un bannato, vede `ProfileUnavailable` (`components/ui`): «Profilo non disponibile — Questo profilo non è più visibile su AiutarSi.». Messaggio neutro di proposito: non si rivela a terzi la sanzione. L'admin vede il profilo completo con `BannedUserBanner` (`components/admin`): motivo e «Revoca ban».
- Server: `get_public_profiles` restituisce `access = 'unavailable'` (solo id, ruolo e nome «Utente non disponibile», tutto il resto NULL) quando si chiede quel profilo per id, e lo esclude dagli elenchi senza id (scoperta). `profile_access_level` dà 'none' a un bannato per tutti tranne se stesso e l'admin, quindi le letture dirette di `profiles` non lo restituiscono (resta l'eccezione delle conversazioni in comune). Post e storie di un bannato sono nascosti agli altri (policy restrittive).
- Conseguenza per il client: un profilo annidato in una select (es. `follower:follower_id(...)`, `volunteer:volunteer_id(...)`) arriva `null` se è di un bannato. Il service scarta quelle righe o usa `?.`: un accesso diretto a `null.id` fa fallire tutta la query e la lista resta vuota. Caso reale: follower dell'ente a 0 dopo il ban di uno di loro (26/10/2026, A38).
- Al BAN (`admin_resolve_report`): iscrizioni ad attività APERTA/IN_CORSO -> CANCELLED, candidature PENDING (fatte o ricevute) -> REJECTED, e se è un ente le sue attività APERTA/IN_CORSO -> CANCELLATA (annullo soft, D05; i partecipanti ricevono «Attività annullata»). I conteggi finiscono nell'audit log. La revoca del ban non ripristina nulla.
- Il bannato sparisce anche dalle righe che lo legano ad altri (decisione di Francesco 26/10, A41): `activity_participants`, `applications`, `npo_followers`, `reviews`, `volunteer_reviews` hanno una policy RESTRICTIVE di SELECT «Banned hidden (...)»: la riga la vedono solo il bannato stesso e l'admin. Niente più «Utente non disponibile» nelle liste storiche: la card non compare. Il blocco tra utenti (`blocked_users`) è un'altra cosa e vale solo tra i due.
- Chat privata con un bannato: non si scrive più (policy RESTRICTIVE `messages_no_send_to_banned` e `send_chat_message` che risponde `recipient_unavailable`); i messaggi vecchi restano leggibili. L'app disattiva il campo di scrittura con un avviso (`ChatService.isConversationWithBannedUser`). Le chat di gruppo delle attività restano usabili dagli altri.
- Contract test: `scripts/test_banned_profile_contract.ts`, `scripts/test_banned_hidden_everywhere_contract.ts`.

### Messaggi: chi può scrivere (decisione 26/10/2026, A39)
- Una policy che deve VIETARE si crea `AS RESTRICTIVE`. Le policy permissive sono in OR: una permissiva «di divieto» come `NOT EXISTS (blocco)` è vera per tutti gli altri e da sola autorizza tutto. Caso reale: fino al 26/10 `messages_no_send_if_blocked` era permissiva e chiunque, anche anon, poteva scrivere in qualunque chat a nome di chiunque (staging e prod, senza abusi: prod non aveva messaggi).
- Su `messages` resta una sola policy INSERT permissiva, «Participants can insert messages» (solo authenticated: mittente = se stessi, partecipante della conversazione, non bannato), più `messages_no_send_if_blocked` RESTRICTIVE (chi è bloccato non scrive a chi lo ha bloccato). anon non ha INSERT/UPDATE/DELETE. L'app invia con la RPC `send_chat_message` (security definer, stessi controlli).
- Ogni nuova policy si prova anche con l'utente che NON deve poter fare l'azione. Test dal vivo: `scripts/test_security_migrations.ts` (`testMessagesInsertIsolation`, job Security RLS della CI).

### Codice amico (decisione 26/10/2026, A32)
- `referral_code` è il codice PROPRIO da condividere: ogni utente ne ha uno, lo crea il server (`generate_referral_code`: 8 caratteri maiuscoli dall'id, alternativa se occupato) all'iscrizione, in `ensure_my_profile` e con `ensure_my_referral_code()` se manca. Il client non lo scrive.
- `referred_by` ("invitato da") si imposta SOLO se l'utente inserisce un codice in onboarding, con `set_my_referrer(code)` via `authService.setMyReferrer`: ricerca senza distinzione maiuscole/minuscole, una volta sola, mai se stessi. Nessun codice = nessun invitante; non si deduce né si inventa. L'iscrizione non legge più l'invitante dai metadata.
- Il premio "Coppia Vincente" scatta alla conferma di presenza della prima attività (`on_volunteer_attendance_confirmed` → `award_activity_completion_to_user(uuid, activities)`).
- Contract test: `scripts/test_referral_contract.ts`.
