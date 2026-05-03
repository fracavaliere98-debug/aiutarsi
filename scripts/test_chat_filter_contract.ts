import { filterMessage, shouldModerateMessageWithEdge } from "../utils/chatFilter";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(!filterMessage("Ciao, arrivo tra dieci minuti").blocked, "normal chat copy must pass the local filter");
assert(!shouldModerateMessageWithEdge("Ciao, arrivo tra dieci minuti"), "normal chat copy must not invoke Edge moderation");

assert(shouldModerateMessageWithEdge("Scrivimi su whatsapp cosi ci accordiamo"), "off-platform hints must invoke Edge moderation");
assert(shouldModerateMessageWithEdge("Il mio codice OTP e 123456"), "sensitive credential hints must invoke Edge moderation");
assert(shouldModerateMessageWithEdge("A".repeat(420)), "very long messages must invoke Edge moderation");

const blocked = filterMessage("clicca qui https://example.com");
assert(blocked.blocked, "obvious spam must still be blocked locally before any Edge moderation");

console.log("PASS chat filter contract validated");
