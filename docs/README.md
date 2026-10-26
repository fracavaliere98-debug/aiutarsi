# Documentazione Tecnica

- [Architettura tecnica](./architecture.md)
- [Piano migrazione server state](./server-state-migration-plan.md)
- [Linee guida — accesso ai dati e service layer](./data-access-guidelines.md)
- [Design system](./design-system.md)
- [Checklist migrazione a produzione](./prod-migration-checklist.md)
- [Piano migrazione Expo SDK 57](./sdk-57-migration-plan.md)
- [Backlog miglioramenti](./backlog-miglioramenti.md)
- [Piano go-to-market / lancio pilota](./go-to-market-pilot.md)

## Regole di lavoro

### Una sola fonte di verita'

Ogni informazione ha un solo posto. Se la trovi in due posti, uno dei due e' sbagliato: correggi la fonte e togli la copia. Non si creano file paralleli: si aggiornano quelli che esistono. Prima di dire «fatto», si aggiorna la documentazione.

| Cosa | Fonte unica |
| --- | --- |
| Stato delle task, passi, prossimo passo, chat, design collegati | Registro AiutarSi (artifact su claude.ai): schede Adesso, Epiche, Chat, Design |
| Decisioni, errori e lezioni, scoperte, rilasci | Registro › Storico (le decisioni architetturali importanti anche come Decision Log in `docs/`) |
| Regole di codice, architettura, accesso ai dati, interfaccia | File in `docs/` (questo indice; `design-system.md` per la UI) |
| Flusso di rilascio (CI, OTA preview e production) | `.github/workflows/` e `README.md` › Production |
| Stato di staging e produzione | Registro › Salute (letto dal vivo) e `prod-migration-checklist.md` (va riverificato) |
| Istruzioni di lavoro per Claude | Istruzioni del progetto su claude.ai: solo regole stabili, mai lo stato del lavoro |

### Prima di cominciare

1. Leggi la scheda della task nel Registro (perche', passi, cosa manca, decisioni aperte).
2. Cerca nello Storico l'argomento: decisioni gia' prese ed errori gia' fatti.
3. Controlla se un'altra chat e' gia' aperta sulla stessa task.

### Prima di dire «fatto»

1. I file di `docs/` toccati dal lavoro sono aggiornati; se cambia una regola, si aggiorna questo indice o il file di competenza.
2. La task nel Registro ha passi, prossimo passo, stato ed evidenza coerenti con la realta'.
3. Ogni decisione, errore, scoperta o rilascio ha la sua voce nello Storico, con la lezione per gli errori.
4. Ogni stato e' etichettato VERIFIED, ASSUMED, TODO o BLOCKED.
5. Se hai toccato una migration o `app/`, `components/`, `shared/`: alza `HELP_CENTER_LAST_REVIEWED` in `shared/helpCenterContent.ts` alla data del commit ed esegui `npm run test:regression`.
6. Se un passo richiede una prova di Francesco sul telefono, non basta scrivere «Prova sul telefono»: resta un solo passo, e nella nota ci sono i punti da provare, numerati e brevi (cosa fare, cosa deve succedere, cosa preparare prima).
