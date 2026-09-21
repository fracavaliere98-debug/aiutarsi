# Go-to-Market: piano di lancio pilota

## Scope
Come far conoscere AiutarSi ai primi utenti reali (volontari e ONP), evitando l'errore tipico dei marketplace a due lati: aprire canali pubblici prima di avere qualcosa di reale da mostrare.

## 2026-09-21: strategia in 4 fasi definita, zona pilota scelta, community esterna posticipata a fase 3

Richiesta iniziale: creare una community esterna (Facebook/Telegram) per attirare persone verso l'app. Prima di eseguirla, verificato che l'app non è ancora pubblicata sugli store — aprire ora un canale pubblico avrebbe rischiato di essere un errore di sequenza (gruppo vuoto o link a un'app non scaricabile, prima impressione bruciata e difficile da recuperare).

### Le 4 fasi concordate

1. **Fase 0 — gate tecnico.** Completare quanto manca alla pubblicazione (vedi `docs/prod-migration-checklist.md`). Non blocca il resto: si lavora in parallelo.
2. **Fase 1 — pre-lancio manuale, non scalabile di proposito.** Contattare direttamente 5-15 ONP in UNA sola zona pilota (non tutta Italia), farsi caricare le loro attività reali PRIMA del lancio pubblico. Obiettivo: il giorno del lancio, un volontario che apre l'app in quella zona trova già qualcosa di vero, non uno spazio vuoto.
3. **Fase 2 — lancio concentrato.** Push coordinato nella stessa zona: le ONP già a bordo condividono con le loro reti, si attiva il referral in-app (già esistente, step onboarding "invite-friend") tra i primi volontari, contatto con il CSV locale e con la stampa locale.
4. **Fase 3 — community esterna.** Solo qui ha senso, come cassa di risonanza di qualcosa che già funziona, non come motore di partenza. Il piano completo (struttura gruppo Facebook + canale Telegram, ruoli, calendario di lancio, growth loop legato a referral/gamification) è già pronto: `AiutarSi - Piano Community Esterna.docx` nella cartella di lavoro dell'utente.
5. **Fase 4 — replica.** Ripetere il playbook città per città una volta validato, non aprire tutto insieme.

### Zona pilota: Monza e Brianza

Scelta sopra Milano perché l'utente è basato lì: la presenza fisica per incontrare le ONP di persona pesa più della densità teorica di associazioni, soprattutto partendo da zero contatti. Lista più corta e gestibile, più facile ottenere attenzione dalla stampa locale, e se il playbook funziona si allarga a Milano città metropolitana dopo, con qualcosa già dimostrato in mano.

### Contatti e risorse reali (verificati via web search, non a memoria)

- **CSV di riferimento**: Centro di Servizio per il Volontariato Monza Lecco Sondrio, ufficio di Monza — via Correggio Allegri 59, tel. 039 2848308, email monzaebrianza@csvlombardia.it. Primo interlocutore da contattare: se anche solo questo CSV segnala AiutarSi alla propria rete di associazioni, il leverage è enorme rispetto a un contatto ONP per volta.
- **Liste di partenza per i target ONP**: [ccv-mb.org — Organizzazioni di Volontariato](https://www.ccv-mb.org/organizzazioni-di-volontariato.html), [provincia.mb.it — sezione terzo settore](https://www.provincia.mb.it/Temi/terzo-settore/centro-servizi-volontariato-csv/).

### Stato / prossimi passi (non ancora fatti a questa data)

- [ ] Costruire la lista concreta dei primi 20-30 target ONP (nome, settore, contatti) dalle fonti sopra.
- [ ] Scrivere lo script/messaggio di primo contatto per CSV e per le singole ONP.
- [ ] Avere una build demo funzionante da mostrare (vedi `docs/prod-migration-checklist.md`, sezione build interim 2026-09-21) — bloccato sull'accesso a un device Android per la demo dal vivo.
- [ ] Primo contatto con il CSV Monza Lecco Sondrio.

**Why:** l'utente voleva sapere se la community avesse valore e come farsi conoscere. La risposta non era eseguire subito il piano community già pronto, ma valutare il sequencing e proporre un cold-start "concierge" (poche ONP pilota con relazione diretta) invece di un canale pubblico che nessuno avrebbe riempito.

**How to apply:** non considerare la fase 1 chiusa finché la lista ONP e il primo contatto CSV non sono stati fatti davvero — sono i due elementi che sbloccano tutto il resto (contenuti da mostrare nell'app al lancio, primi volontari attivabili via referral). Se si riprende questo lavoro, ripartire dai due checkbox sopra invece di rivalutare da capo la strategia.
