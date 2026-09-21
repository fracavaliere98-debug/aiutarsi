# Design Critique: Schermata "Crea/Modifica Attività" (NPO)

Basata su `docs/design/activity-form-ux-review-handoff.md` (contesto, storia delle iterazioni, vincoli di business) e sul codice sorgente attuale di `components/npo/ActivityForm.tsx`. Heuristic evaluation — nessun test con utenti reali disponibile (vedi §9 dell'handoff).

## Overall Impression

Il redesign a 5 sezioni è un miglioramento reale rispetto alla versione originale a 11 card uniformi — la gerarchia dichiarata è quasi giusta, ma non è rinforzata a sufficienza dalla tipografia e dallo stile dei campi, che restano quasi piatti tra loro. Il problema principale non è la struttura ma la **coerenza dei dettagli** (etichette, bordi, ombre) e due scelte di interazione (orari a testo libero, priorità visiva dell'urgenza) che non riflettono l'importanza reale dei dati per il target utente dichiarato (referenti NPO, spesso anziani/poco digitali).

## Usability

| Finding | Severity | Recommendation |
|---|---|---|
| Inizio/Fine sono `TextInput` a testo libero senza time-picker né maschera — per un target con bassa alfabetizzazione digitale, digitare "10:00" a mano è un punto di attrito e di errore reale, con validazione solo al submit | 🔴 Critical | Sostituire con un time-picker nativo/bottom-sheet, riusando lo stesso pattern già adottato per Data e Ricorrenza (coerenza di interazione: tutto ciò che è "temporale/enumerabile" si sceglie da un picker, non si digita) |
| "Migliora con AI" e la rifinitura automatica silenziosa (flusso "Rilancia con AI") non lasciano alcuna traccia visiva che il testo sia stato generato/alterato dall'AI | 🟡 Moderate | Aggiungere un piccolo badge "Generato con AI" o simile accanto alla descrizione quando è stata toccata dall'AI — questione di fiducia, non solo estetica |
| 14 chip competenze in `flex-wrap` occupano 4-5 righe intere prima di arrivare a "Altre opzioni" | 🟡 Moderate | Valutare un limite a "mostra altre" (es. 6 chip + link "Altre competenze") o raggruppamento per area, specie visto il target utente |
| L'asimmetria "indirizzo non confermato blocca solo in creazione" non è mai spiegata all'utente, solo implicita nel colore del messaggio | 🟢 Minor | In modifica, se non confermato, chiarire nel testo che il salvataggio procederà comunque ("non blocca il salvataggio" è già presente ma potrebbe essere più esplicito sul perché) |

## Visual Hierarchy

- **What draws the eye first**: in modalità creazione, la card foto (riga compatta, 44×44) è comunque il primo elemento sopra "Cosa organizzi" — che l'handoff dichiara priorità massima. È un campo opzionale che vince la prima posizione. Non è necessariamente sbagliato (può fungere da "riscaldamento" a basso impatto cognitivo), ma **non è stato deciso, è successo**: vale la pena scegliere consapevolmente se spostare Titolo/Categoria per primi o confermare la foto come apertura intenzionale.
- **Reading flow**: buono in verticale (foto → identità → logistica → contenuto → opzioni → CTA), ma **piatto orizzontalmente**: tutti i titoli di sezione condividono lo stesso `font-black text-base`, indipendentemente dal fatto che "Cosa organizzi" sia dichiarata priorità massima e "Altre opzioni" priorità minima — l'unica differenziazione è lo sfondo semi-trasparente di quest'ultima, non la tipografia del titolo.
- **Emphasis**: "Segnala come urgente" — che ha impatto diretto sul matching con i volontari, quindi è un campo con conseguenze di business reali — è visivamente equivalente alla ricorrenza dentro lo stesso blocco a bassa priorità. Questo sottostima un campo che nella pratica è più simile per importanza a "Categoria" che a "Ricorrenza".

## Consistency

| Element | Issue | Recommendation |
|---|---|---|
| Bordo card | Coesistono due token per lo stesso bordo "standard": `border-primary/5` (Titolo, Inizio, Fine, Descrizione) vs `#ede9fe` letterale (Data, Volontari) — nessuno dei due è documentato come standard nel design-system | Unificare su un solo token (idealmente `colors.primary` con opacità, coerente con la tabella token dell'handoff) |
| Ombra card | `shadow-sm` (classe NativeWind) su alcune card vs `shadowOpacity: 0.03, shadowRadius: 4, elevation: 1` inline su altre (Data/Volontari) — stesso effetto voluto, due implementazioni diverse che possono divergere silenziosamente | Estrarre un componente condiviso (`FormFieldCard`) invece di ripetere lo stile 6+ volte |
| Etichette di campo | Due stili coesistono per lo stesso livello gerarchico: uppercase + tracking-widest (Titolo, Categoria, Competenze) vs minuscolo non-uppercase (Data, Volontari, Inizio, Fine, Indirizzo) — già segnalato come domanda aperta nell'handoff (§6.3), confermo qui che è un'inconsistenza reale, non solo percepita | Scegliere una sola convenzione per "etichetta di campo" e applicarla ovunque |

## Accessibility

- **Color contrast**: le etichette di campo a 10-11px usano `text-secondary/60` o `/70` (opacità ridotta) su sfondo bianco — combinazione a rischio per il contrasto WCAG AA su testo così piccolo, aggravata dall'uppercase (riduce ulteriormente la leggibilità). Data la dichiarazione esplicita nell'handoff che il target utente include persone anziane, questo è il rilievo di accessibilità più importante della schermata: da verificare con un color-contrast checker e, se necessario, alzare sia la dimensione minima sia l'opacità.
- **Touch target**: le 14 chip competenze hanno etichette già accorciate a una parola per stare in spazio ridotto — verificare che il padding non sia sceso sotto ai 44×44px minimi consigliati, specie ora che il testo è più corto e la tentazione è di restringere il chip.
- **Text readability**: Inizio/Fine non hanno `keyboardType` numerico dedicato — oltre a essere un problema di usabilità (sopra), è anche un problema di accessibilità per chi usa tastiere assistive, che si aspetterebbe un input numerico per un orario.

## What Works Well

- Il raggruppamento in 5 sezioni con "Altre opzioni" a sfondo distinto è concettualmente corretto: separa correttamente ciò che serve sempre da ciò che è secondario.
- Il CTA di invio sticky in fondo, sempre visibile fuori dallo scroll, è la scelta giusta per un form lungo su mobile.
- Il feedback immediato su indirizzo confermato/non confermato (icona + testo colorato inline, non solo un errore al submit) è un buon pattern di conferma progressiva.
- Le etichette dei campi obbligatori impliciti sono ragionevoli (titolo, indirizzo, descrizione, fine, data) e i default sensati (categoria "Sociale") riducono il carico su campi opzionali.

## Priority Recommendations

1. **Unificare lo stile delle etichette di campo e verificarne il contrasto** — è la modifica a più alto rapporto impatto/sforzo: risolve in un colpo solo l'inconsistenza tipografica (§Consistency) e il rischio di accessibilità (§Accessibility), toccando un'unica definizione di stile invece di ~8 punti diversi nel file.
2. **Sostituire Inizio/Fine con un time-picker** riusando il pattern bottom-sheet già presente per Data/Ricorrenza — rimuove il punto di attrito più concreto per il target utente dichiarato (basso digitale) e rende l'interazione coerente con il resto del form (tutto ciò che è temporale si sceglie, non si digita).
3. **Dare a "Segnala come urgente" una card propria**, fuori dal blocco condiviso con la ricorrenza, con un accento visivo quando attivo (bordo colorato o badge) — allinea il peso visivo all'impatto reale sul matching.

Se vuoi, procedo a implementare questi 3 punti nel componente (nessuno tocca la logica di validazione in `activityFormLogic.ts`, solo `ActivityForm.tsx`).
