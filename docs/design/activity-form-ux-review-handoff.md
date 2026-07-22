# Handoff per revisione UX/UI — Schermata "Crea/Modifica Attività" (NPO)

Documento preparato per un audit di design indipendente. Contiene contesto, stato attuale, vincoli di business e codice sorgente completo, in modo che chi lo riceve non debba avere accesso al repo per formulare un giudizio informato.

## 1. Contesto

AiutarSì è un'app React Native/Expo che connette volontari e organizzazioni non profit (NPO) in Italia. Questa è la schermata con cui un referente di un ente pubblica una nuova attività di volontariato o modifica una esistente. È una delle azioni più frequenti compiute da un utente NPO ed è quindi ad alta priorità per la qualità dell'esperienza.

**Chi la usa**: referenti di associazioni/ONLUS, spesso su smartphone, spesso in mobilità o tra un'attività e l'altra — non davanti a una scrivania. Molti non sono utenti "power" di app, spesso persone anziane o con basse competenze digitali (dato di contesto del progetto).

**Un solo componente, due schermate**: `create-activity.tsx` e `edit-activity/[id].tsx` sono wrapper sottili — tutta la UI vive in un unico componente condiviso, `components/npo/ActivityForm.tsx`, con una prop `mode: "create" | "edit"` che cambia solo submit label, titolo header, disponibilità del pulsante elimina e alcune regole di validazione (vedi sezione 5). Il codice sorgente completo è in appendice.

## 2. Storia recente (perché il layout è così com'è)

La schermata ha attraversato diverse iterazioni in rapida sequenza, sulla base di feedback diretto dell'utente/prodotto:

1. **Versione originale**: 11 blocchi separati, ognuno una card bianca con ombra propria e margine verticale identico (24px) indipendentemente dall'importanza del campo. Foto in cima con un riquadro di 192px di altezza. Nessuna gerarchia visiva — feedback ricevuto: *"troppo dispersivo, troppi spazi, non si capisce a cosa dare priorità, visivamente è un casino"*.
2. **Primo redesign**: raggruppamento in 5 sezioni con intestazioni ("Cosa organizzi", "Quando e dove", "Descrizione", "Competenze", "Altre opzioni"), foto ridotta a riga compatta, competenze/urgente/ricorrenza spostate in fondo a bassa priorità visiva.
3. **Correzioni puntuali**: la foto è stata rimessa in cima alla schermata (priorità percepita diversa da quella assunta inizialmente); ripristinate le etichette esplicite "Titolo attività" e "Categoria" (nel redesign erano state rimosse a favore del solo placeholder); "Posti" rinominato in "Quanti volontari serviranno?" per essere più esplicito; le 14 etichette delle competenze accorciate da frasi di 2-3 parole a una parola singola (es. "Assistenza e Compagnia" → "Assistenza") per leggibilità delle chip.
4. **Ricorrenza**: da un selettore a 3 pulsanti affiancati (Nessuna/Sett./Mens.) a un campo "dropdown" che apre un bottom sheet con 3 opzioni esplicite e una descrizione per ciascuna.

**Perché questo conta per chi rivede il design**: la sequenza mostra che le prime due iterazioni sono state guidate da intuizione/euristica, non da un test con utenti reali o da un framework di analisi strutturato. È probabile che esistano altri problemi di gerarchia/leggibilità non ancora emersi. Da qui la richiesta di uno studio UX/UI più rigoroso.

## 3. Architettura informativa attuale

Ordine dall'alto in basso, con la priorità *dichiarata* (non necessariamente validata):

1. **Foto attività** (opzionale) — riga compatta: thumbnail 56×56, testo "Aggiungi una foto" / "Cambia foto" + sottotitolo.
2. **Cosa organizzi** (sezione, priorità massima dichiarata)
   - Titolo attività — text input, unico campo a font-size 18/bold nell'intera schermata
   - Categoria — chip a selezione singola, obbligatoria implicitamente (ha un default, "Sociale")
3. **Quando e dove** (sezione)
   - Data — riga con icona calendario, apre un modal calendario a comparsa dal basso
   - Inizio / Fine — due input di testo libero affiancati (formato "HH:mm", **nessuna validazione di formato in UI**, solo testo libero)
   - Indirizzo — autocomplete con stato "confermato/non confermato" mostrato sotto (icona + testo colorato)
4. **Descrizione** (sezione)
   - Textarea multilinea + pulsante "Migliora con AI" (chiama un servizio esterno, mostra stato di caricamento "Gemma al lavoro...")
   - "Quanti volontari serviranno?" — input numerico compatto
5. **Competenze richieste (opzionale)** (sezione) — 14 chip multi-selezione, etichette a una parola
6. **Altre opzioni** (sezione, sfondo grigio chiaro, priorità visiva più bassa)
   - Ricorrenza — campo "dropdown" che apre un bottom sheet con 3 opzioni (Nessuna/Settimanale/Mensile), ciascuna con una riga di descrizione
   - Segnala come urgente — switch, con vincolo di business (max 3 attività urgenti attive per ente, applicato lato UI con un toast di errore se superato)
7. **Elimina questa attività** — solo in modalità modifica, link testuale rosso sotto tutto il resto, disabilitato durante il salvataggio
8. **CTA di invio** — pulsante sticky in fondo allo schermo (fuori dallo scroll), sempre visibile

## 4. Design tokens attualmente in uso

Fonte: `theme/colors.ts` e `theme/primitives.ts`.

| Token | Valore hex | Uso in questa schermata |
|---|---|---|
| `colors.primary` | `#462282` (viola) | testo principale enfatizzato, icone attive, bordi selezionati |
| `colors.accent` | `#cd057f` (magenta) | CTA di invio (submit), switch attivo |
| `colors.textSecondary` | `#4B5563` | testo icone neutre |
| bordo card standard | `border-primary/5` → viola al 5% di opacità | bordo sottile su ogni card bianca |
| sfondo "Altre opzioni" | `bg-white/60` | unico blocco con sfondo semi-trasparente, per segnalare priorità minore |
| verde stato "confermato" | `#22c55e` | indirizzo confermato |
| ambra stato "da confermare" | `#f59e0b` | indirizzo non confermato |
| rosso elimina | `#EF4444` | link elimina attività |

Tipografia: nessun sistema di type-scale esplicito nel file — i valori sono inline (`text-lg`, `text-base`, `text-sm`, `text-xs`, `text-[10px]`, `text-[11px]`) misti a `font-black`, `font-bold`, `font-semibold`, `font-medium`. Non c'è una convenzione dichiarata tra "titolo di sezione" e "etichetta di campo" al di fuori di quanto descritto sopra (sezione: `font-black text-base`; etichetta campo minuscola: `text-[10px] uppercase tracking-widest` oppure `text-[10px] font-semibold` non-uppercase — le due varianti coesistono nello stesso schermo, vedi "Data/Inizio/Fine" vs "Titolo attività/Categoria").

## 5. Vincoli di business che il design deve rispettare

Questi comportamenti sono testati automaticamente (`scripts/test_activity_form_contract.ts`) e **non vanno rimossi o aggirati** da eventuali proposte di redesign, solo eventualmente ri-espressi visivamente:

- Campi obbligatori: titolo, indirizzo, descrizione, orario di fine, data. **Non** obbligatori (contro-intuitivo, comportamento storico): orario di inizio, numero posti, categoria.
- La conferma dell'indirizzo (dal suggerimento autocomplete) blocca l'invio **solo in creazione**, mai in modifica.
- L'orario di fine deve essere strettamente successivo all'inizio (stesso giorno).
- In creazione, non si può selezionare una data/ora nel passato.
- In modifica, un'attività già passata resta modificabile liberamente; una futura non può essere spostata nel passato.
- Massimo 3 attività "urgenti" attive per ente contemporaneamente (conteggio esclude l'attività corrente se in modifica).
- Il link "Elimina" deve restare disabilitato mentre è in corso un salvataggio.
- Arrivando dal flusso "Rilancia con AI" (duplicazione di un'attività passata di successo), la descrizione viene rifinita automaticamente da un servizio AI una sola volta, silenziosamente, appena il titolo precompilato è disponibile.

## 6. Domande aperte per lo studio UX/UI

Queste sono le aree che non sono state validate con metodo, solo per intuizione — probabilmente il punto di partenza più utile per l'analisi:

1. **Gerarchia reale vs dichiarata**: la sezione "Cosa organizzi" è in seconda posizione (dopo la foto) nonostante sia dichiarata come priorità massima. È corretto avere un elemento opzionale (la foto) come primissima cosa vista/toccata?
2. **Densità delle competenze**: 14 chip multi-selezione in un `flex-wrap` possono occupare 4-5 righe. È la modalità di selezione giusta per questo numero di opzioni, o servirebbe un pattern diverso (ricerca, categorie, "mostra tutte")?
3. **Coerenza delle etichette di campo**: coesistono due stili (uppercase+tracking vs. non-uppercase) per lo stesso livello gerarchico (etichetta di campo dentro una sezione) — es. "Data/Inizio/Fine" non sono uppercase, "Titolo attività/Categoria" sì.
4. **Orari come testo libero**: Inizio/Fine sono `TextInput` liberi con placeholder "10:00"/"12:00", senza time-picker né validazione di formato in tempo reale — un utente può scrivere qualunque stringa; l'unico controllo è "fine dopo inizio" al submit. Vale la pena un time-picker nativo?
5. **Blocco "Altre opzioni"**: ricorrenza e "segnala urgente" condividono un unico blocco a bassa priorità visiva (sfondo semi-trasparente). Sono davvero equivalenti per importanza? "Urgente" ha un impatto diretto sul matching con i volontari — potrebbe meritare più risalto.
6. **CTA sticky vs contenuto**: il pulsante di invio è assoluto in fondo allo schermo, sempre sopra il contenuto scrollabile — verificare che non copra mai contenuto utile (in particolare su schermi piccoli con tastiera aperta) e che il padding-bottom del contenuto (`pb-12`) sia sufficiente su tutti i device target.
7. **Contrasto colore**: diversi testi secondari usano opacità (`text-secondary/60`, `text-secondary/70`) su sfondo bianco — verificare che rispettino WCAG AA per testo piccolo (in particolare le etichette 10-11px).
8. **Feedback dell'assistente AI**: "Migliora con AI" e la rifinitura automatica silenziosa (flusso "Rilancia con AI") non hanno indicazioni visive distinte — un utente potrebbe non capire se la descrizione è stata scritta da lui o generata dall'AI.
9. **Indirizzo non confermato**: il messaggio di errore ("Seleziona un suggerimento...") appare solo sotto il campo, in modifica non blocca mai — chiarire se questa asimmetria create/edit sia comunicata chiaramente all'utente o sia solo un vincolo tecnico invisibile.

## 7. Appendice A — codice sorgente completo, `components/npo/ActivityForm.tsx`

```tsx
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Calendar, Users, Send, Clock, CheckCircle2, AlertCircle, RefreshCw, Trash2, ChevronDown, Check } from "lucide-react-native";
import { StandardLayout } from "../StandardLayout";
import { AddressAutocomplete } from "../AddressAutocomplete";
import { CalendarPicker } from "../CalendarPicker";
import { SKILLS } from "../../constants/Skills";
import { ACTIVITY_CATEGORIES } from "../../constants/Interests";
import { gemmaService } from "../../services/GemmaService";
import { requestMediaLibraryPermission } from "../../utils/permissions";
import { useToast } from "../../context/ToastContext";
import { colors } from "@/theme";
import { getInitialCoordsConfirmed, shouldAutoCurateDraft, validateActivityFormSubmit } from "./activityFormLogic";

export type ActivityFormValues = {
    title: string;
    category: string;
    address: string;
    lat: number;
    lng: number;
    date: string;
    slots: string;
    description: string;
    startTime: string;
    endTime: string;
    isUrgent: boolean;
    skills: string[];
    imageUrl?: string;
    recurrence: "NONE" | "WEEKLY" | "MONTHLY";
};

const RECURRENCE_LABELS: Record<ActivityFormValues["recurrence"], string> = {
    NONE: "Nessuna ricorrenza",
    WEEKLY: "Ogni settimana",
    MONTHLY: "Ogni mese",
};

const RECURRENCE_OPTIONS: { value: ActivityFormValues["recurrence"]; label: string; description: string }[] = [
    { value: "NONE", label: "Nessuna ricorrenza", description: "L'attività si svolge una volta sola." },
    { value: "WEEKLY", label: "Ogni settimana", description: "Si ripete automaticamente ogni settimana." },
    { value: "MONTHLY", label: "Ogni mese", description: "Si ripete automaticamente ogni mese." },
];

// ... (Props type, component body: vedi repo per il file completo — questo handoff include la
// versione integrale al momento della stesura; il file può essere aggiornato dopo la revisione)
```

> Nota: il blocco sopra è troncato per leggibilità del documento. Il file integrale (~520 righe) è disponibile nel repository a `components/npo/ActivityForm.tsx`; la struttura JSX rilevante per il design è interamente descritta in Sezione 3.

## 8. Appendice B — regole di validazione pura, `components/npo/activityFormLogic.ts`

Queste funzioni sono la fonte di verità per il comportamento descritto in Sezione 5 (nessun hook, nessun rendering — pura logica testabile):

- `hasAllRequiredFields(values)` — titolo, indirizzo, descrizione, orario fine, data.
- `isEndBeforeOrEqualStart(date, startTime, endTime)` — vero se fine ≤ inizio.
- `getInitialCoordsConfirmed(address)` — vero se l'indirizzo iniziale non è vuoto.
- `shouldBlockSubmitForUnconfirmedAddress(mode, coordsConfirmed)` — blocca solo se `mode === "create"`.
- `validateActivityFormSubmit(mode, values, coordsConfirmed)` — compone le tre validazioni sopra, in quest'ordine: campi obbligatori → indirizzo non confermato → orari invertiti.
- `shouldAutoCurateDraft({...})` — guard per l'auto-rifinitura AI (una sola volta, solo da "Rilancia con AI").
- `countActiveUrgentActivities(activities, npoId, excludeActivityId?)` — conta urgenti attive (stato APERTA/IN_CORSO) per ente.
- `wasFutureActivityMovedToPast(originalDateTime, newStartISO, now?)` — blocca solo lo spostamento di un'attività futura nel passato.

## 9. Cosa NON è ancora stato validato

Questo documento descrive lo stato del codice al momento della stesura. Non include: screenshot reali su device, metriche di completamento del form, tempo medio di compilazione, tasso di abbandono per campo, o test con utenti NPO reali. Uno studio UX/UI dovrebbe idealmente partire da questi dati se disponibili, altrimenti trattare questo documento come base per un'euristica esperta (heuristic evaluation) piuttosto che una validazione empirica.
