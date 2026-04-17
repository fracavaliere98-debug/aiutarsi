import fs from "node:fs/promises";
import path from "node:path";
import { deriveGamificationView } from "../hooks/gamification/logic";
import type { GamificationState } from "../hooks/gamification/types";
import { computeVolunteerReportSummary } from "../services/VolunteerReportService";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const workspaceRoot = process.cwd();

async function readFile(relativePath: string) {
  return fs.readFile(path.join(workspaceRoot, relativePath), "utf8");
}

async function assertNoForbiddenPattern(relativePath: string, forbiddenPatterns: RegExp[]) {
  const content = await readFile(relativePath);
  for (const pattern of forbiddenPatterns) {
    assert(!pattern.test(content), `${relativePath} contains forbidden pattern ${pattern}`);
  }
}

async function runStaticGuardChecks() {
  const coreFiles = [
    "app/(volunteer)/(tabs)/profile.tsx",
    "app/(volunteer)/report.tsx",
    "components/VolunteerProfileView.tsx",
    "components/profile/BadgeSection.tsx",
    "components/profile/ProfileStats.tsx",
    "components/LevelUpOverlay.tsx",
    "app/activity/[id].tsx",
  ];

  for (const relativePath of coreFiles) {
    await assertNoForbiddenPattern(relativePath, [
      /GamificationContext/,
      /useGamification\(/,
    ]);
  }

  const noSnapshotInCore = [
    "app/(volunteer)/(tabs)/profile.tsx",
    "app/(volunteer)/report.tsx",
    "components/VolunteerProfileView.tsx",
    "components/profile/BadgeSection.tsx",
    "components/profile/ProfileStats.tsx",
  ];

  for (const relativePath of noSnapshotInCore) {
    await assertNoForbiddenPattern(relativePath, [
      /\buser\??\.xp\b/,
      /\buser\??\.impactPoints\b/,
      /\buser\??\.impact_points\b/,
      /\buser\??\.badges\b/,
      /\bvolunteer\??\.xp\b/,
      /\bvolunteer\??\.impactPoints\b/,
      /\bvolunteer\??\.impact_points\b/,
      /\bvolunteer\??\.badges\b/,
    ]);
  }

  return [
    "PASS no core consumer imports the removed gamification context",
    "PASS no core gamification screen reads profile-side XP or impact point snapshots directly",
  ];
}

function runDerivedViewChecks() {
  const state: GamificationState = {
    totalXP: 520,
    level: 3,
    badges: [],
    completedActivitiesCount: 4,
    processedActivityIds: [],
    sharedActivities: [],
    enrolledNPOs: [],
    claimedMilestones: [],
    followedNPOsHistory: [],
    totalHours: 12,
    completedCategories: [],
    completionDates: [],
    reviewedNpoIds: [],
  };

  const derived = deriveGamificationView(state);
  assert(derived.levelName === "Sociale", "Derived level name should match canonical level");
  assert(derived.xpInLevel === 70, "XP in level should derive from canonical XP");
  assert(derived.xpNeededForLevel === 550, "XP needed should derive from canonical thresholds");
  assert(Math.round(derived.levelProgress) === 13, "Level progress should derive from canonical XP only");

  return [
    "PASS derived gamification view fields are computed from canonical gamification_state only",
  ];
}

function runReportContractChecks() {
  const now = new Date();
  const withinWeek = now.toISOString();
  const withinMonth = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const upcomingSoon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const twoHoursBeforeWeek = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

  const gamificationState: GamificationState = {
    totalXP: 520,
    level: 3,
    badges: [],
    completedActivitiesCount: 1,
    processedActivityIds: [],
    sharedActivities: [],
    enrolledNPOs: [],
    claimedMilestones: [],
    followedNPOsHistory: [],
    totalHours: 2,
    completedCategories: [],
    completionDates: [],
    reviewedNpoIds: [],
  };

  const summary = computeVolunteerReportSummary({
    user: {
      id: "vol-1",
      name: "Francesca",
      role: "VOLUNTEER",
      xp: 0,
      impactPoints: 0,
      impact_points: 0,
    } as any,
    gamificationState,
    activities: [
      {
        id: "a1",
        title: "Raccolta viveri",
        status: "COMPLETATA",
        iscritti: ["vol-1"],
        dateTime: twoHoursBeforeWeek,
        endDateTime: withinWeek,
      } as any,
      {
        id: "a2",
        title: "Pulizia parco",
        status: "APERTA",
        iscritti: ["vol-1"],
        dateTime: upcomingSoon,
        endDateTime: upcomingSoon,
      } as any,
    ],
    applications: [
      {
        id: "app-1",
        volunteerId: "vol-1",
        status: "APPROVED",
        appliedDate: withinMonth,
        reviewedDate: withinWeek,
      },
    ] as any,
    reviews: [],
    followerRows: [{ created_at: withinWeek }],
  });

  assert(summary.totalXP === 520, "Volunteer report should use canonical gamification XP");
  assert(summary.level === 3, "Volunteer report should use canonical gamification level");
  assert(summary.levelName === "Sociale", "Volunteer report level name should derive from canonical level");

  return [
    "PASS volunteer report summary now consumes canonical gamification_state instead of profile snapshots",
  ];
}

async function run() {
  const results = [
    ...await runStaticGuardChecks(),
    ...runDerivedViewChecks(),
    ...runReportContractChecks(),
  ];

  console.log(JSON.stringify({ success: true, checks: results }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
