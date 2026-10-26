/**
 * Contract test: iscrizione a un'attività senza upsert (2026-10-26).
 *
 * Bug: "handleConfirm failed" in review-application.tsx all'iscrizione. Causa verificata su staging
 * (stesso utente, transazione annullata): profileRest.joinActivity usava un upsert
 * (on_conflict=activity_id,user_id + resolution=merge-duplicates). ON CONFLICT DO UPDATE legge
 * excluded.phone/email/message e Postgres richiede il SELECT su quelle colonne, chiuso da A30
 * per proteggere i contatti -> 403 / 42501 "permission denied for table activity_participants".
 * INSERT semplice e UPDATE con WHERE su activity_id/user_id funzionano.
 *
 * Run: npx tsx scripts/test_join_activity_no_upsert_contract.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const source = fs.readFileSync(path.join(__dirname, "..", "utils", "profileRest.ts"), "utf-8");
const start = source.indexOf("joinActivity: async (");
assert(start !== -1, "profileRest.joinActivity deve esistere");
const end = source.indexOf("leaveActivity:", start);
assert(end !== -1, "leaveActivity deve seguire joinActivity");
const body = source.slice(start, end);

console.log("\n[join-activity] nessun upsert su activity_participants");
assert(!body.includes("merge-duplicates"), "joinActivity non deve usare resolution=merge-duplicates (richiede SELECT su phone/email/message, chiuso da A30)");
assert(!body.includes("on_conflict"), "joinActivity non deve usare on_conflict");
console.log("  ✓ niente upsert");

console.log("\n[join-activity] INSERT, poi UPDATE della riga esistente");
assert(/"POST",\s*`\/rest\/v1\/activity_participants`/.test(body), "prima un INSERT semplice su activity_participants");
assert(body.includes("23505"), "la riga già presente (23505) va gestita riattivandola");
assert(body.includes('"PATCH"') && body.includes("activity_id=eq.${activity_id}&user_id=eq.${user_id}"), "la riattivazione aggiorna la riga per activity_id e user_id");
assert(/select=activity_id`/.test(body), "il RETURNING dell'UPDATE chiede solo colonne leggibili (activity_id), mai phone/email/message");
assert(body.includes("JOIN_NOT_REACTIVATABLE"), "0 righe aggiornate (policy) deve essere un errore, non un successo silenzioso");
console.log("  ✓ INSERT + UPDATE con RETURNING su colonne leggibili, 0 righe = errore");

console.log("\njoin-activity-no-upsert contract: OK");
