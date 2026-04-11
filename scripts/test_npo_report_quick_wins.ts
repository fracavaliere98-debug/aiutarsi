import { computeNPOReportSummary } from '../services/ReportService';

async function run() {
    const now = new Date();
    const withinWeek = now.toISOString();
    const outsideWeek = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString();
    const upcomingSoon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();

    const summary = computeNPOReportSummary({
        npoId: 'npo-1',
        activities: [
            {
                id: 'a1',
                npoId: 'npo-1',
                npoName: 'Associare',
                title: 'Raccolta viveri',
                description: '',
                category: 'Sociale',
                status: 'APERTA',
                iscritti: ['u1'],
                location: { coords: { lat: 0, lng: 0 }, address: '' },
                dateTime: upcomingSoon,
                endDateTime: upcomingSoon,
                slots: 6,
                skills: [],
                matchPercentage: 0,
                isUrgent: false,
                created_at: withinWeek,
            } as any,
            {
                id: 'a2',
                npoId: 'npo-1',
                npoName: 'Associare',
                title: 'Doposcuola',
                description: '',
                category: 'Educazione',
                status: 'COMPLETATA',
                iscritti: ['u1', 'u2'],
                location: { coords: { lat: 0, lng: 0 }, address: '' },
                dateTime: outsideWeek,
                endDateTime: withinWeek,
                slots: 4,
                skills: [],
                matchPercentage: 0,
                isUrgent: false,
                created_at: outsideWeek,
            } as any,
        ],
        applications: [
            {
                id: 'app1',
                npoId: 'npo-1',
                volunteerId: 'u10',
                npoName: 'Associare',
                volunteerName: 'Mario',
                volunteerAvatar: '',
                message: '',
                skills: [],
                status: 'PENDING',
                appliedDate: withinWeek,
            },
            {
                id: 'app2',
                npoId: 'npo-1',
                volunteerId: 'u11',
                npoName: 'Associare',
                volunteerName: 'Luca',
                volunteerAvatar: '',
                message: '',
                skills: [],
                status: 'APPROVED',
                appliedDate: withinWeek,
                reviewedDate: withinWeek,
            },
        ],
        activityApplications: [
            {
                activityId: 'a1',
                status: 'APPROVED',
                appliedDate: withinWeek,
            },
        ],
        followerRows: [
            { created_at: withinWeek, follower_id: 'u1' },
            { created_at: outsideWeek, follower_id: 'u2' },
        ],
        postRows: [
            { id: 'p1', created_at: withinWeek },
            { id: 'p2', created_at: outsideWeek },
        ],
        storyMetricRows: [
            { metric_date: withinWeek.slice(0, 10), stories_count: 1 },
        ],
        reactionRows: [
            { user_id: 'u1', created_at: withinWeek },
            { user_id: 'u1', created_at: withinWeek },
            { user_id: 'u999', created_at: withinWeek },
        ],
    });

    console.log(JSON.stringify({
        registrationsThisWeek: summary.registrationsThisWeek,
        applicationsThisWeek: summary.applicationsThisWeek,
        approvedThisWeek: summary.approvedThisWeek,
        newFollowersThisMonth: summary.newFollowersThisMonth,
        applicationsThisMonth: summary.applicationsThisMonth,
        registrationsThisMonth: summary.registrationsThisMonth,
        approvedThisMonth: summary.approvedThisMonth,
        publishedActivitiesThisWeek: summary.publishedActivitiesThisWeek,
        completedActivitiesThisWeek: summary.completedActivitiesThisWeek,
        publishedActivitiesThisMonth: summary.publishedActivitiesThisMonth,
        completedActivitiesThisMonth: summary.completedActivitiesThisMonth,
        postsThisWeek: summary.postsThisWeek,
        postsThisMonth: summary.postsThisMonth,
        storiesThisWeek: summary.storiesThisWeek,
        storiesThisMonth: summary.storiesThisMonth,
        reactionsThisWeek: summary.reactionsThisWeek,
        reactionsThisMonth: summary.reactionsThisMonth,
        activeFollowersOnContent: summary.activeFollowersOnContent,
        activeFollowersOnContentThisMonth: summary.activeFollowersOnContentThisMonth,
        lowCoverageActivities: summary.lowCoverageActivities.map((item) => item.id),
    }, null, 2));
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
