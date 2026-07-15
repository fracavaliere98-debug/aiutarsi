/**
 * Contract test per utils/communityModerationLogic.ts: come vengono interpretate le risposte
 * dell'edge function community-moderator-ai e cosa succede quando la moderazione non è
 * raggiungibile. Safety-critical: un bug qui può far passare contenuto non sicuro (post/chat)
 * o bloccare erroneamente contenuto legittimo.
 *
 * Run: npx tsx scripts/test_community_moderation_contract.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildFailOpenResult,
  mapModerationResponse,
  MODERATION_UNAVAILABLE_REASON,
} from "../utils/communityModerationLogic";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

const REPO_ROOT = join(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

// ── mapModerationResponse: shape reale prodotta da supabase/functions/community-moderator-ai ──

function testMapModerationResponseSafeCases() {
  console.log("\n[communityModeration] mapModerationResponse — casi 'safe'");

  const safeResponse = { success: true, analysis: { safe: true, reason: "Contenuto approvato dalle regole standard.", category: "none", source: "rules" } };
  const result = mapModerationResponse(safeResponse);
  assert(result.safe === true, "analysis.safe:true → safe:true");
  assert(result.reason === "Contenuto approvato dalle regole standard.", "reason passa invariato");
  assert(result.category === "none", "category passa invariato");
  pass("risposta 'safe' esplicita mappata correttamente");

  const bypassed = mapModerationResponse({ analysis: { safe: true, reason: "AI non disponibile; approvato per default.", category: "none", source: "bypass" } });
  assert(bypassed.safe === true, "bypass AI (fail-open lato edge function) → safe:true");
  pass("bypass lato server (AI down) resta 'safe' anche a livello client");
}

function testMapModerationResponseBlockedCases() {
  console.log("\n[communityModeration] mapModerationResponse — casi bloccati");

  for (const category of ["sexual", "hate", "spam", "violence", "harassment"] as const) {
    const blocked = mapModerationResponse({ analysis: { safe: false, reason: `Contenuto rifiutato (${category})`, category, source: "ai" } });
    assert(blocked.safe === false, `analysis.safe:false esplicito (categoria ${category}) → safe:false, mai fail-open sul bloccato`);
    assert(blocked.category === category, `categoria "${category}" preservata`);
  }
  pass("ogni categoria di contenuto non sicuro viene bloccata (safe:false) senza eccezioni");
}

function testMapModerationResponseMalformedCases() {
  console.log("\n[communityModeration] mapModerationResponse — payload malformati/assenti");

  assert(mapModerationResponse(undefined).safe === true, "data assente (undefined) → fail-open, safe:true");
  assert(mapModerationResponse(null).safe === true, "data null → fail-open, safe:true");
  assert(mapModerationResponse({}).safe === true, "data senza campo analysis → fail-open, safe:true");
  assert(mapModerationResponse({ analysis: {} }).safe === true, "analysis vuoto (nessun campo safe) → fail-open, safe:true");
  assert(mapModerationResponse({ analysis: { reason: "boh" } }).safe === true, "analysis con solo reason, senza safe → fail-open, safe:true");
  pass("solo un safe:false ESPLICITO blocca; qualunque altra forma malformata fallisce aperta (mai un falso blocco per payload inatteso)");

  // Guardia esplicita: un valore troncato/coercizzato in qualcosa di truthy diverso da booleano
  // non deve accidentalmente essere trattato come "non sicuro".
  const weirdTruthy = mapModerationResponse({ analysis: { safe: "false" as unknown as boolean } });
  assert(weirdTruthy.safe === true, "safe come stringa 'false' (truthy in JS, non === false) → resta fail-open, safe:true");
  pass("solo il booleano `false` blocca, non stringhe o altri valori truthy");
}

// ── buildFailOpenResult ─────────────────────────────────────────────────────

function testFailOpenResult() {
  console.log("\n[communityModeration] buildFailOpenResult");

  const result = buildFailOpenResult();
  assert(result.safe === true, "policy fail-open: quando la moderazione non è raggiungibile, il contenuto passa");
  assert(result.reason === MODERATION_UNAVAILABLE_REASON, "motivo comunicato coerente con la costante condivisa");
  assert(result.category === "none", "categoria neutra quando non è stato possibile analizzare");
  pass("comportamento fail-open esplicito e stabile");
}

// ── Wiring: entrambe le funzioni pubbliche devono riusare la logica condivisa ──

function testStructuralWiring() {
  console.log("\n[wiring] communityModeration.ts riusa la logica condivisa (niente duplicazione divergente)");

  const source = readSource("utils/communityModeration.ts");

  const moderateCommunityContentBlock = source.slice(
    source.indexOf("export async function moderateCommunityContent"),
    source.indexOf("export async function moderateChatMessage")
  );
  const moderateChatMessageBlock = source.slice(source.indexOf("export async function moderateChatMessage"));

  for (const [label, block] of [
    ["moderateCommunityContent", moderateCommunityContentBlock],
    ["moderateChatMessage", moderateChatMessageBlock],
  ] as const) {
    assert(block.includes("mapModerationResponse("), `${label} deve mappare la risposta con mapModerationResponse`);
    assert(block.includes("buildFailOpenResult("), `${label} deve usare buildFailOpenResult() nel catch`);
    assert(
      !/safe:\s*(true|result\.data)/.test(block.replace(/\s+/g, " ")),
      `REGRESSIONE: ${label} non deve reintrodurre un mapping/fail-open inline duplicato`
    );
  }
  pass("moderateCommunityContent e moderateChatMessage delegano entrambe alla stessa logica testata sopra");
}

// ── Runner ────────────────────────────────────────────────────────────────

function run() {
  console.log("Community/chat moderation contract tests");
  console.log("─".repeat(60));

  testMapModerationResponseSafeCases();
  testMapModerationResponseBlockedCases();
  testMapModerationResponseMalformedCases();
  testFailOpenResult();
  testStructuralWiring();

  console.log("\n" + "─".repeat(60));
  console.log("All community moderation contract checks passed ✓");
}

run();
