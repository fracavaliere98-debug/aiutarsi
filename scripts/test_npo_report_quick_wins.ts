import { computeNPOReportSummary } from "../services/ReportService";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

// computeNPOReportSummary buckets everything against "start of this calendar
// week" and "start of this calendar month", both derived from the real wall
// clock at call time. A fixture built from fixed day-offsets from "now" (e.g.
// "12 days ago = last month") is flaky: near a month boundary the offset can
// silently land in the current month depending on which day the suite happens
// to run. Instead we mirror the exact boundary formulas here and place every
// fixture instant at an explicit, small offset from those boundaries, so
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

  const withinWeek = hoursFrom(weekStart, 1);
  const withinMonth = hoursFrom(monthStart, 2);
  const longAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(); // always outside week & month
  const soon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(); // within the 7-day low-coverage window
  const midWindow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(); // beyond the old 3-day cutoff, within the new 7-day one
  const farFuture = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(); // beyond the 7-day window

  const npoActivities = [
    // Open, low coverage (1/6), starting soon -> must appear in lowCoverageActivities.
    { id: "a1", npoId: "npo-1", status: "APERTA", iscritti: ["u1"], slots: 6, dateTime: soon, endDateTime: soon, created_at: withinWeek },
    // Completed, ends just after month start -> always counts this month; week
    // membership is derived below from the boundary comparison.
    { id: "a2", npoId: "npo-1", status: "COMPLETATA", iscritti: ["u1", "u2"], slots: 4, dateTime: hoursFrom(monthStart, -3), endDateTime: withinMonth, created_at: longAgo },
    // Open, low coverage (1/10) but starting beyond the 7-day window -> must be
    // excluded from lowCoverageActivities by the date cutoff, not by coverage.
    { id: "a3", npoId: "npo-1", status: "APERTA", iscritti: ["u1"], slots: 10, dateTime: farFuture, endDateTime: farFuture, created_at: withinWeek },
    // Open, full coverage, starting soon -> must be excluded by coverage, not by date.
    { id: "a4", npoId: "npo-1", status: "APERTA", iscritti: ["u1", "u2"], slots: 2, dateTime: soon, endDateTime: soon, created_at: withinWeek },
    // Belongs to a different NPO entirely -> must never leak into npo-1's aggregates.
    { id: "a5", npoId: "npo-2", status: "APERTA", iscritti: ["u1"], slots: 10, dateTime: soon, endDateTime: soon, created_at: withinWeek },
    // Open, low coverage (0/8), starting 5 days out -> past the old 3-day cutoff but
    // inside the new 7-day one: must now appear in lowCoverageActivities.
    { id: "a6", npoId: "npo-1", status: "APERTA", iscritti: [], slots: 8, dateTime: midWindow, endDateTime: midWindow, created_at: withinWeek },
  ];

  const summary = computeNPOReportSummary({
    npoId: "npo-1",
    activities: npoActivities as any,
    applications: [
      { id: "app-1", npoId: "npo-1", status: "PENDING", appliedDate: withinWeek },
      { id: "app-2", npoId: "npo-1", status: "APPROVED", appliedDate: withinMonth, reviewedDate: withinWeek },
      { id: "app-3", npoId: "npo-1", status: "PENDING", appliedDate: longAgo },
      { id: "app-4", npoId: "npo-2", status: "PENDING", appliedDate: withinWeek },
    ] as any,
    activityApplications: [
      { activityId: "a1", status: "APPROVED", appliedDate: withinWeek },
      { activityId: "a2", status: "APPROVED", appliedDate: withinMonth },
      { activityId: "does-not-exist", status: "APPROVED", appliedDate: withinWeek },
    ],
    followerRows: [
      { created_at: withinWeek, follower_id: "u1" },
      { created_at: withinMonth, follower_id: "u2" },
      { created_at: longAgo, follower_id: "u3" },
    ],
    postRows: [
      { id: "p1", created_at: withinWeek },
      { id: "p2", created_at: longAgo },
    ],
    storyMetricRows: [
      { metric_date: withinWeek.slice(0, 10), stories_count: 2 },
      { metric_date: withinMonth.slice(0, 10), stories_count: 3 },
      { metric_date: longAgo.slice(0, 10), stories_count: 5 },
    ],
    reactionRows: [
      { user_id: "u1", created_at: withinWeek }, // follower, this week
      { user_id: "u1", created_at: withinWeek }, // same follower again (duplicate on purpose)
      { user_id: "u999", created_at: withinWeek }, // not a follower
      { user_id: "u2", created_at: longAgo }, // follower, but outside the date window
    ],
  });

  // ── Followers ──────────────────────────────────────────────────────────────
  assert(summary.followerCount === 3, "followerCount must count all follower rows regardless of date");
  assert(summary.newFollowersThisWeek === (withinWeek >= weekStartIso ? 1 : 0), "newFollowersThisWeek must count only u1's row");
  const expectedFollowersMonth = [withinWeek, withinMonth, longAgo].filter((d) => d >= monthStartIso).length;
  assert(
    summary.newFollowersThisMonth === expectedFollowersMonth,
    `newFollowersThisMonth: expected ${expectedFollowersMonth}, got ${summary.newFollowersThisMonth}`
  );

  // ── Applications (npoId-scoped; app-4 belongs to npo-2 and must be excluded) ──
  assert(summary.applicationsThisWeek === 1, "applicationsThisWeek must count app-1 only (app-3 is old, app-4 is another NPO)");
  const expectedApplicationsMonth = [withinWeek, withinMonth].filter((d) => d >= monthStartIso).length;
  assert(
    summary.applicationsThisMonth === expectedApplicationsMonth,
    `applicationsThisMonth: expected ${expectedApplicationsMonth}, got ${summary.applicationsThisMonth}`
  );
  assert(summary.approvedThisWeek === 1, "approvedThisWeek must count app-2 via its reviewedDate");
  assert(summary.approvedThisMonth === 1, "approvedThisMonth must count app-2 via its reviewedDate");

  // ── Registrations (activityApplications; must resolve against this NPO's activities) ──
  assert(summary.registrationsThisWeek === 1, "registrationsThisWeek must count only the a1 registration (unknown activity must be ignored)");
  const expectedRegistrationsMonth = [withinWeek, withinMonth].filter((d) => d >= monthStartIso).length;
  assert(
    summary.registrationsThisMonth === expectedRegistrationsMonth,
    `registrationsThisMonth: expected ${expectedRegistrationsMonth}, got ${summary.registrationsThisMonth}`
  );

  // ── Published / completed activities ────────────────────────────────────────
  assert(summary.publishedActivitiesThisWeek === 4, "publishedActivitiesThisWeek must count a1, a3, a4, a6 (a2 is old, a5 is another NPO)");
  assert(summary.publishedActivitiesThisMonth === 4, "publishedActivitiesThisMonth must count a1, a3, a4, a6 (a2's created_at is 60 days old)");
  const expectedCompletedWeek = withinMonth >= weekStartIso ? 1 : 0;
  assert(
    summary.completedActivitiesThisWeek === expectedCompletedWeek,
    `completedActivitiesThisWeek: expected ${expectedCompletedWeek}, got ${summary.completedActivitiesThisWeek}`
  );
  assert(summary.completedActivitiesThisMonth === 1, "completedActivitiesThisMonth must count a2 only");

  // ── Low coverage: date-window and coverage-ratio must each be enforced independently ──
  const lowCoverageIds = summary.lowCoverageActivities.map((a) => a.id).sort();
  assert(
    lowCoverageIds.length === 2 && lowCoverageIds[0] === "a1" && lowCoverageIds[1] === "a6",
    `lowCoverageActivities must contain exactly a1 and a6, got [${summary.lowCoverageActivities.map((a) => a.id).join(", ")}]`
  );

  // ── Posts, stories, reactions ────────────────────────────────────────────────
  assert(summary.postsThisWeek === 1, "postsThisWeek must count p1 only");
  const expectedPostsMonth = [withinWeek, longAgo].filter((d) => d >= monthStartIso).length;
  assert(summary.postsThisMonth === expectedPostsMonth, `postsThisMonth: expected ${expectedPostsMonth}, got ${summary.postsThisMonth}`);
  assert(summary.storiesThisWeek === 2, "storiesThisWeek must sum only the within-week story metric row");
  const expectedStoriesMonth = 2 + (withinMonth.slice(0, 10) >= monthStartIso.slice(0, 10) ? 3 : 0);
  assert(summary.storiesThisMonth === expectedStoriesMonth, `storiesThisMonth: expected ${expectedStoriesMonth}, got ${summary.storiesThisMonth}`);
  assert(summary.reactionsThisWeek === 3, "reactionsThisWeek must count both u1 rows and the non-follower u999 row");
  const expectedReactionsMonth = 3 + (longAgo >= monthStartIso ? 1 : 0);
  assert(
    summary.reactionsThisMonth === expectedReactionsMonth,
    `reactionsThisMonth: expected ${expectedReactionsMonth}, got ${summary.reactionsThisMonth}`
  );

  // ── Active followers on content: unique follower ids, non-followers excluded ──
  assert(summary.activeFollowersOnContent === 1, "activeFollowersOnContent must count u1 once, excluding non-follower u999");
  assert(
    summary.activeFollowersOnContentThisMonth === (longAgo >= monthStartIso ? 2 : 1),
    "activeFollowersOnContentThisMonth must count u1 (and u2 only if its old reaction still falls in this month)"
  );

  console.log("PASS NPO report summary scopes by npoId and buckets activities, applications, followers and content correctly at week/month boundaries");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
