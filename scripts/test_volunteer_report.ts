import { computeVolunteerReportSummary } from "../services/VolunteerReportService";
import type { GamificationState } from "../hooks/gamification/types";

async function run() {
    const now = new Date();
    const withinWeek = now.toISOString();
    const withinMonth = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const outsideMonth = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const upcomingSoon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const twoHoursBeforeWeek = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const twoHoursBeforeOutsideMonth = new Date(new Date(outsideMonth).getTime() - 2 * 60 * 60 * 1000).toISOString();
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

    const summary = computeVolunteerReportSummary({
        user: {
            id: "vol-1",
            name: "Francesca",
            role: "VOLUNTEER",
            xp: 520,
            impactPoints: 520,
            impact_points: 520,
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
                title: "Supporto mensa",
                status: "COMPLETATA",
                iscritti: ["vol-1"],
                dateTime: twoHoursBeforeOutsideMonth,
                endDateTime: outsideMonth,
            } as any,
            {
                id: "a3",
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
                status: "PENDING",
                appliedDate: withinWeek,
            },
            {
                id: "app-2",
                volunteerId: "vol-1",
                status: "APPROVED",
                appliedDate: withinMonth,
                reviewedDate: withinWeek,
            },
        ] as any,
        reviews: [
            {
                id: "r1",
                volunteerId: "vol-1",
                activityId: "a1",
                date: withinWeek,
            },
        ] as any,
        followerRows: [
            { created_at: withinWeek },
            { created_at: withinMonth },
            { created_at: outsideMonth },
        ],
    });

    console.log(JSON.stringify({
        level: summary.level,
        levelName: summary.levelName,
        completedActivitiesThisWeek: summary.completedActivitiesThisWeek,
        completedActivitiesThisMonth: summary.completedActivitiesThisMonth,
        volunteerHoursThisWeek: summary.volunteerHoursThisWeek,
        volunteerHoursThisMonth: summary.volunteerHoursThisMonth,
        applicationsThisWeek: summary.applicationsThisWeek,
        applicationsThisMonth: summary.applicationsThisMonth,
        approvedApplicationsThisWeek: summary.approvedApplicationsThisWeek,
        approvedApplicationsThisMonth: summary.approvedApplicationsThisMonth,
        followedNposThisWeek: summary.followedNposThisWeek,
        followedNposThisMonth: summary.followedNposThisMonth,
        reviewsLeftThisWeek: summary.reviewsLeftThisWeek,
        reviewsLeftThisMonth: summary.reviewsLeftThisMonth,
        pendingReviewsCount: summary.pendingReviewsCount,
        upcomingActivitiesCount: summary.upcomingActivitiesCount,
    }, null, 2));
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
