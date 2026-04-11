import { AppUser, OldApplication } from '../types';
import { eventEmitter, SyncEvents } from '../utils/EventEmitter';
import { authService } from './AuthService';
import { profileRest } from '../utils/profileRest';
import { supabase } from '../utils/supabase';

export class NPOService {
    private async _getAccessToken(): Promise<string> {
        const cached = authService.getCachedAccessToken();
        if (cached) return cached;

        const { data } = await Promise.race([
            supabase.auth.getSession(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('auth.getSession timeout after 1500ms')), 1500))
        ]) as any;

        const token = data?.session?.access_token;
        if (!token) {
            throw new Error('Sessione assente o token utente non disponibile');
        }
        authService.setCachedAccessToken(token);
        return token;
    }

    // Helper to map Profile rows to the current app user shape.
    private _mapProfileToUser(profile: any): AppUser {
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
            public_email: profile.public_email,
            profile_completed: profile.profile_completed || false,
            followedNPOs: profile.followed_entities?.map((f: any) => f.npo_id) || []
        } as AppUser;
    }

    // Helper map OldApplication
    private _mapDbAppToLocalApp(dbApp: any): OldApplication {
        const npo = Array.isArray(dbApp.npo) ? dbApp.npo[0] : dbApp.npo;
        const volunteer = Array.isArray(dbApp.volunteer) ? dbApp.volunteer[0] : dbApp.volunteer;

        return {
            id: dbApp.id,
            npoId: dbApp.npo_id,
            npoName: npo?.npo_name || npo?.full_name || 'NPO',
            npoAvatar: npo?.avatar_url || '',
            volunteerId: dbApp.volunteer_id,
            volunteerName: volunteer?.full_name || 'Volontario',
            volunteerAvatar: volunteer?.avatar_url || '',
            message: dbApp.message,
            skills: volunteer?.user_skills?.map((s: any) => s.skill) || [],
            status: dbApp.status,
            appliedDate: dbApp.created_at,
            reviewedDate: dbApp.reviewed_at || undefined,
        };
    }

    async getNPOProfile(npoId: string): Promise<AppUser | null> {
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
    }

    async unfollowNPO(npoId: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('npo_followers')
            .delete()
            .eq('npo_id', npoId)
            .eq('follower_id', userId);

        if (error) throw error;
    }

    async isFollowing(npoId: string, userId: string): Promise<boolean> {
        const { data } = await supabase
            .from('npo_followers')
            .select('*')
            .eq('npo_id', npoId)
            .eq('follower_id', userId)
            .maybeSingle();

        return !!data;
    }

    async getFollowers(npoId: string): Promise<AppUser[]> {
        const { data, error } = await supabase
            .from('npo_followers')
            .select(`
                follower:follower_id (
                    *,
                    user_skills (skill),
                    user_interests (interest)
                )
            `)
            .eq('npo_id', npoId);

        if (error) {
            console.error("Error fetching NPO followers:", error);
            return [];
        }

        return data.map((d: any) => this._mapProfileToUser(d.follower));
    }

    // --- Applications ---

    async submitApplication(applicationData: Omit<OldApplication, 'id'>): Promise<OldApplication> {
        const accessToken = await this._getAccessToken();
        const rows = await profileRest.submitApplication({
                npo_id: applicationData.npoId,
                volunteer_id: applicationData.volunteerId,
                message: applicationData.message,
                status: 'PENDING'
            },
            accessToken
        );
        eventEmitter.emit(SyncEvents.SYNC_APPLICATIONS);

        const created = rows?.[0];
        if (created) {
            return this._mapDbAppToLocalApp(created);
        }

        return {
            id: `${applicationData.npoId}_${applicationData.volunteerId}_${Date.now()}`,
            ...applicationData,
            appliedDate: applicationData.appliedDate || new Date().toISOString(),
            status: 'PENDING',
            skills: applicationData.skills || []
        };
    }

    async getApplicationsForNPO(npoId: string): Promise<OldApplication[]> {
        try {
            const accessToken = await this._getAccessToken();
            const data = await profileRest.listApplicationsForNPO(npoId, accessToken);
            return data.map((app) => this._mapDbAppToLocalApp(app));
        } catch (error) {
            console.error("Error fetching applications:", error);
            return [];
        }
    }

    async getApplicationsForVolunteer(volunteerId: string): Promise<OldApplication[]> {
        try {
            const accessToken = await this._getAccessToken();
            const data = await profileRest.listApplicationsForVolunteer(volunteerId, accessToken);
            return data.map((app) => this._mapDbAppToLocalApp(app));
        } catch (error) {
            console.error("Error fetching applications:", error);
            return [];
        }
    }

    async updateApplicationStatus(appId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
        const accessToken = await this._getAccessToken();
        await profileRest.updateApplicationStatus(
            appId,
            {
                status,
                reviewed_at: new Date().toISOString(),
            },
            accessToken
        );
        eventEmitter.emit(SyncEvents.SYNC_APPLICATIONS);
    }
}

export const npoService = new NPOService();
