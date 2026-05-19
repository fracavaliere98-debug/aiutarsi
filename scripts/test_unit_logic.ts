/**
 * Unit tests for pure logic functions.
 * Covers edge cases not addressed by the existing contract test suite.
 *
 * Run: npx tsx scripts/test_unit_logic.ts
 */

import { calculateSmartMatch } from "../utils/SmartMatch";
import {
  deriveGamificationView,
  getLevelName,
  getXPForCurrentLevel,
  getXPForNextLevel,
} from "../hooks/gamification/logic";
import { filterMessage, shouldModerateMessageWithEdge } from "../utils/chatFilter";
import { resolveNotificationRoute } from "../hooks/notifications/routeResolver";
import type { GamificationState } from "../hooks/gamification/types";
import type { AppUser, AppActivity } from "../types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

// ── Gamification: XP thresholds ──────────────────────────────────────────────

function testXPThresholds() {
  console.log("\n[gamification] XP thresholds");

  assert(getXPForNextLevel(1) === 110, "level 1 → 110 XP");
  assert(getXPForNextLevel(9) === 15000, "level 9 → 15 000 XP");
  assert(getXPForNextLevel(10) === 20000, "level 10 → 20 000 XP (15000 + 1×5000)");
  assert(getXPForNextLevel(11) === 25000, "level 11 → 25 000 XP (15000 + 2×5000)");
  pass("getXPForNextLevel: levels 1, 9, 10, 11");

  assert(getXPForCurrentLevel(1) === 0, "level 1 current floor is 0");
  assert(getXPForCurrentLevel(2) === 110, "level 2 current floor is 110 (= nextLevel(1))");
  assert(getXPForCurrentLevel(10) === 15000, "level 10 current floor is 15 000");
  pass("getXPForCurrentLevel: levels 1, 2, 10");
}

// ── Gamification: level names ─────────────────────────────────────────────────

function testLevelNames() {
  console.log("\n[gamification] level names");

  const expected: [number, string][] = [
    [1, "Novizio"],
    [2, "Apprendista"],
    [3, "Sociale"],
    [4, "Attivo"],
    [5, "Esperto"],
    [6, "Mentore"],
    [7, "Pilastro"],
    [8, "Ambasciatore"],
    [9, "Leader"],
    [10, "Leggenda"],
    [15, "Leggenda"],
  ];

  for (const [level, name] of expected) {
    assert(getLevelName(level) === name, `level ${level} → "${name}", got "${getLevelName(level)}"`);
  }
  pass("getLevelName covers all 9 named levels + Leggenda (10+)");
}

// ── Gamification: derived view ────────────────────────────────────────────────

function makeState(overrides: Partial<GamificationState> = {}): GamificationState {
  return {
    totalXP: 0,
    level: 1,
    badges: [],
    completedActivitiesCount: 0,
    processedActivityIds: [],
    sharedActivities: [],
    enrolledNPOs: [],
    claimedMilestones: [],
    followedNPOsHistory: [],
    totalHours: 0,
    completedCategories: [],
    completionDates: [],
    reviewedNpoIds: [],
    ...overrides,
  };
}

function testDerivedView() {
  console.log("\n[gamification] deriveGamificationView");

  // Level 1, 0 XP → 0% progress
  const atStart = deriveGamificationView(makeState({ totalXP: 0, level: 1 }));
  assert(atStart.levelProgress === 0, "0 XP at level 1 → 0% progress");
  assert(atStart.currentLevelXP === 0, "level 1 floor is 0");
  assert(atStart.nextLevelXP === 110, "level 1 ceiling is 110");
  assert(atStart.xpInLevel === 0, "xpInLevel is 0");
  pass("level 1 at 0 XP");

  // Level 1, exactly at threshold → 100%
  const atCeiling = deriveGamificationView(makeState({ totalXP: 110, level: 1 }));
  assert(atCeiling.levelProgress === 100, "110 XP at level 1 → 100% progress");
  pass("level 1 at ceiling (110 XP)");

  // Level 3, midpoint: floor=450, ceiling=1000 → range=550
  // totalXP=725 → xpInLevel=275, progress=275/550=50%
  const mid = deriveGamificationView(makeState({ totalXP: 725, level: 3 }));
  assert(mid.xpInLevel === 275, "xpInLevel correct at midpoint");
  assert(mid.xpNeededForLevel === 550, "xpNeededForLevel = 1000 - 450");
  assert(Math.round(mid.levelProgress) === 50, "50% progress at midpoint");
  pass("level 3 at midpoint");

  // XP below floor (should not go negative)
  const belowFloor = deriveGamificationView(makeState({ totalXP: 400, level: 3 }));
  assert(belowFloor.xpInLevel === 0, "xpInLevel never negative when totalXP < floor");
  assert(belowFloor.levelProgress === 0, "levelProgress never negative");
  pass("xpInLevel and levelProgress floor at 0");
}

// ── SmartMatch ────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "vol-1",
    role: "VOLUNTEER",
    interests: [],
    skills: [],
    ...overrides,
  } as AppUser;
}

function makeActivity(overrides: Partial<AppActivity> = {}): AppActivity {
  return {
    id: "act-1",
    title: "Test Activity",
    category: "Ambiente",
    skills: [],
    description: "",
    isUrgent: false,
    location: {},
    ...overrides,
  } as AppActivity;
}

function testSmartMatch() {
  console.log("\n[smartmatch] calculateSmartMatch");

  // null user → 0
  assert(calculateSmartMatch(null, makeActivity()) === 0, "null user → score 0");
  pass("null user returns 0");

  // NPO role → 0
  const npoUser = makeUser({ role: "NPO" } as any);
  assert(calculateSmartMatch(npoUser, makeActivity()) === 0, "NPO user → score 0");
  pass("NPO role returns 0");

  // Semantic similarity provided → 75% weight
  const user = makeUser();
  const score75 = calculateSmartMatch(user, makeActivity(), 1.0);
  assert(score75 === 75, `semantic similarity 1.0 → 75 (got ${score75})`);
  pass("semantic similarity 1.0 → 75 base score");

  // Semantic + urgency: 75 + 6 = 81 (no cap triggered)
  const scoreUrgent = calculateSmartMatch(user, makeActivity({ isUrgent: true }), 1.0);
  assert(scoreUrgent === 81, `semantic 1.0 + urgent = 75 + 6 = 81 (got ${scoreUrgent})`);
  pass("semantic 1.0 + urgency = 81");

  // Score cap at 100: semantic 1.0 (75) + proximity <5km (15) + urgent (6) + within 2 days (4) = 100
  const tomorrow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
  const userNearFull = makeUser({ locationCoords: { lat: 45.464, lng: 9.190 } } as any);
  const actFull = makeActivity({
    isUrgent: true,
    dateTime: tomorrow,
    location: { coords: { lat: 45.464, lng: 9.191 } },
  } as any);
  const capScore = calculateSmartMatch(userNearFull, actFull, 1.0);
  assert(capScore === 100, `full score (75+15+6+4=100) should be exactly 100, got ${capScore}`);
  pass("score capped at 100 when sum exceeds it");

  // Legacy: category match → 35 pts
  const userWithInterests = makeUser({ interests: ["ambiente"] });
  const catScore = calculateSmartMatch(userWithInterests, makeActivity({ category: "Ambiente" }));
  assert(catScore >= 35, `category match should give at least 35 pts (got ${catScore})`);
  pass("legacy category match contributes 35 pts");

  // Legacy: single skill overlap → 20 pts
  const userWithSkill = makeUser({ skills: ["giardinaggio"] });
  const actWithSkill = makeActivity({ skills: ["giardinaggio", "pittura"], category: "Sport" });
  const skillScore = calculateSmartMatch(userWithSkill, actWithSkill);
  assert(skillScore >= 20, `single skill overlap should give at least 20 pts (got ${skillScore})`);
  pass("legacy single skill overlap contributes ≥20 pts");

  // Legacy: two skills overlap → 40 pts
  const user2Skills = makeUser({ skills: ["giardinaggio", "pittura"] });
  const skillScore2 = calculateSmartMatch(user2Skills, actWithSkill);
  assert(skillScore2 >= 40, `two skill overlap should give 40 pts (got ${skillScore2})`);
  pass("legacy two skill overlap contributes 40 pts (capped)");

  // Legacy: keyword fallback in description → 20 pts
  const userKw = makeUser({ skills: ["pittura"] });
  const actKw = makeActivity({ description: "Serve esperienza in pittura murale", category: "Sport" });
  const kwScore = calculateSmartMatch(userKw, actKw);
  assert(kwScore >= 20, `keyword fallback in description should give 20 pts (got ${kwScore})`);
  pass("legacy keyword fallback in description contributes 20 pts");

  // Proximity < 5km → 15 pts on top of other score
  const userNear = makeUser({ locationCoords: { lat: 45.464, lng: 9.190 } } as any);
  const actNear = makeActivity({ location: { coords: { lat: 45.464, lng: 9.191 } } } as any);
  const proxScore = calculateSmartMatch(userNear, actNear);
  assert(proxScore >= 15, `proximity < 5km should give 15 pts (got ${proxScore})`);
  pass("proximity < 5km contributes 15 pts");

  // Urgency flag → +6 pts
  const urgentAct = makeActivity({ isUrgent: true });
  const urgentScore = calculateSmartMatch(makeUser(), urgentAct);
  assert(urgentScore >= 6, `isUrgent should add 6 pts (got ${urgentScore})`);
  pass("isUrgent adds 6 pts");
}

// ── chatFilter edge cases ─────────────────────────────────────────────────────

function testChatFilter() {
  console.log("\n[chatFilter] filterMessage edge cases");

  // Empty / whitespace
  assert(!filterMessage("").blocked, "empty string → not blocked");
  assert(!filterMessage("   ").blocked, "whitespace-only → not blocked");
  pass("empty and whitespace strings pass");

  // Multi-word banned phrase
  const multiWord = filterMessage("sei proprio un figlio di puttana");
  assert(multiWord.blocked && multiWord.reason === "banned_word", "multi-word banned phrase is blocked");
  pass("multi-word banned phrase detected");

  // Accented variant still caught
  const accented = filterMessage("vaffancùlo");
  assert(accented.blocked, "accented variant of banned word is blocked");
  pass("accented variants of banned words are blocked (normalization)");

  // URL pattern
  const url = filterMessage("visita https://spam.com per guadagnare");
  assert(url.blocked && url.reason === "spam_pattern", "URL in message → spam_pattern blocked");
  pass("URLs are caught by spam pattern");

  // Repeated chars (7+)
  const repeat = filterMessage("aaaaaaaaa ciao");
  assert(repeat.blocked && repeat.reason === "spam_pattern", "7+ repeated chars → spam_pattern blocked");
  pass("7+ repeated characters are caught");

  // Edge moderation: off-platform contact
  assert(shouldModerateMessageWithEdge("scrivimi su telegram"), "telegram mention → edge moderation");
  assert(shouldModerateMessageWithEdge("mandami il tuo iban"), "IBAN mention → edge moderation");
  assert(!shouldModerateMessageWithEdge("ci vediamo domani"), "normal message → no edge moderation");
  pass("shouldModerateMessageWithEdge: off-platform and credential hints trigger escalation");

  // Edge moderation: long message threshold (420 chars)
  assert(shouldModerateMessageWithEdge("a".repeat(420)), "420-char message → edge moderation");
  assert(!shouldModerateMessageWithEdge("a".repeat(419)), "419-char message → no edge moderation");
  pass("shouldModerateMessageWithEdge: 420+ chars triggers escalation");
}

// ── resolveNotificationRoute edge cases ───────────────────────────────────────

function testNotificationRouting() {
  console.log("\n[notificationRoute] edge cases");

  const base = { title: "", message: "", activityId: undefined, applicationId: undefined, npoId: undefined, conversationId: undefined, payload: undefined };

  // Badge/gamification → profile (role-aware)
  assert(
    resolveNotificationRoute("VOLUNTEER", { type: "BADGE_UNLOCKED", ...base }) === "/(volunteer)/(tabs)/profile",
    "BADGE_UNLOCKED volunteer → volunteer profile",
  );
  assert(
    resolveNotificationRoute("NPO", { type: "GAMIFICATION_REMIND", ...base }) === "/(npo)/(tabs)/profile",
    "GAMIFICATION_REMIND NPO → NPO profile",
  );
  pass("BADGE_UNLOCKED and GAMIFICATION_REMIND resolve to role-correct profile");

  // Weekly recap
  assert(
    resolveNotificationRoute("NPO", { type: "NPO_WEEKLY_RECAP", ...base }) === "/(npo)/report",
    "NPO_WEEKLY_RECAP → NPO report",
  );
  assert(
    resolveNotificationRoute("VOLUNTEER", { type: "VOLUNTEER_WEEKLY_RECAP", ...base }) === "/(volunteer)/report",
    "VOLUNTEER_WEEKLY_RECAP → volunteer report",
  );
  pass("weekly recap routes to correct report screens");

  // NPO_LOW_COVERAGE: with activity → activity detail, without → report
  assert(
    resolveNotificationRoute("NPO", { type: "NPO_LOW_COVERAGE", ...base, activityId: "act-1" }) === "/activity/act-1",
    "NPO_LOW_COVERAGE with activityId → activity detail",
  );
  assert(
    resolveNotificationRoute("NPO", { type: "NPO_LOW_COVERAGE", ...base }) === "/(npo)/report",
    "NPO_LOW_COVERAGE without activityId → NPO report",
  );
  pass("NPO_LOW_COVERAGE routing with/without activityId");

  // APPLICATION_APPROVED: activityId takes precedence over npoId
  assert(
    resolveNotificationRoute("VOLUNTEER", { type: "APPLICATION_APPROVED", ...base, activityId: "act-1", npoId: "npo-1" }) === "/activity/act-1",
    "APPLICATION_APPROVED: activityId takes precedence",
  );
  assert(
    resolveNotificationRoute("VOLUNTEER", { type: "APPLICATION_APPROVED", ...base, npoId: "npo-1" }) === "/npo-profile/npo-1",
    "APPLICATION_APPROVED without activityId → npo profile",
  );
  assert(
    resolveNotificationRoute("VOLUNTEER", { type: "APPLICATION_REJECTED", ...base }) === "/(volunteer)/notifications",
    "APPLICATION_REJECTED without any target → notifications fallback",
  );
  pass("APPLICATION_APPROVED/REJECTED routing priority");

  // Reengagement via payload flag
  assert(
    resolveNotificationRoute("VOLUNTEER", { type: "INFO", ...base, payload: { reengagement: true } }) === "/(volunteer)/(tabs)/community",
    "reengagement payload flag → community",
  );
  // Reengagement via title text
  assert(
    resolveNotificationRoute("NPO", { type: "SUCCESS", ...base, title: "Riattiva la tua community" }) === "/(npo)/(tabs)/community",
    "reengagement title text → community (takes precedence over type)",
  );
  pass("reengagement detection via payload flag and title text");

  // Verification outcome via SUCCESS/INFO type
  assert(
    resolveNotificationRoute("NPO", { type: "SUCCESS", ...base, title: "Profilo verificato" }) === "/(npo)/(tabs)/profile",
    "verification SUCCESS → profile",
  );
  pass("verification outcome routes to profile");

  // Unknown type with activityId → activity detail
  assert(
    resolveNotificationRoute("VOLUNTEER", { type: "UNKNOWN_TYPE" as any, ...base, activityId: "act-99" }) === "/activity/act-99",
    "unknown type with activityId → activity detail fallback",
  );
  // Unknown type without activityId → notifications
  assert(
    resolveNotificationRoute("VOLUNTEER", { type: "UNKNOWN_TYPE" as any, ...base }) === "/(volunteer)/notifications",
    "unknown type without activityId → notifications fallback",
  );
  pass("unknown notification type fallback logic");
}

// ── Runner ────────────────────────────────────────────────────────────────────

function run() {
  console.log("Unit logic test suite");
  console.log("─".repeat(60));

  testXPThresholds();
  testLevelNames();
  testDerivedView();
  testSmartMatch();
  testChatFilter();
  testNotificationRouting();

  console.log("\n" + "─".repeat(60));
  console.log("All unit logic checks passed ✓");
}

run();
