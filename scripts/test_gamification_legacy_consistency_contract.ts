import { getLegacyGamificationSnapshot } from "../utils/gamificationLegacy";
import { getXPForNextLevel } from "../hooks/gamification/logic";
import type { AppUser } from "../types";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

// utils/gamificationLegacy.ts hardcodes its own XP→level ladder as a client-side
// fallback used before the canonical gamification_state loads. It duplicates the
// thresholds owned by hooks/gamification/logic.ts (getXPForNextLevel /
// getXPForCurrentLevel) instead of importing them. If the canonical ladder ever
// changes and this fallback isn't updated in lockstep, a user could see a
// different level depending on which code path computed it. This contract locks
// the two ladders together so that drift fails loudly instead of silently.
function canonicalLevelForXP(totalXP: number): number {
  let level = 1;
  while (getXPForNextLevel(level) <= totalXP) {
    level++;
  }
  return level;
}

function levelForXP(totalXP: number): number {
  const user = { xp: totalXP } as AppUser;
  return getLegacyGamificationSnapshot("user-1", user).level;
}

const probes = [
  0,
  1,
  109,
  110, // level 1 -> 2 boundary
  111,
  449,
  450, // level 2 -> 3 boundary
  999,
  1000, // level 3 -> 4 boundary
  1999,
  2000, // level 4 -> 5 boundary
  3499,
  3500, // level 5 -> 6 boundary
  5499,
  5500, // level 6 -> 7 boundary
  7999,
  8000, // level 7 -> 8 boundary
  10999,
  11000, // level 8 -> 9 boundary
  14999,
  15000, // level 9 -> 10 boundary
  19999,
  20000, // level 10 -> 11 boundary
  25000,
  50000,
];

for (const xp of probes) {
  const expected = canonicalLevelForXP(xp);
  const actual = levelForXP(xp);
  assert(
    actual === expected,
    `legacy snapshot level drifted from canonical ladder at ${xp} XP: expected level ${expected}, got ${actual}`
  );
}

// Field fallback priority: xp > impactPoints > impact_points > 0
assert(
  getLegacyGamificationSnapshot("u1", { xp: 500 } as AppUser).totalXP === 500,
  "xp field must be used when present"
);
assert(
  getLegacyGamificationSnapshot("u1", { impactPoints: 300 } as AppUser).totalXP === 300,
  "impactPoints must be used when xp is absent"
);
assert(
  getLegacyGamificationSnapshot("u1", { impact_points: 200 } as any).totalXP === 200,
  "impact_points must be used when xp and impactPoints are absent"
);
assert(
  getLegacyGamificationSnapshot("u1", null).totalXP === 0,
  "missing user must fall back to 0 XP / level 1"
);
assert(
  getLegacyGamificationSnapshot("u1", null).level === 1,
  "missing user must fall back to level 1"
);

console.log("PASS gamification legacy snapshot stays in sync with the canonical XP ladder");
