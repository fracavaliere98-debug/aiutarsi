import { computeVolunteerReportSummary } from "../services/VolunteerReportService";
import { getLevelName } from "../hooks/gamification/logic";
import type { GamificationState } from "../hooks/gamification/types";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

// computeVolunteerReportSummary buckets everything against "start of this
// calendar week" and "start of this calendar month", both derived from the real
// wall clock at call time. A fixture built from fixed day-offsets from "now"
// (e.g. "8 days ago = last month") is flaky: near a month/week boundary the
// offset can silently land on the wrong side depending on which day the suite
// happens to run. Instead we mirror the exact boundary formulas here and place
// every fixture instant at an explicit, small offset from those boundaries, so
// membership is unambiguous regardless of when the test runs.
function startOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfMonth(): Date {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function hoursFrom(date: Date, hours: number): string {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

async function run() {
  const now = new Date();
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();
  const weekStartIso = weekStart.toISOString();
  const monthStartIso = monthStart.toISOString();

  // a1: ends just after week start -> always counts this week; month membership
  // is derived below (it can go either way if the week spans a month boundary).
  const a1End = hoursFrom(weekStart, 1);
  // a2: ends just after month start -> always counts this month; may or may not
  // fall in the current week depending on the calendar.
  const a2End = hoursFrom(monthStart, 1);
  // a3: 60 days ago -> always outside both week and month (no calendar month
  // or week is ever 60 days long).
  const a3End = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const upcomingSoon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const pastButStillOpen = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const gamificationState: GamificationState = {
    totalXP: 520,
    level: 3,
    badges: [],
    completedActivitiesCount: 2,
    processedActivityIds: [],
    sharedActivities: [],
    enrolledNPOs: [],
    claimedMilestones: [],
    followedNPOsHistory: [],
    totalHours: 4,
    completedCategories: [],
    completionDates: [],
    reviewedNpoIds: [],
  };

  const completedActivities = [
    { id: "a1", start: hoursFrom(weekStart, -3), end: a1End },
    { id: "a2", start: hoursFrom(monthStart, -3), end: a2End },
    { id: "a3", start: a3End, end: a3End },
  ];

  const summary = computeVolunteerReportSummary({
    user: { id: "vol-1", name: "Francesca", role: "VOLUNTEER" } as any,
    gamificationState,
    activities: [
      ...completedActivities.map((activity) => ({
        id: activity.id,
        title: activity.id,
        status: "COMPLETATA",
        iscritti: ["vol-1"],
        dateTime: activity.start,
        endDateTime: activity.end,
      })),
      {
        id: "a4-upcoming",
        title: "Pulizia parco",
        status: "APERTA",
        iscritti: ["vol-1"],
        dateTime: upcomingSoon,
        endDateTime: upcomingSoon,
      },
      {
        id: "a5-past-open",
        title: "Evento scaduto mai chiuso",
        status: "APERTA",
        iscritti: ["vol-1"],
        dateTime: pastButStillOpen,
        endDateTime: pastButStillOpen,
      },
    ] as any,
    applications: [
      { id: "app-1", volunteerId: "vol-1", status: "PENDING", appliedDate: hoursFrom(weekStart, 1) },
      {
        id: "app-2",
        volunteerId: "vol-1",
        status: "APPROVED",
        appliedDate: hoursFrom(monthStart, 2),
        reviewedDate: hoursFrom(weekStart, 1),
      },
      { id: "app-3", volunteerId: "vol-1", status: "PENDING", appliedDate: a3End },
    ] as any,
    reviews: [
      { id: "r1", volunteerId: "vol-1", activityId: "a1", date: hoursFrom(weekStart, 1) },
    ] as any,
    followerRows: [
      { created_at: hoursFrom(weekStart, 1) },
      { created_at: hoursFrom(monthStart, 2) },
      { created_at: a3End },
    ],
  });

  // ── Pass-through fields (no date logic involved) ──────────────────────────
  assert(summary.totalXP === 520, "totalXP must pass through from gamificationState");
  assert(summary.level === 3, "level must pass through from gamificationState");
  assert(summary.levelName === getLevelName(3), "levelName must be derived from the canonical level names");

  // ── Boundary-derived expectations, computed the same way the SUT buckets them ──
  const expectedWeek = completedActivities.filter((a) => a.end >= weekStartIso).length;
  const expectedMonth = completedActivities.filter((a) => a.end >= monthStartIso).length;
  assert(
    summary.completedActivitiesThisWeek === expectedWeek,
    `completedActivitiesThisWeek: expected ${expectedWeek}, got ${summary.completedActivitiesThisWeek}`
  );
  assert(
    summary.completedActivitiesThisMonth === expectedMonth,
    `completedActivitiesThisMonth: expected ${expectedMonth}, got ${summary.completedActivitiesThisMonth}`
  );

  // a1 is exactly 4h long and always counts this week; a2 is also 4h and always
  // counts this month. Hours are rounded, so assert the floor each bucket must
  // reach rather than an exact figure that depends on calendar-dependent overlap.
  assert(summary.volunteerHoursThisWeek >= 4, "volunteerHoursThisWeek must include a1's 4h duration");
  assert(summary.volunteerHoursThisMonth >= 4, "volunteerHoursThisMonth must include a2's 4h duration");

  assert(summary.applicationsThisWeek === 1, "applicationsThisWeek must count only app-1 (app-3 is 60 days old)");
  assert(summary.applicationsThisMonth === 2, "applicationsThisMonth must count app-1 and app-2 (app-3 is 60 days old)");
  assert(summary.approvedApplicationsThisWeek === 1, "approvedApplicationsThisWeek must count app-2 via its reviewedDate");
  assert(summary.approvedApplicationsThisMonth === 1, "approvedApplicationsThisMonth must count app-2 via its reviewedDate");

  const expectedFollowersWeek = [hoursFrom(weekStart, 1), hoursFrom(monthStart, 2), a3End].filter(
    (d) => d >= weekStartIso
  ).length;
  const expectedFollowersMonth = [hoursFrom(weekStart, 1), hoursFrom(monthStart, 2), a3End].filter(
    (d) => d >= monthStartIso
  ).length;
  assert(
    summary.followedNposThisWeek === expectedFollowersWeek,
    `followedNposThisWeek: expected ${expectedFollowersWeek}, got ${summary.followedNposThisWeek}`
  );
  assert(
    summary.followedNposThisMonth === expectedFollowersMonth,
    `followedNposThisMonth: expected ${expectedFollowersMonth}, got ${summary.followedNposThisMonth}`
  );

  assert(summary.reviewsLeftThisWeek === 1, "reviewsLeftThisWeek must count r1");
  assert(summary.reviewsLeftThisMonth === 1, "reviewsLeftThisMonth must count r1");
  assert(
    summary.pendingReviewsCount === completedActivities.length - 1,
    `pendingReviewsCount must exclude a1 (reviewed) from the ${completedActivities.length} completed activities`
  );

  assert(summary.upcomingActivitiesCount === 1, "upcomingActivitiesCount must count a4 only (a5 is open but already past)");

  console.log("PASS volunteer report summary buckets activities, applications, reviews and followers correctly at week/month boundaries");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
