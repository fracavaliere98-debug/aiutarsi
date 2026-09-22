# Backlog miglioramenti

Punti segnalati e non ancora affrontati: solo da verificare/valutare, non
implementati (salvo dove indicato). Ogni voce ha una checkbox e la data in
cui è stata annotata; quando si passa all'implementazione, spostare il punto
nel piano/doc pertinente (o in una issue) e rimuoverlo da qui.

## 2026-09-22

- [x] **Gemma — accesso a documentazione aggiornata. VERIFICATO 2026-09-22:
  no, è statica e datata.** Il contesto passato a Gemma (`supabase/functions/gemma-help-assistant/index.ts`)
  viene costruito da `buildHelpCenterContextForRole()` in `shared/helpCenterContent.ts`
  — un elenco di FAQ scritte a mano nel codice, non collegato a nessuna fonte
  di documentazione live (non legge `docs/`, non fa retrieval, nessun
  aggiornamento automatico). Ultima modifica a quel file: 31 marzo 2026
  (commit `8d8b9eb`). La funzionalità di conferma presenza/XP (migration
  `20260921150000_attendance_confirmation.sql`, del 21 settembre) NON è
  ancora coperta da nessuna FAQ: Gemma oggi non sa spiegare a un volontario
  perché è "in attesa conferma" né a una NPO come/dove confermare le
  presenze. **Azione consigliata** (non ancora fatta): aggiungere una sezione
  FAQ dedicata alla conferma presenze in `shared/helpCenterContent.ts` (comune
  ai due ruoli o come sotto-sezione NPO/volontario) e, più in generale,
  introdurre un promemoria di processo — quando si aggiunge una feature
  visibile all'utente, aggiornare anche questo file — perché oggi non c'è
  nessun collegamento automatico che lo forzi.

- [ ] **Reminder conferma presenza — CTA per il volontario.** Nella
  schermata "Valuta la tua esperienza", quando in basso è mostrato lo stato
  "in attesa conferma", aggiungere una CTA affiancata per inviare un reminder
  all'associazione (NPO) di confermare la presenza, con notifica che arriva
  alla NPO. **Localizzato 2026-09-22, non implementato**: il blocco esatto è
  in `app/activity/[id].tsx`, ramo `isWaitingPresenceConfirmation` (righe
  ~158-163 la condizione, ~767-780 il box "In attesa conferma" — oggi solo
  testo, nessuna CTA). Serve una nuova notifica verso la NPO (tipo dedicato o
  riuso di `ACTIVITY_UPDATE`/`ACTIVITY_COMPLETED` con `related_activity_id`)
  e probabilmente un rate-limit per evitare reminder ripetuti a raffica sullo
  stesso volontario/attività. Cambio di comportamento visibile a
  NPO/volontari → serve ok esplicito prima di implementare (regola di
  progetto).

  - [x] **Verificato 2026-09-22: NO, non esiste nessuna regola di
    auto-conferma dopo 72h.** In `supabase/migrations/20260921150000_attendance_confirmation.sql`
    solo la NPO proprietaria può impostare `volunteer_reviews.is_present =
    true` (trigger `guard_volunteer_review_attendance`, security definer,
    nessun bypass lato client). Nessun cron job, nessun trigger a tempo:
    grep su tutte le migration e su `supabase/functions/` per `is_present`/
    cron non trova nessuna logica di conferma automatica. Se la NPO non
    conferma, il volontario **non riceve XP/ore/badge, a tempo indefinito** —
    è esattamente il motivo per cui la CTA di reminder (punto sopra) ha senso.
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
