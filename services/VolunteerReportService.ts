import { AppActivity, AppUser, OldApplication, OldReview } from '../types';

export type VolunteerReportSummary = {
    totalXP: number;
    level: number;
    levelName: string;
    completedActivitiesThisWeek: number;
    completedActivitiesThisMonth: number;
    volunteerHoursThisWeek: number;
    volunteerHoursThisMonth: number;
    applicationsThisWeek: number;
    applicationsThisMonth: number;
    approvedApplicationsThisWeek: number;
    approvedApplicationsThisMonth: number;
    followedNposThisWeek: number;
    followedNposThisMonth: number;
    reviewsLeftThisWeek: number;
    reviewsLeftThisMonth: number;
    pendingReviewsCount: number;
    upcomingActivitiesCount: number;
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

function getLevelFromXP(totalXP: number) {
    if (totalXP < 110) return 1;
    if (totalXP < 450) return 2;
    if (totalXP < 1000) return 3;
    if (totalXP < 2000) return 4;
    if (totalXP < 3500) return 5;
    if (totalXP < 5500) return 6;
    if (totalXP < 8000) return 7;
    if (totalXP < 11000) return 8;
    if (totalXP < 15000) return 9;
    return 10 + Math.floor((totalXP - 15000) / 5000);
}

function getLevelName(level: number) {
    switch (level) {
        case 1: return 'Novizio';
        case 2: return 'Apprendista';
        case 3: return 'Sociale';
        case 4: return 'Attivo';
        case 5: return 'Esperto';
        case 6: return 'Mentore';
        case 7: return 'Pilastro';
        case 8: return 'Ambasciatore';
        case 9: return 'Leader';
        default: return 'Leggenda';
    }
}

function getDurationHours(activity: AppActivity) {
    const start = new Date(activity.dateTime).getTime();
    const end = new Date(activity.endDateTime || activity.dateTime).getTime();
    const duration = (end - start) / (1000 * 60 * 60);
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

export function computeVolunteerReportSummary(params: {
    user: AppUser;
    activities: AppActivity[];
    applications: OldApplication[];
    reviews: OldReview[];
    followerRows?: { created_at?: string | null }[];
}): VolunteerReportSummary {
    const weekStart = startOfWeek();
    const monthStart = startOfMonth();
    const nowIso = new Date().toISOString();
    const totalXP = params.user.xp ?? params.user.impactPoints ?? params.user.impact_points ?? 0;
    const level = getLevelFromXP(totalXP);

    const myActivities = params.activities.filter((activity) => activity.iscritti.includes(params.user.id));
    const completedActivities = myActivities.filter((activity) => activity.status === 'COMPLETATA');
    const upcomingActivitiesCount = myActivities.filter((activity) => {
        if (!(activity.status === 'APERTA' || activity.status === 'IN_CORSO')) return false;
        return (activity.endDateTime || activity.dateTime) >= nowIso;
    }).length;

    const completedActivitiesThisWeek = completedActivities.filter((activity) => (activity.endDateTime || activity.dateTime) >= weekStart).length;
    const completedActivitiesThisMonth = completedActivities.filter((activity) => (activity.endDateTime || activity.dateTime) >= monthStart).length;

    const volunteerHoursThisWeek = Math.round(
        completedActivities
            .filter((activity) => (activity.endDateTime || activity.dateTime) >= weekStart)
            .reduce((sum, activity) => sum + getDurationHours(activity), 0)
    );
    const volunteerHoursThisMonth = Math.round(
        completedActivities
            .filter((activity) => (activity.endDateTime || activity.dateTime) >= monthStart)
            .reduce((sum, activity) => sum + getDurationHours(activity), 0)
    );

    const applicationsThisWeek = params.applications.filter((application) => application.appliedDate >= weekStart).length;
    const applicationsThisMonth = params.applications.filter((application) => application.appliedDate >= monthStart).length;
    const approvedApplicationsThisWeek = params.applications.filter((application) => application.status === 'APPROVED' && !!application.reviewedDate && application.reviewedDate >= weekStart).length;
    const approvedApplicationsThisMonth = params.applications.filter((application) => application.status === 'APPROVED' && !!application.reviewedDate && application.reviewedDate >= monthStart).length;

    const followerRows = params.followerRows || [];
    const followedNposThisWeek = followerRows.filter((row) => !!row.created_at && row.created_at >= weekStart).length;
    const followedNposThisMonth = followerRows.filter((row) => !!row.created_at && row.created_at >= monthStart).length;

    const myReviews = params.reviews.filter((review) => review.volunteerId === params.user.id);
    const reviewsLeftThisWeek = myReviews.filter((review) => review.date >= weekStart).length;
    const reviewsLeftThisMonth = myReviews.filter((review) => review.date >= monthStart).length;
    const reviewedActivityIds = new Set(myReviews.map((review) => review.activityId));
    const pendingReviewsCount = completedActivities.filter((activity) => !reviewedActivityIds.has(activity.id)).length;

    return {
        totalXP,
        level,
        levelName: getLevelName(level),
        completedActivitiesThisWeek,
        completedActivitiesThisMonth,
        volunteerHoursThisWeek,
        volunteerHoursThisMonth,
        applicationsThisWeek,
        applicationsThisMonth,
        approvedApplicationsThisWeek,
        approvedApplicationsThisMonth,
        followedNposThisWeek,
        followedNposThisMonth,
        reviewsLeftThisWeek,
        reviewsLeftThisMonth,
        pendingReviewsCount,
        upcomingActivitiesCount,
    };
}

export class VolunteerReportService {
    async getVolunteerReportSummary(params: {
        user: AppUser;
        activities: AppActivity[];
        applications: OldApplication[];
        reviews: OldReview[];
        followerRows?: { created_at?: string | null }[];
    }): Promise<VolunteerReportSummary> {
        let followerRows = params.followerRows;
        if (!followerRows) {
            const { supabase } = await import('../utils/supabase');
            const { data, error } = await supabase
                .from('npo_followers')
                .select('created_at')
                .eq('follower_id', params.user.id);

            if (error) {
                console.error('[VolunteerReportService] follower rows error', error);
            }
            followerRows = data || [];
        }

        return computeVolunteerReportSummary({
            ...params,
            followerRows,
        });
    }
}

export const volunteerReportService = new VolunteerReportService();
