import { AppActivity, OldApplication } from '../types';

export type NPOReportSummary = {
    followerCount: number;
    newFollowersThisWeek: number;
    newFollowersThisMonth: number;
    applicationsThisWeek: number;
    applicationsThisMonth: number;
    registrationsThisWeek: number;
    registrationsThisMonth: number;
    approvedThisWeek: number;
    approvedThisMonth: number;
    publishedActivitiesThisWeek: number;
    publishedActivitiesThisMonth: number;
    completedActivitiesThisWeek: number;
    completedActivitiesThisMonth: number;
    lowCoverageActivities: AppActivity[];
    postsThisWeek: number;
    postsThisMonth: number;
    storiesThisWeek: number;
    storiesThisMonth: number;
    reactionsThisWeek: number;
    reactionsThisMonth: number;
    activeFollowersOnContent: number;
    activeFollowersOnContentThisMonth: number;
};

function startOfWeek() {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const start = new Date(now);
    start.setDate(now.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
}

function startOfMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
}

export function computeNPOReportSummary(params: {
    npoId: string;
    activities: AppActivity[];
    applications: OldApplication[];
    activityApplications: {
        activityId: string;
        status: string;
        appliedDate?: string;
    }[];
    followerRows?: { created_at?: string | null; follower_id?: string | null }[];
    postRows?: { id: string; created_at?: string | null }[];
    storyMetricRows?: { metric_date: string; stories_count: number }[];
    reactionRows?: { user_id?: string | null; created_at?: string | null }[];
}): NPOReportSummary {
    const weekStart = startOfWeek();
    const monthStart = startOfMonth();
    const weekStartDate = weekStart.slice(0, 10);
    const monthStartDate = monthStart.slice(0, 10);
    const npoActivities = params.activities.filter((activity) => activity.npoId === params.npoId);
    const followerRows = params.followerRows || [];
    const postRows = params.postRows || [];
    const storyMetricRows = params.storyMetricRows || [];
    const reactionRows = params.reactionRows || [];
    const followerIds = new Set(followerRows.map((row) => row.follower_id).filter(Boolean));

    const sumStoryMetricsSince = (dateFrom: string) =>
        storyMetricRows
            .filter((row) => !!row.metric_date && row.metric_date >= dateFrom)
            .reduce((sum, row) => sum + (row.stories_count || 0), 0);

    const newFollowersThisWeek = followerRows.filter((row: any) => row.created_at >= weekStart).length;
    const newFollowersThisMonth = followerRows.filter((row: any) => row.created_at >= monthStart).length;
    const postsThisWeek = postRows.filter((row) => !!row.created_at && row.created_at >= weekStart).length;
    const postsThisMonth = postRows.filter((row) => !!row.created_at && row.created_at >= monthStart).length;
    const storiesThisWeek = sumStoryMetricsSince(weekStartDate);
    const storiesThisMonth = sumStoryMetricsSince(monthStartDate);
    const reactionsThisWeek = reactionRows.filter((row) => !!row.created_at && row.created_at >= weekStart).length;
    const reactionsThisMonth = reactionRows.filter((row) => !!row.created_at && row.created_at >= monthStart).length;
    const activeFollowersOnContent = new Set(
        reactionRows
            .filter((row) => !!row.created_at && row.created_at >= weekStart && !!row.user_id && followerIds.has(row.user_id))
            .map((row) => row.user_id)
    ).size;
    const activeFollowersOnContentThisMonth = new Set(
        reactionRows
            .filter((row) => !!row.created_at && row.created_at >= monthStart && !!row.user_id && followerIds.has(row.user_id))
            .map((row) => row.user_id)
    ).size;

    const applicationsThisWeek = params.applications.filter(
        (application) => application.npoId === params.npoId && application.appliedDate >= weekStart
    ).length;
    const applicationsThisMonth = params.applications.filter(
        (application) => application.npoId === params.npoId && application.appliedDate >= monthStart
    ).length;

    const registrationsThisWeek = params.activityApplications.filter((application) => {
        const activity = npoActivities.find((item) => item.id === application.activityId);
        return !!activity && !!application.appliedDate && application.appliedDate >= weekStart;
    }).length;
    const registrationsThisMonth = params.activityApplications.filter((application) => {
        const activity = npoActivities.find((item) => item.id === application.activityId);
        return !!activity && !!application.appliedDate && application.appliedDate >= monthStart;
    }).length;

    const approvedThisWeek = params.applications.filter(
        (application) => application.npoId === params.npoId && application.status === 'APPROVED' && !!application.reviewedDate && application.reviewedDate >= weekStart
    ).length;
    const approvedThisMonth = params.applications.filter(
        (application) => application.npoId === params.npoId && application.status === 'APPROVED' && !!application.reviewedDate && application.reviewedDate >= monthStart
    ).length;

    const publishedActivitiesThisWeek = npoActivities.filter((activity) => {
        const createdAt = (activity as any).created_at;
        return !!createdAt && createdAt >= weekStart;
    }).length;
    const publishedActivitiesThisMonth = npoActivities.filter((activity) => {
        const createdAt = (activity as any).created_at;
        return !!createdAt && createdAt >= monthStart;
    }).length;

    const completedActivitiesThisWeek = npoActivities.filter((activity) => {
        if (activity.status !== 'COMPLETATA') return false;
        const endDate = activity.endDateTime || activity.dateTime;
        return !!endDate && endDate >= weekStart;
    }).length;
    const completedActivitiesThisMonth = npoActivities.filter((activity) => {
        if (activity.status !== 'COMPLETATA') return false;
        const endDate = activity.endDateTime || activity.dateTime;
        return !!endDate && endDate >= monthStart;
    }).length;

    // Finestra allargata da 3 a 7 giorni: con soli 3 giorni il banner "copertura bassa"
    // restava quasi sempre nascosto anche per attività con 0 iscritti, perché la maggior
    // parte delle attività aperte viene pubblicata con più di 3 giorni di anticipo.
    const sevenDaysAhead = new Date();
    sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);
    const lowCoverageActivities = npoActivities.filter((activity) => {
        if (!(activity.status === 'APERTA' || activity.status === 'IN_CORSO')) return false;
        const startDate = new Date(activity.dateTime);
        if (Number.isNaN(startDate.getTime()) || startDate > sevenDaysAhead) return false;
        const coverage = activity.slots > 0 ? activity.iscritti.length / activity.slots : 1;
        return coverage < 0.5;
    });

    return {
        followerCount: followerRows.length,
        newFollowersThisWeek,
        newFollowersThisMonth,
        applicationsThisWeek,
        applicationsThisMonth,
        registrationsThisWeek,
        registrationsThisMonth,
        approvedThisWeek,
        approvedThisMonth,
        publishedActivitiesThisWeek,
        publishedActivitiesThisMonth,
        completedActivitiesThisWeek,
        completedActivitiesThisMonth,
        lowCoverageActivities,
        postsThisWeek,
        postsThisMonth,
        storiesThisWeek,
        storiesThisMonth,
        reactionsThisWeek,
        reactionsThisMonth,
        activeFollowersOnContent,
        activeFollowersOnContentThisMonth,
    };
}

export class ReportService {
    async getNPOReportSummary(params: {
        npoId: string;
        activities: AppActivity[];
        applications: OldApplication[];
        activityApplications: {
            activityId: string;
            status: string;
            appliedDate?: string;
        }[];
        followerRows?: { created_at?: string | null; follower_id?: string | null }[];
        postRows?: { id: string; created_at?: string | null }[];
        storyMetricRows?: { metric_date: string; stories_count: number }[];
        reactionRows?: { user_id?: string | null; created_at?: string | null }[];
    }): Promise<NPOReportSummary> {
        let followerRows = params.followerRows;
        let postRows = params.postRows;
        let storyMetricRows = params.storyMetricRows;
        let reactionRows = params.reactionRows;
        if (!followerRows) {
            const { supabase } = await import('../utils/supabase');
            const supabaseAny = supabase as any;
            const { data, error: followerError } = await supabase
                .from('npo_followers')
                .select('created_at, follower_id')
                .eq('npo_id', params.npoId);

            if (followerError) {
                console.error('[ReportService] follower rows error', followerError);
            }
            followerRows = data || [];

            const { data: postData, error: postError } = await supabase
                .from('community_posts')
                .select('id, created_at')
                .eq('author_id', params.npoId);

            if (postError) {
                console.error('[ReportService] post rows error', postError);
            }
            postRows = postData || [];

            const monthStart = startOfMonth().slice(0, 10);
            const { data: storyData, error: storyError } = await supabaseAny
                .from('story_metrics_daily')
                .select('metric_date, stories_count')
                .eq('author_id', params.npoId)
                .gte('metric_date', monthStart);

            if (storyError) {
                console.error('[ReportService] story rows error', storyError);
            }
            storyMetricRows = storyData || [];

            const postIds = (postRows || []).map((row) => row.id).filter(Boolean);
            if (postIds.length > 0) {
                const { data: reactionData, error: reactionError } = await supabase
                    .from('post_reactions')
                    .select('user_id, created_at')
                    .in('post_id', postIds);

                if (reactionError) {
                    console.error('[ReportService] reaction rows error', reactionError);
                }
                reactionRows = reactionData || [];
            } else {
                reactionRows = [];
            }
        }
        return computeNPOReportSummary({
            ...params,
            followerRows,
            postRows,
            storyMetricRows,
            reactionRows,
        });
    }
}

export const reportService = new ReportService();
