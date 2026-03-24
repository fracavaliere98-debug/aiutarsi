import { AppActivity, AppActivityApplication, OldReview, OldVolunteerReview } from '../types';
import { eventEmitter, SyncEvents } from '../utils/EventEmitter';
import { supabase } from '../utils/supabase';
import { storageService } from './StorageService';

export class ActivityService {

    // Helper: Map DB Activity to AppActivity
    private _mapDbActivityToApp(dbActivity: any): AppActivity {
        const activity: AppActivity = {
            ...dbActivity,
            // Core mappings
            id: dbActivity.id,
            npo_id: dbActivity.npo_id,
            npoId: dbActivity.npo_id,
            npoName: (() => {
                if (dbActivity.npoName) return dbActivity.npoName;
                if (dbActivity.npo_name) return dbActivity.npo_name;
                
                const p = Array.isArray(dbActivity.profiles) ? dbActivity.profiles[0] : dbActivity.profiles;
                if (p) {
                    return p.npo_name || p.full_name || dbActivity.full_name || "NPO Sconosciuta";
                }
                
                return dbActivity.full_name || "NPO Sconosciuta";
            })(),
            title: dbActivity.title,
            description: dbActivity.description,
            dateTime: dbActivity.date_start,
            endDateTime: dbActivity.date_end,
            imageUrl: dbActivity.image_url,
            slots: dbActivity.slots_total,
            category: dbActivity.category,
            status: dbActivity.status,
            matchPercentage: dbActivity.match_percentage || 0,
            isUrgent: dbActivity.is_urgent || false,

            // Relational mappings
            iscritti: dbActivity.activity_participants
                ?.filter((p: any) => ['REGISTERED', 'APPROVED', 'PENDING'].includes(p.status))
                .map((p: any) => p.user_id) || [],
            skills: dbActivity.activity_skills?.map((s: any) => s.skill) || [],
            profiles: dbActivity.profiles,
            activity_participants: dbActivity.activity_participants,
            activity_skills: dbActivity.activity_skills,

            // Legacy location mapping
            location: {
                address: dbActivity.location_address || "",
                coords: {
                    lat: dbActivity.location_lat || 0,
                    lng: dbActivity.location_lng || 0
                }
            }
        };
        return activity;
    }

    async getActivitiesByRadius(userLat: number, userLng: number, radiusKm: number): Promise<(AppActivity & { distanceMeters: number })[]> {
        const { data, error } = await supabase.rpc('get_activities_near_me', {
            user_lat: userLat,
            user_lng: userLng,
            radius_meters: radiusKm * 1000
        });
        if (error) throw new Error(error.message);

        // Enrich with skills & participants in one go
        const ids: string[] = (data || []).map((r: any) => r.id);
        if (ids.length === 0) return [];

        const [{ data: skillRows }, { data: partRows }, { data: profiles }] = await Promise.all([
            supabase.from('activity_skills').select('activity_id, skill').in('activity_id', ids),
            supabase.from('activity_participants').select('activity_id, user_id, status').in('activity_id', ids),
            supabase.from('profiles').select('id, npo_name, full_name, public_email, email, is_verified').in('id', (data || []).map((r: any) => r.npo_id)),
        ]);

        const skillsMap: Record<string, string[]> = {};
        for (const r of skillRows || []) {
            if (!skillsMap[r.activity_id]) skillsMap[r.activity_id] = [];
            skillsMap[r.activity_id].push(r.skill);
        }
        const partsMap: Record<string, string[]> = {};
        for (const r of partRows || []) {
            if (!partsMap[r.activity_id]) partsMap[r.activity_id] = [];
            partsMap[r.activity_id].push(r.user_id);
        }
        const profilesMap: Record<string, any> = {};
        for (const r of profiles || []) {
            profilesMap[r.id] = {
                npoName: r.npo_name || r.full_name || 'NPO Sconosciuta',
                email: r.public_email || r.email || '',
                isVerified: r.is_verified
            };
        }

        return (data || []).map((r: any) => ({
            ...r,
            id: r.id,
            npo_id: r.npo_id,
            npoId: r.npo_id,
            npoName: profilesMap[r.npo_id]?.npoName || 'NPO Sconosciuta',
            npoEmail: profilesMap[r.npo_id]?.email || '',
            title: r.title,
            description: r.description,
            dateTime: r.date_start,
            endDateTime: r.date_end,
            imageUrl: r.image_url,
            slots: r.slots_total,
            category: r.category,
            status: r.status,
            matchPercentage: 0,
            isUrgent: r.is_urgent || false,
            skills: skillsMap[r.id] || [],
            iscritti: (partRows || [])
                .filter((p: any) => p.activity_id === r.id && ['REGISTERED', 'APPROVED', 'PENDING'].includes(p.status))
                .map((p: any) => p.user_id),
            distanceMeters: r.distance_meters,
            location: {
                address: r.location_address || '',
                coords: { lat: r.location_lat || 0, lng: r.location_lng || 0 }
            },
            // Relational mappings if needed by UI
            profiles: { 
                npo_name: profilesMap[r.npo_id]?.npoName, 
                full_name: profilesMap[r.npo_id]?.npoName, 
                avatar_url: null,
                is_verified: profilesMap[r.npo_id]?.isVerified
            },
            activity_participants: (partsMap[r.id] || []).map(uid => ({ user_id: uid })),
            activity_skills: (skillsMap[r.id] || []).map(s => ({ skill: s }))
        }));
    }

    async getActivities(
        filter?: {
            userId?: string;
            category?: string;
            npoId?: string;
            searchText?: string;
            limit?: number;
            offset?: number;
            skills?: string[];
            onlyAvailable?: boolean;
            onlyUrgent?: boolean;
            dateFrom?: string;
            dateTo?: string;
            statuses?: string[];
            centerLat?: number;
            centerLng?: number;
            radiusKm?: number;
        },
        signal?: AbortSignal
    ): Promise<{ activities: AppActivity[], totalCount: number, hasMore: boolean }> {
        // ── UNIFIED MATCH path: use new RPC for any geo or user-specific search (highest efficiency) ──────
        if ((filter?.userId || filter?.centerLat !== undefined) && !filter?.npoId) {
            try {
                const { data, error, count } = await supabase.rpc('get_activities_with_match', {
                    p_user_id: filter.userId || null,
                    p_category: (filter.category === 'Tutti' ? null : filter.category) || null,
                    p_search: filter.searchText || null,
                    p_center_lat: filter.centerLat || null,
                    p_center_lng: filter.centerLng || null,
                    p_radius_km: filter.radiusKm || 100,
                    p_limit: filter.limit || 50,
                    p_offset: filter.offset || 0,
                    p_skills: filter.skills || [],
                    p_only_urgent: filter.onlyUrgent || false,
                    p_date_from: filter.dateFrom || null,
                    p_date_to: filter.dateTo || null,
                    p_statuses: filter.statuses || ['APERTA', 'IN_CORSO', 'COMPLETATA']
                }, { count: 'exact' });

                if (error) throw error;

                const ids = (data || []).map((r: any) => r.id);
                if (ids.length === 0) return { activities: [], totalCount: 0, hasMore: false };

                // Hydrate with participants and skills
                const [{ data: skillRows }, { data: partRows }] = await Promise.all([
                    supabase.from('activity_skills').select('activity_id, skill').in('activity_id', ids),
                    supabase.from('activity_participants').select('activity_id, user_id, status').in('activity_id', ids),
                ]);

                const skillsMap: Record<string, string[]> = {};
                for (const r of (skillRows || [])) {
                    if (!skillsMap[r.activity_id]) skillsMap[r.activity_id] = [];
                    skillsMap[r.activity_id].push(r.skill);
                }
                const partsMap: Record<string, string[]> = {};
                for (const r of (partRows || [])) {
                    if (!partsMap[r.activity_id]) partsMap[r.activity_id] = [];
                    partsMap[r.activity_id].push(r.user_id);
                }

                const activities = (data || []).map((r: any) => ({
                    ...this._mapDbActivityToApp({
                        ...r,
                        date_start: r.date_start,
                        date_end: r.date_end,
                        image_url: r.image_url,
                        slots_total: r.slots_total,
                        is_urgent: r.is_urgent,
                        location_address: r.location_address,
                        location_lat: r.location_lat,
                        location_lng: r.location_lng,
                    }),
                    matchPercentage: r.match_percentage || 0,
                    skills: skillsMap[r.id] || [],
                    iscritti: (partRows || [])
                        .filter((p: any) => p.activity_id === r.id && ['REGISTERED', 'APPROVED', 'PENDING'].includes(p.status))
                        .map((p: any) => p.user_id)
                }));

                const totalCount = count || activities.length;
                const hasMore = (filter.offset || 0) + activities.length < totalCount;

                return { activities, totalCount, hasMore };
            } catch (e: any) {
                console.error('[ActivityService] Unified match RPC failed, falling back:', e.message);
            }
        }

        // ── STANDARD path: direct table query (used for NPO dashboards or simple lists) ──────
        try {
            let query = supabase
                .from('activities')
                .select(`
                    *,
                    profiles:npo_id (npo_name, full_name, public_email, email, is_verified),
                    activity_skills!inner (skill),
                    activity_participants (user_id, status)
                `, { count: 'exact' });

            if (filter?.category && filter.category !== "Tutti") {
                query = query.eq('category', filter.category);
            }
            if (filter?.npoId) {
                query = query.eq('npo_id', filter.npoId);
            }
            if (filter?.searchText) {
                const term = `%${filter.searchText}%`;
                // Optimized search
                query = query.or(`title.ilike.${term},description.ilike.${term}`);
            }
            if (filter?.onlyUrgent) {
                query = query.eq('is_urgent', true);
            }
            if (filter?.dateFrom) {
                query = query.gte('date_start', filter.dateFrom);
            }
            if (filter?.dateTo) {
                query = query.lte('date_start', filter.dateTo);
            }

            // Database-level skills filtering using !inner join (Intersection)
            if (filter?.skills && filter.skills.length > 0) {
                query = query.in('activity_skills.skill', filter.skills);
            }

            if (filter?.statuses && filter.statuses.length > 0) {
                query = query.in('status', filter.statuses);
            } else {
                query = query.neq('status', 'CANCELLATA');
            }

            query = query.order('is_urgent', { ascending: false })
                .order('date_start', { ascending: true })
                .order('created_at', { ascending: false });

            const limit = filter?.limit || (filter ? 20 : 1000);
            const offset = filter?.offset || 0;
            query = query.range(offset, offset + limit - 1);

            const { data, error, count } = await (signal ? query.abortSignal(signal) : query);

            if (error) {
                if (error.code === 'ABORTED' || error.message?.includes('abort')) {
                    return { activities: [], totalCount: 0, hasMore: false };
                }
                throw error;
            }

            const activities = data.map((row: any) => this._mapDbActivityToApp(row));
            const totalCount = count || 0;
            const hasMore = offset + activities.length < totalCount;

            return { activities, totalCount, hasMore };

        } catch (error) {
            console.error('Error fetching activities:', error);
            return { activities: [], totalCount: 0, hasMore: false };
        }
    }

    async getActivityById(id: string): Promise<AppActivity | null> {
        try {
            const { data, error } = await supabase
                .from('activities')
                .select(`
                    *,
                    profiles:npo_id (npo_name, full_name, public_email, email, is_verified),
                    activity_skills (skill),
                    activity_participants (user_id, status)
                `)
                .eq('id', id)
                .single();

            if (error) return null;

            return this._mapDbActivityToApp(data);
        } catch (error) {
            console.error('Error getting activity by id:', error);
            return null;
        }
    }

    async createActivity(activityData: Omit<AppActivity, 'id'>): Promise<AppActivity> {
        try {
            // --- NEW: Handle Image Upload ---
            if (activityData.imageUrl && activityData.imageUrl.startsWith('file://')) {
                const uploadedUrl = await storageService.uploadActivityImage('new_activity', activityData.imageUrl);
                if (uploadedUrl) {
                    activityData.imageUrl = uploadedUrl;
                }
            }

            // 1. Insert AppActivity
            const { data: activity, error } = await supabase
                .from('activities')
                .insert({
                    npo_id: activityData.npoId,
                    title: activityData.title,
                    description: activityData.description,
                    date_start: activityData.dateTime,
                    date_end: activityData.endDateTime,
                    location_address: activityData.location.address,
                    location_lat: activityData.location.coords.lat,
                    location_lng: activityData.location.coords.lng,
                    slots_total: activityData.slots,
                    category: activityData.category,
                    status: activityData.status || 'APERTA',
                    match_percentage: activityData.matchPercentage,
                    is_urgent: activityData.isUrgent || false,
                    image_url: activityData.imageUrl,
                    recurrence: activityData.recurrence || null,
                })
                .select()
                .single();

            if (error) throw error;

            // 2. Insert Skills (if any)
            if (activityData.skills && activityData.skills.length > 0) {
                const skillsToInsert = activityData.skills.map((s: string) => ({
                    activity_id: activity.id,
                    skill: s
                }));
                const { error: skillsError } = await supabase
                    .from('activity_skills')
                    .insert(skillsToInsert);

                if (skillsError) console.error("Error inserting skills:", skillsError);
            }

            eventEmitter.emit(SyncEvents.SYNC_ACTIVITIES);

            // Return complete object (simulated for speed, or re-fetch)
            return {
                ...activityData,
                id: activity.id,
                iscritti: []
            };

        } catch (error) {
            console.error("Create activity error:", error);
            throw error;
        }
    }

    async updateActivity(activity: AppActivity): Promise<AppActivity> {
        // --- NEW: Handle Image Upload if changed ---
        if (activity.imageUrl && activity.imageUrl.startsWith('file://')) {
            const uploadedUrl = await storageService.uploadActivityImage(activity.id, activity.imageUrl);
            if (uploadedUrl) {
                activity.imageUrl = uploadedUrl;
            }
        }

        // Defines partial updates to avoid overwriting everything if not needed
        const { error } = await supabase
            .from('activities')
            .update({
                title: activity.title,
                description: activity.description,
                date_start: activity.dateTime,
                date_end: activity.endDateTime,
                location_address: activity.location.address,
                location_lat: activity.location.coords.lat,
                location_lng: activity.location.coords.lng,
                slots_total: activity.slots,
                category: activity.category,
                status: activity.status,
                is_urgent: activity.isUrgent,
                image_url: activity.imageUrl,
                recurrence: activity.recurrence || null,
            })
            .eq('id', activity.id);

        if (error) throw error;

        // --- NOTIFICATIONS: Notify enrolled volunteers ---
        // 1. Fetch participants
        const { data: participants, error: partError } = await supabase
            .from('activity_participants')
            .select('user_id')
            .eq('activity_id', activity.id)
            .in('status', ['APPROVED', 'REGISTERED']);

        if (!partError && participants && participants.length > 0) {
            const notifications = participants.map((p: any) => ({
                user_id: p.user_id,
                type: 'ACTIVITY_UPDATE',
                title: 'Attività Aggiornata',
                message: `L'attività "${activity.title}" a cui sei iscritto ha subito delle modifiche. Controlla i dettagli.`,
                related_activity_id: activity.id,
                read: false
            }));

            const { error: notifError } = await supabase
                .from('notifications')
                .insert(notifications);

            if (notifError) console.error("Error sending update notifications:", notifError);
        }


        // --- SKILLS UPDATE (Diff Logic) ---
        if (activity.skills) {
            // 1. Fetch current skills
            const { data: currentSkillsData, error: fetchError } = await supabase
                .from('activity_skills')
                .select('skill')
                .eq('activity_id', activity.id);

            if (fetchError) {
                console.error("Error fetching current skills for update:", fetchError);
            } else {
                const currentSkills = currentSkillsData?.map((row: any) => row.skill) || [];
                const newSkills = activity.skills;

                // 2. Calculate Diff
                const skillsToAdd = newSkills.filter((s: string) => !currentSkills.includes(s));
                const skillsToRemove = currentSkills.filter((s: string) => !newSkills.includes(s));

                // 3. Remove Old
                if (skillsToRemove.length > 0) {
                    const { error: deleteError } = await supabase
                        .from('activity_skills')
                        .delete()
                        .eq('activity_id', activity.id)
                        .in('skill', skillsToRemove);
                    if (deleteError) console.error("Error deleting old skills:", deleteError);
                }

                // 4. Add New
                if (skillsToAdd.length > 0) {
                    const toInsert = skillsToAdd.map(s => ({
                        activity_id: activity.id,
                        skill: s
                    }));
                    const { error: insertError } = await supabase
                        .from('activity_skills')
                        .insert(toInsert);
                    if (insertError) console.error("Error inserting new skills:", insertError);
                }
            }
        }

        eventEmitter.emit(SyncEvents.SYNC_ACTIVITIES);
        eventEmitter.emit(SyncEvents.SYNC_ACTIVITIES);
        return activity;
    }

    async deleteActivity(id: string): Promise<void> {
        // Soft delete
        const { error } = await supabase
            .from('activities')
            .update({ status: 'CANCELLATA' })
            .eq('id', id);

        if (error) throw error;
        eventEmitter.emit(SyncEvents.SYNC_ACTIVITIES);
    }

    async joinActivity(activityId: string, userId: string, message?: string, phone?: string): Promise<AppActivity> {
        // Using upsert handles re-enrollment after cancellation/rejection
        const { error } = await supabase
            .from('activity_participants')
            .upsert({
                activity_id: activityId,
                user_id: userId,
                status: 'REGISTERED',
                message: message,
                phone: phone
            }, { onConflict: 'activity_id,user_id' });

        if (error) {
            // Handle duplicate key error gracefully
            if (error.code === '23505') { // Unique violation
            } else {
                throw error;
            }
        }

        // Sync with group chat if it exists
        try {
            const { data: conv } = await supabase
                .from('conversations')
                .select('id, title')
                .eq('type', 'ACTIVITY_GROUP')
                .eq('activity_id', activityId)
                .single();

            if (conv) {
                // This will trigger the sync logic I just added to startGroupConversation
                const ChatServiceModule = require('./ChatService').default;
                await ChatServiceModule.startGroupConversation(activityId, conv.title || '', userId);
            }
        } catch (e) {
            // No group chat yet, or error. Ignore.
        }

        eventEmitter.emit(SyncEvents.SYNC_ACTIVITIES);
        const updated = await this.getActivityById(activityId);
        return updated!;
    }

    async leaveActivity(activityId: string, userId: string): Promise<AppActivity> {
        const { error } = await supabase
            .from('activity_participants')
            .delete()
            .eq('activity_id', activityId)
            .eq('user_id', userId);

        if (error) throw error;

        eventEmitter.emit(SyncEvents.SYNC_ACTIVITIES);
        const updated = await this.getActivityById(activityId);
        return updated!;
    }

    async withdrawApplication(activityId: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('activity_participants')
            .delete()
            .eq('activity_id', activityId)
            .eq('user_id', userId);

        if (error) throw error;

        eventEmitter.emit(SyncEvents.SYNC_APPLICATIONS);
        eventEmitter.emit(SyncEvents.SYNC_ACTIVITIES);
    }

    // --- Reviews ---
    async getReviews(): Promise<OldReview[]> {
        const { data, error } = await supabase
            .from('reviews')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching reviews:", error);
            return [];
        }

        return data.map((r: any) => ({
            id: r.id,
            activityId: r.activity_id,
            npoId: r.npo_id,
            volunteerId: r.volunteer_id,
            stars: r.stars,
            comment: r.comment,
            feelings: r.feelings || [],
            date: r.created_at
        }));
    }

    async submitReview(reviewData: Omit<OldReview, 'id'>): Promise<OldReview> {
        const { data, error } = await supabase
            .from('reviews')
            .insert({
                activity_id: reviewData.activityId,
                npo_id: reviewData.npoId,
                volunteer_id: reviewData.volunteerId,
                stars: reviewData.stars,
                comment: reviewData.comment,
                feelings: reviewData.feelings
            })
            .select()
            .single();

        if (error) throw error;

        eventEmitter.emit(SyncEvents.SYNC_REVIEWS);

        return {
            id: data.id,
            activityId: data.activity_id,
            npoId: data.npo_id,
            volunteerId: data.volunteer_id,
            stars: data.stars,
            comment: data.comment,
            feelings: data.feelings || [],
            date: data.created_at
        };
    }

    // --- Applications (AppActivity Specific) ---
    async getActivityApplications(): Promise<AppActivityApplication[]> {
        const { data, error } = await supabase
            .from('activity_participants')
            .select(`
                *,
                volunteer:user_id (full_name, avatar_url, phone)
            `)
            .in('status', ['PENDING', 'APPROVED', 'REJECTED', 'REGISTERED'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching activity applications", error);
            return [];
        }

        return data.map((row: any) => ({
            id: `${row.activity_id}_${row.user_id}`, // Composite key simulation
            activityId: row.activity_id,
            volunteerId: row.user_id,
            volunteerName: row.volunteer?.full_name || "Volontario",
            volunteerAvatar: row.volunteer?.avatar_url || "",
            status: row.status as any,
            appliedDate: row.created_at,
            message: row.message,
            phone: row.phone || row.volunteer?.phone
        }));
    }

    async submitActivityApplication(appData: Omit<AppActivityApplication, 'id'>): Promise<AppActivityApplication> {
        const { error } = await supabase
            .from('activity_participants')
            .insert({
                activity_id: appData.activityId,
                user_id: appData.volunteerId,
                status: appData.status || 'PENDING',
                message: appData.message
            });

        if (error) throw error;
        eventEmitter.emit(SyncEvents.SYNC_APPLICATIONS);

        return {
            ...appData,
            id: `${appData.activityId}_${appData.volunteerId}`
        };
    }

    async updateActivityApplicationStatus(activityId: string, volunteerId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
        const { error } = await supabase
            .from('activity_participants')
            .update({ status })
            .eq('activity_id', activityId)
            .eq('user_id', volunteerId);

        if (error) throw error;

        // If approved, sync with group chat
        if (status === 'APPROVED') {
            try {
                const { data: conv } = await supabase
                    .from('conversations')
                    .select('id, title')
                    .eq('type', 'ACTIVITY_GROUP')
                    .eq('activity_id', activityId)
                    .single();

                if (conv) {
                    const ChatServiceModule = require('./ChatService').default;
                    await ChatServiceModule.startGroupConversation(activityId, conv.title || '', volunteerId);
                }
            } catch (e) {
                // Ignore
            }
        }

        eventEmitter.emit(SyncEvents.SYNC_APPLICATIONS);
    }

    // --- Volunteer Reviews (NPO -> Volunteer) ---
    async getVolunteerReviews(): Promise<OldVolunteerReview[]> {
        const { data, error } = await supabase
            .from('volunteer_reviews')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching volunteer reviews:", error);
            return [];
        }

        return data.map((r: any) => ({
            id: r.id,
            activityId: r.activity_id,
            npoId: r.npo_id,
            volunteerId: r.volunteer_id,
            isPresent: r.is_present,
            stars: r.stars,
            comment: r.comment,
            date: r.created_at
        }));
    }

    async submitVolunteerReviews(reviewsData: Omit<OldVolunteerReview, 'id' | 'date'>[]): Promise<OldVolunteerReview[]> {
        const payloads = reviewsData.map(r => ({
            activity_id: r.activityId,
            npo_id: r.npoId,
            volunteer_id: r.volunteerId,
            is_present: r.isPresent,
            stars: r.stars,
            comment: r.comment
        }));

        const { data, error } = await supabase
            .from('volunteer_reviews')
            .upsert(payloads, { onConflict: 'activity_id,npo_id,volunteer_id' })
            .select();

        if (error) throw error;

        eventEmitter.emit(SyncEvents.SYNC_REVIEWS); // Re-using sync logic for simplicity

        return data.map((r: any) => ({
            id: r.id,
            activityId: r.activity_id,
            npoId: r.npo_id,
            volunteerId: r.volunteer_id,
            isPresent: r.is_present,
            stars: r.stars,
            comment: r.comment,
            date: r.created_at
        }));
    }

    async getLatestActivity(): Promise<AppActivity | null> {
        try {
            const { data, error } = await supabase
                .from('activities')
                .select(`
                    *,
                    profiles:npo_id (npo_name, full_name, public_email, email),
                    activity_skills (skill),
                    activity_participants (user_id)
                `)
                .eq('status', 'APERTA')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error) {
                console.error("Error fetching latest activity:", error);
                return null;
            }

            return this._mapDbActivityToApp(data);
        } catch (error) {
            console.error("Error in getLatestActivity:", error);
            return null;
        }
    }

    async refreshActivityStates(): Promise<AppActivity[]> {
        try {
            // Call the RPC defined via migration to handle updates with SECURITY DEFINER
            // Bypasses RLS issues where Volunteers couldn't update NPO activities.
            const { data: actuallyUpdated, error: rpcError } = await supabase.rpc('update_expired_activities');

            if (rpcError) {
                console.error("RPC Error updating activities:", rpcError);
            }

            const toComplete = actuallyUpdated || [];
            const updatedIds = toComplete.map((r: any) => r.updated_id) || [];

            if (updatedIds.length > 0) {
                // NOTIFY enrolled volunteers
                const { data: participants } = await supabase
                    .from('activity_participants')
                    .select('user_id, activity_id')
                    .in('activity_id', updatedIds)
                    .in('status', ['APPROVED', 'REGISTERED']);

                if (participants && participants.length > 0) {
                    const notifications = participants.map((p: any) => {
                        const act = toComplete.find((a: any) => a.id === p.activity_id);
                        return {
                            user_id: p.user_id,
                            type: 'ACTIVITY_COMPLETED',
                            title: 'Missione Compiuta! 🎉',
                            message: `L'attività "${act?.title || 'Attività'}" è terminata. Grazie per il tuo contributo! Controlla il tuo profilo per i punti XP.`,
                            related_activity_id: p.activity_id,
                            read: false
                        };
                    });

                    const { error: notifError } = await supabase
                        .from('notifications')
                        .insert(notifications);

                    if (notifError) console.error("Error sending completion notifications:", notifError);
                }
            }

            // 3. Emit sync
            eventEmitter.emit(SyncEvents.SYNC_ACTIVITIES);

            const { activities } = await this.getActivities({ limit: 100 });
            return activities;
        } catch (error) {
            console.error("Refresh states failed", error);
            return [];
        }
    }
}

export const activityService = new ActivityService();

