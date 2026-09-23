/**
 * Contract test per hooks/smart-match/selectors.ts e hooks/smart-match/queries.ts.
 *
 * Bug reale corretto il 2026-09-23: la card di Esplora (app/(volunteer)/(tabs)/search.tsx)
 * mostrava due percentuali diverse per lo stesso match sulla stessa card — il badge/chip
 * usava lo score canonico (dopo rerankSmartMatches, con i bonus di preferenza), il testo
 * del box "motivazione" usava invece un template locale con lo score legacy pre-rerank
 * (fetchSmartMatchActivityScores in queries.ts). Le due chip "Urgente" e "Alta
 * compatibilità/Buon fit" ripetevano inoltre un'informazione già mostrata altrove sulla
 * card (badge urgente separato; punteggio/etichetta già visibili).
 *
 * Questo test copre la logica pura (rerankSmartMatches, deriveSmartMatchChips) con
 * assert comportamentali, e fa una verifica strutturale su queries.ts per impedire che
 * il vecchio template con lo score grezzo venga reintrodotto.
 *
 * Run: npx tsx scripts/test_smart_match_reason_consistency_contract.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AppUser, OldActivity, OldSmartMatchResult } from "../types";
import { deriveSmartMatchChips, rerankSmartMatches } from "../hooks/smart-match/selectors";

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

function activity(overrides: Partial<OldActivity> = {}): OldActivity {
  return {
    id: "a1",
    npoId: "npo-1",
    npoName: "Ente Test",
    title: "Distribuzione Pasti",
    category: "Sociale",
    dateTime: "2099-01-10T10:00:00.000Z",
    endDateTime: "2099-01-10T12:00:00.000Z",
    location: { coords: { lat: 45.46, lng: 9.19 }, address: "Via Roma 1" },
    slots: 5,
    skills: [],
    description: "desc",
    status: "APERTA",
    iscritti: [],
    isUrgent: false,
    matchPercentage: 0,
    ...overrides,
  };
}

function user(overrides: Partial<AppUser> = {}): AppUser {
  return { id: "vol-1", role: "VOLUNTEER", ...overrides } as AppUser;
}

function emptyPrefs(overrides: Partial<{
  hiddenActivityIds: string[];
  savedActivityIds: string[];
  seenActivityIds: string[];
  likedActivityIds: string[];
  likedCategories: string[];
  likedNpoIds: string[];
}> = {}) {
  return {
    hiddenActivityIds: [],
    savedActivityIds: [],
    seenActivityIds: [],
    likedActivityIds: [],
    likedCategories: [],
    likedNpoIds: [],
    ...overrides,
  };
}

function emptyRelations(overrides: Partial<{ followedNpoIds: Set<string>; affiliatedNpoIds: Set<string> }> = {}) {
  return {
    followedNpoIds: new Set<string>(),
    affiliatedNpoIds: new Set<string>(),
    ...overrides,
  };
}

function match(overrides: Partial<OldSmartMatchResult> = {}): OldSmartMatchResult {
  const act = overrides.activity ?? activity();
  return {
    id: act.id,
    score: 70,
    reason: "reason di test",
    activity: act,
    ...overrides,
  } as OldSmartMatchResult;
}

// ── rerankSmartMatches: lo score mostrato deve essere sempre quello canonico ──

function testAdjustedScoreAppliesPreferenceBoosts() {
  console.log("\n[smart-match] rerankSmartMatches — i bonus di preferenza si applicano allo score canonico");

  const act = activity({ id: "a1", npoId: "npo-1", category: "Sociale" });
  const m = match({ id: "a1", score: 50, activity: act });

  const [reranked] = rerankSmartMatches(
    [m],
    user(),
    emptyPrefs({ savedActivityIds: ["a1"], likedActivityIds: ["a1"], likedCategories: ["Sociale"] }),
    emptyRelations(),
    {}
  );

  // 50 (base) + 8 (salvata) + 10 (piaciuta) + 7 (categoria preferita) = 75
  assert(reranked.score === 75, `score canonico atteso 75, ottenuto ${reranked.score}`);
  pass("score canonico riflette i bonus (salvata/piaciuta/categoria) applicati sopra la base");
}

function testAdjustedScoreDrivesConfidenceLabel() {
  console.log("\n[smart-match] rerankSmartMatches — l'etichetta di confidenza segue lo score DOPO i bonus, non prima");

  const act = activity({ id: "a2", npoId: "npo-2" });
  // Score base 70 (sotto la soglia 'top' di 80) che con i bonus supera 80.
  const m = match({ id: "a2", score: 70, activity: act });

  const [reranked] = rerankSmartMatches(
    [m],
    user(),
    emptyPrefs({ likedActivityIds: ["a2"] }), // +10
    emptyRelations({ affiliatedNpoIds: new Set(["npo-2"]) }), // +10
    {}
  );

  assert(reranked.score === 90, `score canonico atteso 90, ottenuto ${reranked.score}`);
  assert(reranked.confidence === "top", "con score canonico 90 la confidenza deve essere 'top'");
  assert(reranked.confidenceLabel === "Consiglio di Gemma", "l'etichetta deve corrispondere allo score canonico, non a quello grezzo (70, che darebbe 'Vale la pena')");
  pass("etichetta di confidenza calcolata sullo stesso score mostrato nel badge, mai su quello grezzo pre-rerank");
}

function testScoreClampedToRange() {
  console.log("\n[smart-match] rerankSmartMatches — clamp 0-99");

  const act = activity({ id: "a3" });
  const m = match({ id: "a3", score: 95, activity: act });

  const [reranked] = rerankSmartMatches(
    [m],
    user(),
    emptyPrefs({ savedActivityIds: ["a3"], likedActivityIds: ["a3"] }),
    emptyRelations({ affiliatedNpoIds: new Set(["npo-1"]) }),
    {}
  );

  assert(reranked.score <= 99, `score non deve mai superare 99, ottenuto ${reranked.score}`);
  pass("score canonico resta clampato a 99 anche con più bonus cumulati");
}

// ── deriveSmartMatchChips: niente segnali ripetuti già mostrati altrove sulla card ──

function testChipsDoNotRepeatUrgentBadge() {
  console.log("\n[smart-match] deriveSmartMatchChips — 'Urgente' non deve comparire tra le chip");

  const act = activity({ isUrgent: true });
  const chips = deriveSmartMatchChips(user(), act);

  assert(!chips.includes("Urgente"), "'Urgente' è già un badge separato e ben visibile sulla card: ripeterlo tra le chip è ridondante");
  pass("nessuna chip 'Urgente' anche quando l'attività è urgente (badge dedicato altrove)");
}

function testChipsDoNotRepeatScoreAsWords() {
  console.log("\n[smart-match] deriveSmartMatchChips — il punteggio non deve essere ripetuto a parole");

  const act = activity();
  const chips = deriveSmartMatchChips(user(), act);

  assert(!chips.includes("Alta compatibilità"), "'Alta compatibilità' ripeteva a parole lo stesso score già mostrato nel badge/etichetta");
  assert(!chips.includes("Buon fit"), "'Buon fit' ripeteva a parole lo stesso score già mostrato nel badge/etichetta");
  pass("nessuna chip che riscrive lo score a parole, a nessun livello di punteggio");
}

function testChipsStillSurfaceDistinctSignals() {
  console.log("\n[smart-match] deriveSmartMatchChips — i segnali distinti (non ridondanti) restano");

  const soon = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // domani
  const act = activity({ dateTime: soon, location: { coords: { lat: 45.46, lng: 9.19 }, address: "Via Roma 1" } });
  const chips = deriveSmartMatchChips(user({ locationCoords: { lat: 45.46, lng: 9.19 } } as Partial<AppUser>), act);

  assert(chips.includes("Vicino a te"), "la distanza è un segnale distinto (non mostrato altrove sulla card) e deve restare");
  assert(chips.includes("Nei prossimi giorni"), "la finestra temporale relativa è un segnale distinto (non la data esatta già mostrata) e deve restare");
  pass("i segnali non ridondanti (distanza, finestra temporale, skill/interessi) restano intatti");
}

// ── Wiring: fetchSmartMatchActivityScores deve usare la stessa pipeline di reason ──
// di fetchSmartMatches (gemmaService), non un terzo template locale con lo score grezzo.

function testQueriesUseSharedReasonPipeline() {
  console.log("\n[wiring] hooks/smart-match/queries.ts — stessa pipeline di reason per entrambe le query");

  const source = readSource("hooks/smart-match/queries.ts");

  const fnStart = source.indexOf("async function fetchSmartMatchActivityScores");
  assert(fnStart !== -1, "fetchSmartMatchActivityScores deve esistere in queries.ts");
  const fnEnd = source.indexOf("\nexport function useSmartMatchesQuery");
  assert(fnEnd !== -1 && fnEnd > fnStart, "delimitatore di fine funzione non trovato");
  const fnBody = source.slice(fnStart, fnEnd);

  assert(
    fnBody.includes("gemmaService.getSmartMatchReasons("),
    "fetchSmartMatchActivityScores deve generare il reason con gemmaService.getSmartMatchReasons, la stessa pipeline di fetchSmartMatches — non un terzo template locale"
  );

  // Anti-pattern che ha causato il bug: un template `Match ${...}%` che interpola
  // direttamente un numero (qualunque sia la variabile) nel testo del reason. Il
  // pattern non dipende dal nome della variabile perché la stringa reale del bug
  // storico usava getLegacyActivityMatchSnapshot(activity), non una variabile "score".
  const rawScoreInReasonPattern = /reason:\s*`Match \$\{[^}]*\}%/i;
  assert(
    !rawScoreInReasonPattern.test(fnBody),
    "fetchSmartMatchActivityScores non deve incorporare un numero grezzo in un template `Match X%`: e' quello che causava le due percentuali diverse sulla stessa card"
  );
  assert(
    !rawScoreInReasonPattern.test(source),
    "nessuna funzione in queries.ts (nemmeno i fallback di errore) deve incorporare un numero grezzo in un template `Match X%`"
  );

  pass("fetchSmartMatchActivityScores usa la pipeline condivisa (gemmaService) e nessun reason incorpora lo score grezzo pre-rerank");
}

// ── Runner ───────────────────────────────────────────────────────────────

function run() {
  console.log("Smart match reason/score consistency contract tests");
  console.log("─".repeat(60));

  testAdjustedScoreAppliesPreferenceBoosts();
  testAdjustedScoreDrivesConfidenceLabel();
  testScoreClampedToRange();
  testChipsDoNotRepeatUrgentBadge();
  testChipsDoNotRepeatScoreAsWords();
  testChipsStillSurfaceDistinctSignals();
  testQueriesUseSharedReasonPipeline();

  console.log("\n" + "─".repeat(60));
  console.log("All smart match reason consistency contract checks passed ✓");
}

run();
