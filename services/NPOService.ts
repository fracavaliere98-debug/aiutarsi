import { AppUser, OldApplication, SharedContact } from '../types';
import { eventEmitter, SyncEvents } from '../utils/EventEmitter';
import { authService } from './AuthService';
import { profileRest } from '../utils/profileRest';
import { supabase } from '../utils/supabase';
import { withTimeout } from '../utils/withTimeout';

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
            // Senza foto resta vuoto: UserAvatar mostra le iniziali (prima c'era la foto finta di un servizio esterno).
            avatar: profile.avatar_url || '',
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
            followedNPOs: profile.followed_entities?.map((f: any) => f.npo_id) || [],
            lastSeenAt: profile.last_seen_at,
            impactPoints: profile.impact_points || 0,
            badges: profile.badges || [],
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

    async followNPO(npoId: string, userId: string): Promise<void> {
        const { error } = await withTimeout(
            supabase
                .from('npo_followers')
                .insert({
                    npo_id: npoId,
                    follower_id: userId
                }),
            'npo.follow',
            8000
        );

        if (error) {
            if (error.code === '23505') return; // Already following
            throw error;
        }
    }

    async unfollowNPO(npoId: string, userId: string): Promise<void> {
        const { error } = await withTimeout(
            supabase
                .from('npo_followers')
                .delete()
                .eq('npo_id', npoId)
                .eq('follower_id', userId),
            'npo.unfollow',
            8000
        );

        if (error) throw error;
    }

    async isFollowing(npoId: string, userId: string): Promise<boolean> {
        const { data } = await withTimeout(
            supabase
                .from('npo_followers')
                .select('*')
                .eq('npo_id', npoId)
                .eq('follower_id', userId)
                .maybeSingle(),
            'npo.isFollowing',
            8000
        );

        return !!data;
    }

    async getFollowers(npoId: string): Promise<AppUser[]> {
        const { data, error } = await withTimeout(
            supabase
                .from('npo_followers')
                // Colonne esplicite: dopo A26/A22 il ruolo authenticated legge solo alcune colonne di
                // profiles e `*` fallisce con 42501 (permission denied). Servono solo i campi mostrati
                // nelle liste follower (nome, foto, ultimo accesso) e quelli usati da Smart Match.
                .select(`
                    follower:follower_id (
                        id, role, full_name, avatar_url, last_seen_at,
                        user_skills (skill),
                        user_interests (interest)
                    )
                `)
                .eq('npo_id', npoId),
            'npo.getFollowers',
            8000
        );

        if (error) {
            console.error("Error fetching NPO followers:", error);
            return [];
        }

        // Il server restituisce follower = null quando il profilo non e' visibile a questo ente
        // (es. utente bannato, A37): quella riga si scarta, senza far fallire tutta la lista.
        return (data || [])
            .filter((d: any) => d?.follower?.id)
            .map((d: any) => this._mapProfileToUser(d.follower));
    }

    // --- Applications ---

    async submitApplication(applicationData: Omit<OldApplication, 'id'>): Promise<OldApplication> {
        const accessToken = await this._getAccessToken();
        const rows = await profileRest.submitApplication({
                npo_id: applicationData.npoId,
                volunteer_id: applicationData.volunteerId,
                message: applicationData.message,
                status: 'PENDING',
                email: applicationData.email || null,
                phone: applicationData.phone || null,
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

    /**
     * Contatti (email, telefono, messaggio) che i volontari hanno scelto di condividere con questo ente,
     * da iscrizioni e candidature. Li restituisce solo il server, all'ente verificato destinatario, e
     * non li restituisce se l'iscrizione e' annullata o rifiutata / la candidatura e' rifiutata.
     */
    async getSharedContacts(): Promise<SharedContact[]> {
        // Niente catch che restituisce []: se la lettura fallisce l'errore arriva alla query e la schermata
        // lo mostra, invece di far credere all'ente che nessuno abbia condiviso un contatto.
        const accessToken = await this._getAccessToken();
        const rows = await profileRest.listSharedContacts({}, accessToken);
        return (rows || []).map((row: any): SharedContact => ({
            source: row.source,
            refId: row.ref_id,
            activityId: row.activity_id || undefined,
            volunteerId: row.volunteer_id,
            volunteerName: row.full_name || undefined,
            volunteerAvatar: row.avatar_url || undefined,
            status: row.status,
            email: row.email || undefined,
            phone: row.phone || undefined,
            message: row.message || undefined,
            sharedAt: row.shared_at,
        }));
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

    /**
     * Invito NPO → volontario. Testo e destinatario sono validati lato server (RPC
     * send_npo_invite): il client sceglie solo il tipo di invito.
     * Ritorna true se inviato, false se già invitato (per un invito mirato: per sempre; altri tipi: ultime 24h)
     * o se c'è un blocco. Un 6° invito mirato alla stessa attività lancia INVITE_LIMIT_REACHED.
     */
    async sendInvite(
        volunteerId: string,
        kind: 'OPEN_ACTIVITIES' | 'APPLY' | 'ACTIVITY',
        activityId?: string
    ): Promise<boolean> {
        const { data, error } = await withTimeout(
            supabase.rpc('send_npo_invite', {
                p_volunteer_id: volunteerId,
                p_kind: kind,
                p_activity_id: activityId ?? null,
            }),
            'npo.sendInvite',
            8000
        );
        if (error) throw error;
        return data === true;
    }

    /**
     * Inviti mirati già mandati da questo ente (tabella npo_activity_invites, l'RLS restituisce solo
     * le righe dell'ente loggato). Serve a mostrare "Già invitato" e il contatore 0/5 per attività.
     */
    async getMyActivityInvites(): Promise<{ activityId: string; volunteerId: string }[]> {
        const { data, error } = await withTimeout(
            supabase.from('npo_activity_invites').select('activity_id, volunteer_id'),
            'npo.getMyActivityInvites',
            8000
        );
        if (error) throw error;
        return (data ?? []).map((row: any) => ({ activityId: row.activity_id, volunteerId: row.volunteer_id }));
    }

    /**
     * Volontari consigliati per una attività (RPC get_suggested_volunteers_for_activity): solo
     * id, nome, foto e punteggio di compatibilità, nessun altro dato del profilo.
     */
    async getSuggestedVolunteers(activityId: string): Promise<SuggestedVolunteer[]> {
        const { data, error } = await withTimeout(
            supabase.rpc('get_suggested_volunteers_for_activity', { p_activity_id: activityId, p_limit: 10 }),
            'npo.getSuggestedVolunteers',
            8000
        );
        if (error) throw error;
        return (data ?? []).map((row: any) => ({
            id: row.volunteer_id,
            name: row.full_name || 'Volontario',
            avatar: row.avatar_url ?? undefined,
            score: row.score === null || row.score === undefined ? null : Number(row.score),
            alreadyInvited: !!row.already_invited,
        }));
    }
}

export interface SuggestedVolunteer {
    id: string;
    name: string;
    avatar?: string;
    /** Compatibilità 0..1 (null se manca il vettore). */
    score: number | null;
    alreadyInvited: boolean;
}

/** Il server rifiuta il 6° invito mirato a una stessa attività (send_npo_invite). */
export const MAX_ACTIVITY_INVITES = 5;
export function isInviteLimitError(error: unknown): boolean {
    const message = (error as any)?.message;
    return typeof message === 'string' && message.includes('INVITE_LIMIT_REACHED');
}

export const npoService = new NPOService();
