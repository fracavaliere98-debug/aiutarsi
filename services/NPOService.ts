import { OldUser, OldApplication } from '../types';
import { eventEmitter, SyncEvents } from '../utils/EventEmitter';
import { supabase } from '../utils/supabase';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class NPOService {

    // Helper to map Profile to OldUser
    private _mapProfileToUser(profile: any): OldUser {
        return {
            id: profile.id,
            email: profile.email || '',
            role: profile.role,
            name: profile.full_name || 'Utente',
            avatar: profile.avatar_url || 'https://i.pravatar.cc/150?img=11',
            impactPoints: profile.impact_points || 0,
            skills: profile.user_skills?.map((s: any) => s.skill) || [],
            interests: profile.user_interests?.map((i: any) => i.interest) || [],
            npoName: profile.npo_name,
            companyName: profile.company_name,
            isVerified: profile.is_verified,
            locationString: profile.location_string,
            locationCoords: {
                lat: profile.location_lat || 0,
                lng: profile.location_lng || 0
            },
            bio: profile.bio,
            phone: profile.phone,
            website: profile.website,
            publicEmail: profile.public_email,
            profileCompleted: profile.profile_completed,
            followedNPOs: profile.followed_entities?.map((f: any) => f.npo_id) || []
        };
    }

    // Helper map OldApplication
    private _mapDbAppToLocalApp(dbApp: any): OldApplication {
        return {
            id: dbApp.id,
            npoId: dbApp.npo_id,
            npoName: dbApp.npo?.npo_name || 'NPO',
            volunteerId: dbApp.volunteer_id,
            volunteerName: dbApp.volunteer?.full_name || 'Volontario',
            volunteerAvatar: dbApp.volunteer?.avatar_url || '',
            message: dbApp.message,
            skills: dbApp.volunteer?.user_skills?.map((s: any) => s.skill) || [],
            status: dbApp.status,
            appliedDate: dbApp.created_at,
        };
    }

    async getNPOProfile(npoId: string): Promise<OldUser | null> {
        const { data, error } = await supabase
            .from('profiles')
            .select(`
                *,
                user_skills (skill),
                user_interests (interest)
            `)
            .eq('id', npoId)
            .eq('role', 'NPO')
            .single();

        if (error || !data) return null;
        return this._mapProfileToUser(data);
    }

    async followNPO(npoId: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('npo_followers')
            .insert({
                npo_id: npoId,
                follower_id: userId
            });

        if (error) {
            if (error.code === '23505') return; // Already following
            throw error;
        }
        eventEmitter.emit(SyncEvents.SYNC_USERS); // Profile update (followedNPOs list changed conceptually)
    }

    async unfollowNPO(npoId: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('npo_followers')
            .delete()
            .eq('npo_id', npoId)
            .eq('follower_id', userId);

        if (error) throw error;
        eventEmitter.emit(SyncEvents.SYNC_USERS);
    }

    async isFollowing(npoId: string, userId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('npo_followers')
            .select('*')
            .eq('npo_id', npoId)
            .eq('follower_id', userId)
            .maybeSingle();

        return !!data;
    }

    // --- Applications ---

    async submitApplication(applicationData: Omit<OldApplication, 'id'>): Promise<OldApplication> {
        const { data, error } = await supabase
            .from('applications')
            .insert({
                npo_id: applicationData.npoId,
                volunteer_id: applicationData.volunteerId,
                message: applicationData.message,
                status: 'PENDING'
            })
            .select()
            .single();

        if (error) throw error;
        eventEmitter.emit(SyncEvents.SYNC_APPLICATIONS);

        return {
            ...applicationData,
            id: data.id,
            appliedDate: data.created_at,
            status: 'PENDING',
            skills: []
        };
    }

    async getApplicationsForNPO(npoId: string): Promise<OldApplication[]> {
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                volunteer:volunteer_id (
                    full_name, 
                    avatar_url,
                    user_skills (skill)
                ),
                npo:npo_id (npo_name)
            `)
            .eq('npo_id', npoId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching applications:", error);
            return [];
        }

        return data.map(this._mapDbAppToLocalApp);
    }

    async getApplicationsForVolunteer(volunteerId: string): Promise<OldApplication[]> {
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                volunteer:volunteer_id (full_name, avatar_url),
                npo:npo_id (npo_name)
            `)
            .eq('volunteer_id', volunteerId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching applications:", error);
            return [];
        }

        return data.map(this._mapDbAppToLocalApp);
    }

    async updateApplicationStatus(appId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
        const { error } = await supabase
            .from('applications')
            .update({ status })
            .eq('id', appId);

        if (error) throw error;
        eventEmitter.emit(SyncEvents.SYNC_APPLICATIONS);
    }
}

export const npoService = new NPOService();
