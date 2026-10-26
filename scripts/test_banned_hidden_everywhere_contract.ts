/**
 * Contract test A41 (2026-10-26): un utente bannato sparisce per gli altri da iscrizioni, candidature,
 * follower, recensioni e valutazioni; le chat private con lui non accettano piu' messaggi.
 * Controllo statico (no DB). La prova reale e' registrata nel Registro (staging, transazione annullata).
 * Run: npx tsx scripts/test_banned_hidden_everywhere_contract.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}
const ROOT = join(__dirname, "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

const sql = read("supabase", "migrations", "20261026220000_a41_banned_hidden_everywhere.sql");
for (const table of ["activity_participants", "applications", "npo_followers", "reviews", "volunteer_reviews"]) {
  const re = new RegExp(`create policy "[^"]+" on public\\.${table}\\s+as restrictive for select`);
  assert(re.test(sql), `${table}: serve una policy RESTRICTIVE di SELECT che nasconde le righe dei bannati`);
}
assert(/is_current_user_admin\(\)/.test(sql), "L'admin deve continuare a vedere le righe dei bannati");
assert(/as restrictive for insert to authenticated\s+with check \(not public\.is_private_conversation_with_banned/.test(sql), "Insert diretto su messages bloccato nelle chat private con un bannato");
assert(/RAISE EXCEPTION 'recipient_unavailable'/.test(sql), "send_chat_message deve rifiutare l'invio a un bannato");
assert(/c\.type = 'PRIVATE'/.test(sql), "Il blocco vale solo per le chat private, non per i gruppi delle attivita'");

const chat = read("app", "messages", "[id].tsx");
assert(/useConversationBannedPeerQuery\(/.test(chat), "La chat deve sapere se l'interlocutore e' bannato");
assert(/if \(isWithBannedUser\) return BANNED_CHAT_MESSAGE;/.test(chat), "Campo di scrittura disattivato con avviso nella chat con un bannato");
assert((chat.match(/isRecipientUnavailableError\(error\)/g) || []).length >= 2, "Errore recipient_unavailable gestito sia nell'invio sia nel riprova");

const service = read("services", "ChatService.ts");
assert(/rpc\('is_private_conversation_with_banned'/.test(service), "ChatService usa la RPC del server, non un calcolo nel client");

console.log("banned-hidden-everywhere-contract: ok");
