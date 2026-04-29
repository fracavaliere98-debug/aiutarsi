import fs from "fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const inboxItem = fs.readFileSync("components/ConversationListItem.tsx", "utf8");
const inboxScreen = fs.readFileSync("app/messages/index.tsx", "utf8");
const detailScreen = fs.readFileSync("app/messages/[id].tsx", "utf8");

assert(inboxItem.includes("isMuted?: boolean"), "ConversationListItem must expose muted state explicitly");
assert(inboxItem.includes("BellOff"), "Muted conversations must show a visible muted icon");
assert(inboxScreen.includes("notifications_muted"), "Inbox snapshots must account for muted state");
assert(inboxScreen.includes("Prova a cambiare filtro"), "Inbox empty state must give a clear next action");
assert(detailScreen.includes("composerDisabledReason"), "Chat detail must centralize composer disabled copy");
assert(detailScreen.includes("editable={!isComposerDisabled}"), "Composer input must be disabled through the derived UX state");

console.log("PASS chat UX contract validated");
