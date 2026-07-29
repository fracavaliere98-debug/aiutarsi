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

## 7. Violazioni note da correggere (stato: 24/07/2026)

- `app/(npo)/settings/privacy.tsx`: fetch/update `profiles` diretti, bypassa Sezione 2 e Sezione 3 — non ancora corretto.
- `app/(npo)/settings/security.tsx`: toggle "Autenticazione a due fattori" senza alcuna persistenza reale (fuori scope di queste linee guida, ma segnalato: è un problema di fiducia utente, non di data access).
- Sezione 5: ~44 chiamate `Alert.alert` fuori dalle schermate impostazioni (auth, messaggistica, admin, `edit-activity`, `blocked-users`, `community/create-post`, `npo-profile/[id]`, `_layout.tsx`) non ancora riclassificate secondo le 4 categorie — da fare in una passata dedicata, file per file, verificando eventuali `onPress` con effetti reali prima di convertire.

Corrette in questa sessione (non più in lista): `alert()` nativo in `review-application.tsx`/`(npo)/settings/edit-profile.tsx`/`onboarding/profile.tsx`; `Alert.alert` a un bottone senza continuazione in `(volunteer)/settings/security.tsx`.

Questa sezione va aggiornata man mano che le violazioni vengono chiuse, così il documento resta uno specchio dello stato reale e non una lista aspirazionale.
