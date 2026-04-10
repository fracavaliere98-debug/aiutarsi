import { AppUser } from '../types';
import { supabase } from '../utils/supabase';
import { profileRest } from '../utils/profileRest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageService } from './StorageService';
import { getAuthScheme, getSupabaseProjectRef, isPreviewRuntime } from '../utils/runtimeConfig';
import { getPasswordRequirementsText, isPasswordStrongEnough } from '../utils/passwordValidation';

export type EmailConfirmationState = {
    exists: boolean;
    confirmed: boolean;
    role?: string | null;
};

export class AuthService {
    private _cachedAccessToken: string | null = null;
    private readonly PENDING_EMAIL_CHANGE_KEY = '@pending_email_change';
    private _isProductionSupabaseProject(): boolean {
        return getSupabaseProjectRef() === "ibyjkqowokxrlormkwzw";
    }

    private _getAuthEmailRedirectUrl(): string {
        if (this._isProductionSupabaseProject()) {
            return "https://aiutarsi.vercel.app/auth/confirm";
        }
        if (isPreviewRuntime()) {
            return `${getAuthScheme()}://confirm-email`;
        }
        return 'aiutarsiapp://confirm-email';
    }

    private _getPasswordRecoveryRedirectUrl(): string {
        if (this._isProductionSupabaseProject()) {
            return "https://aiutarsi.vercel.app/auth/reset-password";
        }
        if (isPreviewRuntime()) {
            return `${getAuthScheme()}://reset-password`;
        }
        return 'aiutarsiapp://reset-password';
    }

    setCachedAccessToken(token: string | null | undefined): void {
        this._cachedAccessToken = token || null;
    }

    getCachedAccessToken(): string | null {
        return this._cachedAccessToken;
    }

    private async _withTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs = 8000): Promise<T> {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        try {
            return await Promise.race([
                promise,
                new Promise<T>((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
                }),
            ]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    private async _awaitQuery<T>(promise: PromiseLike<T>, label: string): Promise<T> {
        try {
            return await promise;
        } catch (error: any) {
            throw new Error(`${label} failed: ${this._formatErrorDetails(error)}`);
        }
    }

    private _formatErrorDetails(error: any): string {
        if (!error) return 'unknown error';

        const parts = [
            error.message || String(error),
            error.code ? `code=${error.code}` : null,
            error.details ? `details=${error.details}` : null,
            error.hint ? `hint=${error.hint}` : null,
            error.status ? `status=${error.status}` : null,
        ].filter(Boolean);

        return parts.join(' | ');
    }

    private async _ensureProfileRow(
        userId: string,
        accessToken: string,
        seed?: Partial<AppUser>
    ): Promise<void> {
        const payload: Record<string, unknown> = {
            id: userId,
            updated_at: new Date().toISOString(),
        };

        const role = seed?.role || (await this.loadUserLocally())?.role || 'VOLUNTEER';
        if (role) payload.role = role;
        if (seed?.email) payload.email = seed.email;
        if (seed?.full_name || seed?.name) payload.full_name = seed.full_name || seed.name;
        if ((seed as any)?.npo_name || seed?.npoName) payload.npo_name = (seed as any)?.npo_name || seed?.npoName;
        if ((seed as any)?.company_name || seed?.companyName) payload.company_name = (seed as any)?.company_name || seed?.companyName;

        await this._withTimeout(
            profileRest.ensureVolunteerProfile(payload, accessToken),
            'profiles.ensure.rest',
            8000
        );
    }

    private async _getAccessTokenForRest(): Promise<string> {
        if (this._cachedAccessToken) {
            return this._cachedAccessToken;
        }

        const { data: sessionData } = await this._withTimeout(
            supabase.auth.getSession(),
            'auth.getSession',
            1500
        );
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
            throw new Error('Sessione assente o token utente non disponibile');
        }
        this._cachedAccessToken = accessToken;
        return accessToken;
    }

    private async _buildUpdatedUserFallback(
        userId: string,
        finalUpdates: Partial<AppUser>,
        profileRow?: any,
        skills?: string[],
        interests?: string[]
    ): Promise<AppUser> {
        const cachedUser = await this.loadUserLocally();
        const baseUser = (cachedUser && cachedUser.id === userId ? cachedUser : null)
            || this._mapSupabaseUserToAppUser((await supabase.auth.getSession()).data.session?.user)
            || ({ id: userId } as AppUser);

        const merged: AppUser = {
            ...baseUser,
            ...(profileRow ? this._mapProfileToUser(profileRow) : {}),
            ...finalUpdates,
            id: userId,
        };

        if ((finalUpdates as any).full_name !== undefined || (finalUpdates as any).name !== undefined) {
            merged.full_name = ((finalUpdates as any).full_name ?? (finalUpdates as any).name) as string;
            merged.name = merged.full_name;
        }

        if ((finalUpdates as any).avatar_url !== undefined || (finalUpdates as any).avatar !== undefined) {
            merged.avatar_url = ((finalUpdates as any).avatar_url ?? (finalUpdates as any).avatar) as string;
            merged.avatar = merged.avatar_url;
        }

        if ((finalUpdates as any).public_email !== undefined || (finalUpdates as any).publicEmail !== undefined) {
            merged.public_email = ((finalUpdates as any).public_email ?? (finalUpdates as any).publicEmail) as string;
            merged.publicEmail = merged.public_email;
        }

        if ((finalUpdates as any).location_string !== undefined || (finalUpdates as any).locationString !== undefined) {
            merged.location_string = ((finalUpdates as any).location_string ?? (finalUpdates as any).locationString) as string;
            merged.locationString = merged.location_string;
        }

        if (skills !== undefined) {
            merged.skills = skills;
            merged.user_skills = skills.map((skill) => ({ id: '', skill, user_id: null }));
        }

        if (interests !== undefined) {
            merged.interests = interests;
            merged.user_interests = interests.map((interest) => ({ id: '', interest, user_id: null }));
        }

        merged.updated_at = new Date().toISOString();
        return merged;
    }

    private _isTimeoutError(error: any, label?: string): boolean {
        const message = this._formatErrorDetails(error).toLowerCase();
        return message.includes('timeout');
    }

    private _validateEmail(email: string): boolean {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }

    private _validatePassword(password: string): boolean {
        return isPasswordStrongEnough(password);
    }

    // Identifies errors that cannot be solved by retrying (e.g. invalid session/token)
    isUnrecoverableAuthError(error: any): boolean {
        if (!error) return false;
        const msg = (error.message || "").toLowerCase();
        return (
            msg.includes("refresh token not found") ||
            msg.includes("invalid refresh token") ||
            msg.includes("refresh_token_not_found") ||
            msg.includes("session_not_found") ||
            msg.includes("user_not_found")
        );
    }

    // Helper to map Supabase User (with metadata) to our AppUser type
    private _mapSupabaseUserToAppUser(sbUser: any): AppUser | null {
        if (!sbUser) return null;

        const metadata = sbUser.user_metadata || {};

        return {
            id: sbUser.id,
            email: sbUser.email || '',
            role: metadata.role || 'VOLUNTEER',
            full_name: metadata.full_name || metadata.name || metadata.displayName || metadata.npo_name || 'Utente',
            avatar_url: metadata.avatar || metadata.avatar_url,
            impact_points: metadata.impactPoints || metadata.impact_points || 0,
            // Legacy mapping
            name: metadata.full_name || metadata.name || metadata.displayName || metadata.npo_name || 'Utente',
            avatar: metadata.avatar || metadata.avatar_url,
            impactPoints: metadata.impactPoints || metadata.impact_points || 0,
            npoName: metadata.npoName || metadata.npo_name,
            companyName: metadata.companyName || metadata.company_name,
            skills: metadata.skills || [],
            interests: metadata.interests || [],
            followedNPOs: metadata.followedNPOs || [],
            user_skills: (metadata.skills || []).map((s: string) => ({ skill: s })),
            user_interests: (metadata.interests || []).map((i: string) => ({ interest: i })),
            followed_entities: (metadata.followedNPOs || []).map((id: string) => ({ npo_id: id })),
            npo_name: metadata.npoName || metadata.npo_name,
            company_name: metadata.companyName || metadata.company_name,
            is_verified: (metadata.verification_status === 'verified' || metadata.is_verified || metadata.isVerified) === true,
            verification_status: metadata.verification_status || (metadata.is_verified || metadata.isVerified ? 'verified' : 'none'),
            location_string: metadata.locationString || metadata.location_string,
            location_lat: metadata.locationCoords?.lat || metadata.location_lat,
            location_lng: metadata.locationCoords?.lng || metadata.location_lng,
            bio: metadata.bio,
            phone: metadata.phone,
            website: metadata.website,
            public_email: metadata.publicEmail || metadata.public_email,
            gender: metadata.gender,
            date_of_birth: metadata.date_of_birth,
            email_confirmed: metadata.email_confirmed,
            profile_completed: metadata.profile_completed || metadata.profileCompleted || false,
            // Legacy aliases
            publicEmail: metadata.publicEmail || metadata.public_email,
            lastSeenAt: metadata.lastSeenAt || metadata.last_seen_at,
            createdAt: sbUser.created_at,
            created_at: sbUser.created_at,
            updated_at: sbUser.updated_at || new Date().toISOString(),
            // Non-schema fields for types compatibility
            embedding: metadata.embedding,
            allow_calls: metadata.allow_calls,
            expo_push_token: metadata.expo_push_token,
            last_seen_at: metadata.last_seen_at,
            location_coords: metadata.location_coords,
            profile_public: metadata.profile_public,
            show_email: metadata.show_email,
            show_volunteering_history: metadata.show_volunteering_history,
            volunteer_list_visible: metadata.volunteer_list_visible,
            badges: metadata.badges || [],
            xp: metadata.impactPoints || metadata.impact_points || 0,
            deletionRequestedAt: metadata.deletionRequestedAt || metadata.deletion_requested_at || null,
            deletion_requested_at: metadata.deletionRequestedAt || metadata.deletion_requested_at || null,
            shortId: metadata.shortId || metadata.id?.substring(0, 8).toUpperCase(),
            is_banned: metadata.is_banned,
            ban_reason: metadata.ban_reason,
            ban_report_id: metadata.ban_report_id,
            referral_code: metadata.referral_code,
            referred_by: metadata.referred_by,
            // NPO Fields
            npo_vat_id: metadata.npo_vat_id,
            npo_website: metadata.npo_website,
            referent_name: metadata.referent_name,
            referent_role: metadata.referent_role,
            referent_avatar_url: metadata.referent_avatar_url,
            auto_welcome_message: metadata.auto_welcome_message,
            address_full: metadata.address_full,
            sought_skills: metadata.sought_skills,
            verification_doc_url: metadata.verification_doc_url,
        };
    }

    // LOCAL STORAGE PERSISTENCE (Hybrid Mode)
    private readonly STORAGE_KEY = "@auth_user_data";

    async init(): Promise<void> {
        // One-time cleanup of legacy keys
        try {
            const keysToCheck = ['ALL_USERS', 'NPO_APPLICATIONS'];
            const keys = await AsyncStorage.getAllKeys();
            const keysToRemove = keys.filter(k => keysToCheck.includes(k));
            if (keysToRemove.length > 0) {
                await AsyncStorage.multiRemove(keysToRemove);
            }
        } catch (e) {
            console.warn("Error clearing legacy storage", e);
        }

        // SELF-HEALING: Ensure profile exists for any existing session
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                await this.ensureProfileExists(session.user.id);
            }
        } catch (e) {
            console.warn("Self-healing check failed on init", e);
        }
    }

    async saveUserLocally(user: AppUser): Promise<void> {
        try {
            await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
        } catch (e) {
            console.error("Failed to save user locally", e);
        }
    }

    async loadUserLocally(): Promise<AppUser | null> {
        try {
            const json = await AsyncStorage.getItem(this.STORAGE_KEY);
            return json ? JSON.parse(json) : null;
        } catch (e) {
            console.error("Failed to load user locally", e);
            return null;
        }
    }

    async clearLocalUser(): Promise<void> {
        try {
            await AsyncStorage.removeItem(this.STORAGE_KEY);
        } catch (e) {
            console.error("Failed to clear local user", e);
        }
    }

    async login(email: string, password: string): Promise<AppUser> {
        const cleanEmail = email.trim();
        if (!this._validateEmail(cleanEmail)) {
            throw new Error("Formato email non valido.");
        }
        if (!password) {
            throw new Error("Inserisci la password.");
        }

        // Create a timeout promise with cleanup
        let timeoutId: any;
        const timeout = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error("Richiesta scaduta. Controlla la tua connessione internet.")), 15000);
        });

        // Race between login and timeout
        const loginPromise = supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
        });

        let data, error;
        try {
            const result: any = await Promise.race([loginPromise, timeout]);
            clearTimeout(timeoutId);
            data = result.data;
            error = result.error;
        } catch (e: any) {
            clearTimeout(timeoutId);
            throw new Error(e.message || "Errore di connessione.");
        }

        if (error) {
            if (error.message.includes("Invalid login credentials")) {
                const confirmationState = await this.getEmailConfirmationState(cleanEmail);
                if (confirmationState.exists && !confirmationState.confirmed) {
                    const confirmationRequiredError = new Error("EMAIL_CONFIRMATION_REQUIRED");
                    (confirmationRequiredError as any).code = "EMAIL_CONFIRMATION_REQUIRED";
                    (confirmationRequiredError as any).email = cleanEmail;
                    (confirmationRequiredError as any).role = confirmationState.role || undefined;
                    throw confirmationRequiredError;
                }
            }

            const msg = error.message.includes("Invalid login credentials")
                ? "Credenziali errate. Controlla email e password."
                : error.message;
            throw new Error(msg);
        }

        const user = this._mapSupabaseUserToAppUser(data.user);
        if (!user) throw new Error("Utente non trovato dopo il login");

        // SELF-HEALING: Ensure profile exists in public.profiles
        await this.ensureProfileExists(user.id);

        // FORCE SYNC FROM DB
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profile) {
                if (!profile.full_name && user.full_name) {
                    profile.full_name = user.full_name;
                    try {
                        await supabase
                            .from('profiles')
                            .update({ full_name: user.full_name, updated_at: new Date().toISOString() })
                            .eq('id', user.id)
                            .is('full_name', null);
                        console.log("[DEBUG] AuthService: Login - Backfilled missing full_name from auth metadata");
                    } catch (backfillError) {
                        console.warn("Login full_name backfill failed", backfillError);
                    }
                }
                const dbUser = this._mapProfileToUser(profile);
                // Trust the public profile row as source of truth after sync triggers have run.
                Object.assign(user, dbUser, { email: dbUser.email || user.email });
                console.log("[DEBUG] AuthService: Login - Profile merged from DB");
            }
        } catch (e) {
            console.warn("Login profile fetch failed", e);
        }

        // Sync to local storage for persistence
        await this.saveUserLocally(user);

        return user;
    }

    async register(userData: Omit<AppUser, 'id'>): Promise<{ user: AppUser; hasSession: boolean; requiresEmailConfirmation: boolean }> {
        if (!userData.email) {
            throw new Error("L'email è obbligatoria.");
        }
        const cleanEmail = userData.email.trim();
        // Validation
        if (!this._validateEmail(cleanEmail)) {
            throw new Error("Formato email non valido.");
        }
        if (!userData.password || !this._validatePassword(userData.password)) {
            throw new Error(getPasswordRequirementsText());
        }

        // Prepare metadata (everything except email/password)
        const { email, password, ...metadata } = userData;

        // Create a timeout promise with cleanup
        let timeoutId: any;
        const timeout = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error("Registrazione scaduta. Controlla la connessione.")), 30000);
        });

        const signUpPromise = supabase.auth.signUp({
            email: cleanEmail,
            password: password!,
            options: {
                emailRedirectTo: this._getAuthEmailRedirectUrl(),
                data: {
                    ...metadata,
                    name: (metadata as any).full_name || (metadata as any).name,
                    impact_points: (metadata as any).impact_points || 0,
                    skills: (metadata as any).skills || [],
                    interests: (metadata as any).interests || [],
                    followedNPOs: []
                },
            },
        });

        let data, error;
        try {
            const result: any = await Promise.race([signUpPromise, timeout]);
            clearTimeout(timeoutId);
            data = result.data;
            error = result.error;
        } catch (e: any) {
            clearTimeout(timeoutId);
            throw new Error(e.message || "Errore di connessione.");
        }

        if (error) {
            console.error("Supabase Register Error:", error.message);
            // Map common technical errors to user-friendly Italian messages
            let msg = error.message;
            if (msg.includes("Unable to validate email address") || msg.includes("invalid format")) {
                msg = "Indirizzo email non valido. Controlla il formato.";
            } else if (msg.includes("User already registered") || msg.includes("already exists")) {
                msg = "Questo indirizzo email è già registrato.";
            }
            throw new Error(msg);
        }

        if (!data.user) throw new Error("Registrazione fallita: nessun utente restituito");

        const identities = Array.isArray((data.user as any).identities) ? (data.user as any).identities : null;
        if (!data.session && identities && identities.length === 0) {
            throw new Error("Questo indirizzo email è già registrato.");
        }

        const hasSession = !!data.session;
        let requiresEmailConfirmation = false;

        // When signup returns a user but no session, email confirmation is required.
        // Do not attempt an automatic sign-in here: that creates a false technical error
        // path in environments where email confirmation is intentionally enabled.
        if (!data.session) {
            requiresEmailConfirmation = true;
            console.log("[DEBUG] AuthService: signup completed without session, email confirmation required");
        }

        console.log("[DEBUG] AuthService: register success");
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("[DEBUG] AuthService: session after register:", sessionData.session?.user?.id ? "Exists" : "Missing");

        const user = this._mapSupabaseUserToAppUser(data.user);

        return {
            user: user!,
            hasSession,
            requiresEmailConfirmation,
        };
    }

    async logout(): Promise<void> {
        console.log("[DEBUG] AuthService: Nuclear logout started");

        try {
            // 1. TENTA IL LOGOUT LOCALE IMMEDIATO (Priorità assoluta)
            // 'local' non parla col server, pulisce solo l'SDK. È quasi istantaneo.
            await supabase.auth.signOut({ scope: 'local' });
            console.log("[DEBUG] AuthService: Local SDK SignOut completed");

            // 2. FIRE AND FORGET GLOBAL SIGNOUT
            // Lo lanciamo ma non mettiamo 'await'. Se il server risponde bene, altrimenti pace.
            supabase.auth.signOut({ scope: 'global' }).catch(() => { });

        } catch (e: any) {
            console.warn("[DEBUG] Local SDK SignOut failed, proceeding to manual wipe:", e.message);
        }

        // 3. PULIZIA MANUALE NUCLEARE (Storage)
        try {
            const keys = await AsyncStorage.getAllKeys();
            const supabaseProjectRef = getSupabaseProjectRef();

            const keysToRemove = keys.filter(key =>
                key.includes('supabase') ||
                (supabaseProjectRef ? key.includes(supabaseProjectRef) : false) ||
                key.includes('auth-token') ||
                key === this.STORAGE_KEY
            );

            if (keysToRemove.length > 0) {
                await AsyncStorage.multiRemove(keysToRemove);
                console.log("[DEBUG] AuthService: Storage keys wiped:", keysToRemove);
            }
        } catch (e) {
            console.error("Critical storage cleanup failure", e);
        }
    }

    // Helper: Map public profile to AppUser
    private _mapProfileToUser(profile: any): AppUser {
        const derivedDisplayName =
            profile.full_name ||
            profile.npo_name ||
            profile.company_name ||
            profile.name ||
            'Utente';

        return {
            ...profile, // Direct spread of schema-compliant fields including user_skills, user_interests, etc.
            full_name: profile.full_name || null,
            name: derivedDisplayName,
            avatar: profile.avatar_url,
            impactPoints: profile.impact_points || 0,
            npoName: profile.npo_name || profile.full_name,
            companyName: profile.company_name,
            skills: profile.user_skills?.map((s: any) => s.skill) || [],
            interests: profile.user_interests?.map((i: any) => i.interest) || [],
            followedNPOs: profile.followed_entities?.map((f: any) => f.npo_id) || [],
            locationCoords: profile.location_coords,
            // Legacy aliases for UI/Navigation
            profile_completed: profile.profile_completed || false,
            isVerified: profile.is_verified,
            publicEmail: profile.public_email,
            gender: profile.gender,
            date_of_birth: profile.date_of_birth,
            email_confirmed: profile.email_confirmed,
            lastSeenAt: profile.last_seen_at,
            createdAt: profile.created_at,
            badges: profile.badges || [],
            xp: profile.impact_points || 0,
            deletion_requested_at: profile.deletion_requested_at,
            referral_code: profile.referral_code,
            referred_by: profile.referred_by,
            shortId: profile.id?.substring(0, 8).toUpperCase(),
            ban_report_id: profile.ban_report_id,
            // NPO Fields
            npo_vat_id: profile.npo_vat_id,
            npo_website: profile.npo_website,
            referent_name: profile.referent_name,
            referent_role: profile.referent_role,
            referent_avatar_url: profile.referent_avatar_url,
            auto_welcome_message: profile.auto_welcome_message,
            address_full: profile.address_full,
            sought_skills: profile.sought_skills,
            verification_doc_url: profile.verification_doc_url,
        };
    }

    // NOTE: Fetches public profiles with pagination.
    async getUsers(page = 0, pageSize = 20, role?: string): Promise<AppUser[]> {
        try {
            let query = supabase
                .from('profiles')
                .select(`
                    *,
                    user_skills (skill),
                    user_interests (interest),
                    followed_entities:npo_followers!npo_followers_follower_id_fkey (npo_id)
                `)
                .order('full_name')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (role) {
                query = query.eq('role', role);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching users:", error);
                return [];
            }

            return data.map(p => this._mapProfileToUser(p));
        } catch (e) {
            console.error("Exception fetching users", e);
            return [];
        }
    }

    // Deprecated: Avoid using this in production for large datasets.
    async getAllUsers(): Promise<AppUser[]> {
        return this.getUsers(0, 1000);
    }

    async getProfileById(userId: string): Promise<AppUser | null> {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    *,
                    user_skills (skill),
                    user_interests (interest),
                    followed_entities:npo_followers!npo_followers_follower_id_fkey (npo_id)
                `)
                .eq('id', userId)
                .single();

            if (error) {
                if (error.code !== 'PGRST116') { // Not found is fine
                    console.error("Error fetching profile by ID:", error);
                }
                return null;
            }

            return this._mapProfileToUser(data);
        } catch (e) {
            console.error("Exception fetching profile by ID", e);
            return null;
        }
    }

    async getBlockedUsers(userId: string): Promise<Array<{
        id: string;
        blocked_id: string;
        profile: {
            id: string;
            full_name?: string | null;
            npo_name?: string | null;
            avatar_url?: string | null;
            role?: string | null;
        } | null;
    }>> {
        try {
            console.log("[DEBUG] AuthService: getBlockedUsers start", userId);
            const accessToken = await this._getAccessTokenForRest();
            const rows = await this._withTimeout(
                profileRest.listBlockedUsers(userId, accessToken),
                'blocked_users.list.rest',
                8000
            );

            if (!rows.length) {
                console.log("[DEBUG] AuthService: getBlockedUsers done 0");
                return [];
            }

            const profiles = await this._withTimeout(
                profileRest.getBasicProfiles(rows.map((row) => row.blocked_id), accessToken),
                'profiles.blocked.getBasic.rest',
                8000
            );

            const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
            const result = rows.map((row) => ({
                id: row.id,
                blocked_id: row.blocked_id,
                profile: profileMap.get(row.blocked_id) || null,
            }));

            console.log("[DEBUG] AuthService: getBlockedUsers done", result.length);
            return result;
        } catch (error) {
            console.error("Error fetching blocked users:", error);
            return [];
        }
    }

    async getTotalVolunteersCount(): Promise<number> {
        try {
            const { count, error } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'VOLUNTEER');

            if (error) {
                console.error("Error counting volunteers:", error);
                return 0;
            }
            return count || 0;
        } catch (e) {
            console.error("Exception counting volunteers", e);
            return 0;
        }
    }

    async getCurrentUser(): Promise<AppUser | null> {
        // 1. Check Session (Basic Auth)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;

        let user: AppUser | null = null;

        // 2. FETCH PROFILE FROM DB (Primary Source of Truth)
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select(`
                    *,
                    user_skills (skill),
                    user_interests (interest),
                    followed_entities:npo_followers!npo_followers_follower_id_fkey (npo_id)
                `)
                .eq('id', session.user.id)
                .single();

            if (profile && !error) {
                console.log("[DEBUG] AuthService: Loaded profile from DB");
                user = this._mapProfileToUser(profile);
                user.email = user.email || session.user.email || '';

                if (!user.referral_code) {
                    const ensuredCode = await this.ensureReferralCodeExists(session.user.id);
                    if (ensuredCode) {
                        user.referral_code = ensuredCode;
                    }
                }
            }
        } catch (e) {
            console.warn("[DEBUG] Profile DB fetch failed:", e);
        }

        // 3. Fallback to Session Metadata if DB fails
        if (!user) {
            console.warn("[DEBUG] AuthService: Fallback to session metadata");
            user = this._mapSupabaseUserToAppUser(session.user);
        }

        // 4. Persistence Check: If we got a fresh user from DB, we should update local storage
        if (user) {
            await this.saveUserLocally(user);
        }

        return user;
    }

    async ensureReferralCodeExists(userId: string): Promise<string | null> {
        const fallbackCode = userId.substring(0, 8).toUpperCase();

        try {
            const accessToken = await this._getAccessTokenForRest();
            await this._withTimeout(
                profileRest.updateVolunteerProfile(userId, { referral_code: fallbackCode }, accessToken),
                'profiles.referral_code.ensure',
                5000
            );
            console.log("[DEBUG] AuthService: ensured referral_code", fallbackCode);
            return fallbackCode;
        } catch (error) {
            console.warn("[DEBUG] AuthService: failed ensuring referral_code", this._formatErrorDetails(error));
            return null;
        }
    }

    async updateProfile(userId: string, updates: Partial<AppUser>): Promise<AppUser> {
        const startedAt = Date.now();
        let failedStage = 'initialization';
        let restProfileRow: any = null;
        const currentStoredUser = await this.loadUserLocally();
        console.log("[DEBUG] AuthService: updateProfile (DB-First) started for", userId, updates);

        // 1. Handle Avatar Upload first
        // Add resilience: check both 'avatar' and 'avatar_url'
        const avatarToUpload = updates.avatar_url || (updates as any).avatar;
        if (avatarToUpload && (avatarToUpload.startsWith('file://') || avatarToUpload.startsWith('content://') || avatarToUpload.startsWith('data:'))) {
            try {
                console.log("[DEBUG] AuthService: Uploading new avatar...");
                const uploadedUrl = await storageService.uploadAvatar(userId, avatarToUpload);
                if (uploadedUrl) {
                    updates.avatar_url = uploadedUrl;
                    // Also update legacy key if present to avoid confusion
                    if ((updates as any).avatar) (updates as any).avatar = uploadedUrl;
                }
            } catch (uploadError: any) {
                console.error("[DEBUG] Avatar upload FAILED:", uploadError);
                throw new Error("Errore caricamento immagine: " + uploadError.message);
            }
        }

        // 2. Prepare Payload for 'profiles' table
        // We filter the updates to only include fields present in the 'profiles' Table definition
        const profileTableFields = [
            'full_name', 'avatar_url', 'bio', 'npo_name', 'company_name',
            'phone', 'website', 'location_string', 'location_lat', 'location_lng',
            'public_email', 'gender', 'date_of_birth', 'profile_completed', 'impact_points', 'is_verified',
            'profile_public', 'show_email', 'show_volunteering_history', 'volunteer_list_visible',
            'allow_calls', 'expo_push_token', 'deletion_requested_at',
            'npo_vat_id', 'npo_website', 'referent_name', 'referent_role', 'referent_avatar_url',
            'auto_welcome_message', 'address_full', 'sought_skills', 'verification_doc_url',
            'verification_status'
        ];

        const payload: any = {};

        // Add resilience: Map legacy camelCase keys to snake_case DB columns
        const legacyMapping: Record<string, string> = {
            'publicEmail': 'public_email',
            'avatar': 'avatar_url',
            'name': 'full_name',
            'locationString': 'location_string'
        };

        const finalUpdates = { ...updates };
        Object.entries(legacyMapping).forEach(([legacy, standard]) => {
            if ((updates as any)[legacy] !== undefined && (updates as any)[standard] === undefined) {
                (finalUpdates as any)[standard] = (updates as any)[legacy];
            }
        });

        // Map updates to DB columns, stripping non-schema fields
        Object.keys(finalUpdates).forEach(key => {
            if (profileTableFields.includes(key) && (finalUpdates as any)[key] !== undefined) {
                payload[key] = (finalUpdates as any)[key];
            }
        });

        const shouldUpdateProfileRow = Object.keys(payload).length > 0;
        if (shouldUpdateProfileRow) {
            payload.updated_at = new Date().toISOString();
        }

        const rawSkillsToSync = (updates as any).skills || (updates as any).user_skills?.map((s: any) => s.skill);
        const rawInterestsToSync = (updates as any).interests || (updates as any).user_interests?.map((i: any) => i.interest);
        const skillsToSync = rawSkillsToSync ? Array.from(new Set(rawSkillsToSync)) : rawSkillsToSync;
        const interestsToSync = rawInterestsToSync ? Array.from(new Set(rawInterestsToSync)) : rawInterestsToSync;

        try {
            console.log("[DEBUG] AuthService: updateProfile payload prepared", payload);
            const accessToken = await this._getAccessTokenForRest();

            if (shouldUpdateProfileRow || skillsToSync !== undefined || interestsToSync !== undefined) {
                failedStage = 'profiles.ensure';
                await this._ensureProfileRow(userId, accessToken, {
                    ...(finalUpdates as Partial<AppUser>),
                    id: userId,
                    email: (finalUpdates as Partial<AppUser>).email || currentStoredUser?.email,
                    role: (finalUpdates as Partial<AppUser>).role || currentStoredUser?.role,
                });
            }

            // 3. Perform Update to Public Profiles
            if (shouldUpdateProfileRow) {
                failedStage = 'profiles.update';
                try {
                    const result = await this._withTimeout(
                        profileRest.updateVolunteerProfile(userId, payload, accessToken),
                        'profiles.update.rest',
                        10000
                    );
                    restProfileRow = Array.isArray(result) ? result[0] : result;
                    console.log("[DEBUG] AuthService: profiles.update REST completed");
                } catch (restError: any) {
                    if (this._isTimeoutError(restError, 'profiles.update.rest')) {
                        console.warn("[DEBUG] AuthService: profiles.update REST timed out, proceeding optimistically", {
                            userId,
                            payloadKeys: Object.keys(payload),
                            error: this._formatErrorDetails(restError),
                        });
                    } else {
                    console.error("[DEBUG] AuthService: profiles.update REST failed", {
                        userId,
                        payloadKeys: Object.keys(payload),
                        error: this._formatErrorDetails(restError),
                    });
                    throw new Error(`profiles.update rejected: ${this._formatErrorDetails(restError)}`);
                    }
                }
                console.log("[DEBUG] AuthService: profiles.update completed in", Date.now() - startedAt, "ms");
            } else {
                console.log("[DEBUG] AuthService: profiles.update skipped - no profile columns changed");
            }

            // 4. Sync Relationals (Skills/Interests)
            if (skillsToSync !== undefined) {
                console.log("[DEBUG] AuthService: syncing user_skills", skillsToSync);
                failedStage = 'user_skills.sync';
                try {
                    await this._withTimeout(
                        profileRest.replaceVolunteerSkills(userId, skillsToSync, accessToken),
                        'user_skills.replace.rest',
                        10000
                    );
                } catch (skillsError: any) {
                    if (this._isTimeoutError(skillsError, 'user_skills.replace.rest')) {
                        console.warn("[DEBUG] AuthService: user_skills REST timed out, proceeding optimistically", {
                            userId,
                            error: this._formatErrorDetails(skillsError),
                        });
                    } else {
                        throw skillsError;
                    }
                }
            }
            if (interestsToSync !== undefined) {
                console.log("[DEBUG] AuthService: syncing user_interests", interestsToSync);
                failedStage = 'user_interests.sync';
                try {
                    await this._withTimeout(
                        profileRest.replaceVolunteerInterests(userId, interestsToSync, accessToken),
                        'user_interests.replace.rest',
                        10000
                    );
                } catch (interestsError: any) {
                    if (this._isTimeoutError(interestsError, 'user_interests.replace.rest')) {
                        console.warn("[DEBUG] AuthService: user_interests REST timed out, proceeding optimistically", {
                            userId,
                            error: this._formatErrorDetails(interestsError),
                        });
                    } else {
                        throw interestsError;
                    }
                }
            }

            const optimisticUser = await this._buildUpdatedUserFallback(
                userId,
                finalUpdates as Partial<AppUser>,
                restProfileRow,
                skillsToSync,
                interestsToSync
            );

            failedStage = 'saveUserLocally.afterUpdate';
            await this.saveUserLocally(optimisticUser);
            console.log("[DEBUG] AuthService: optimistic profile saved locally");

            failedStage = 'auth.metadata.sync';
            void this._withTimeout(
                this._syncAuthMetadata(finalUpdates as Partial<AppUser>, skillsToSync, interestsToSync),
                'auth.metadata.sync',
                2000
            ).then(() => {
                console.log("[DEBUG] AuthService: auth metadata sync completed");
            }).catch((metadataError) => {
                console.warn("[DEBUG] AuthService: auth metadata sync skipped/fail", this._formatErrorDetails(metadataError));
            });

            // Background reconciliation only. It must never block the user save flow.
            failedStage = 'getCurrentUser.afterUpdate';
            void this._withTimeout(
                this._awaitQuery(this.getCurrentUser(), 'getCurrentUser.afterUpdate'),
                'getCurrentUser.afterUpdate',
                5000
            ).then((freshUser) => {
                if (freshUser) {
                    void this.saveUserLocally(freshUser);
                    console.log("[DEBUG] AuthService: background rehydrate completed");
                }
            }).catch((rehydrateError) => {
                if (this._isTimeoutError(rehydrateError, 'getCurrentUser.afterUpdate')) {
                    console.log("[DEBUG] AuthService: background rehydrate skipped timeout");
                } else {
                    console.warn("[DEBUG] AuthService: background rehydrate skipped/fail", this._formatErrorDetails(rehydrateError));
                }
            });

            console.log("[DEBUG] AuthService: updateProfile finished in", Date.now() - startedAt, "ms");

            return optimisticUser;

        } catch (e: any) {
            console.error("Update Profile Failed:", {
                userId,
                failedStage,
                message: e?.message,
                details: this._formatErrorDetails(e),
            });
            throw new Error(`Errore salvataggio profilo [${failedStage}]: ${this._formatErrorDetails(e)}`);
        }
    }

    async updateLastSeen(userId: string): Promise<void> {
        try {
            await supabase
                .from('profiles')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', userId);
        } catch (e) {
            console.warn("Failed to update last seen", e);
        }
    }

    async updateEmail(newEmail: string): Promise<void> {
        const cleanEmail = newEmail.trim().toLowerCase();
        if (!this._validateEmail(cleanEmail)) throw new Error("Email non valida.");

        const { data: sessionData } = await this._withTimeout(
            supabase.auth.getSession(),
            'auth.getSession.beforeEmailUpdate',
            3000
        );
        const currentEmail = sessionData.session?.user.email?.trim().toLowerCase() || '';

        if (currentEmail && currentEmail === cleanEmail) {
            throw new Error("Stai già usando questo indirizzo email.");
        }

        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
            throw new Error("Sessione assente. Effettua di nuovo l'accesso.");
        }

        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
        const redirectTo = this._getAuthEmailRedirectUrl();
        const requestUrl = `${supabaseUrl}/auth/v1/user?${new URLSearchParams({ redirect_to: redirectTo }).toString()}`;

        const response = await this._withTimeout(
            fetch(requestUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: supabaseAnonKey,
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ email: cleanEmail }),
            }),
            'auth.updateUser.email.fetch',
            10000
        );

        if (!response.ok) {
            let rawMessage = 'Errore durante l’aggiornamento email.';
            try {
                const payload = await response.json();
                rawMessage = payload?.msg || payload?.message || payload?.error_description || payload?.error || rawMessage;
            } catch {}

            const message = rawMessage.toLowerCase();
            if (
                message.includes('already registered')
                || message.includes('already been registered')
                || message.includes('already exists')
                || message.includes('email address already in use')
                || message.includes('email exists')
            ) {
                throw new Error("Questo indirizzo email è già utilizzato. Usa un'altra email.");
            }
            throw new Error(rawMessage);
        }

        try {
            await AsyncStorage.setItem(this.PENDING_EMAIL_CHANGE_KEY, cleanEmail);
        } catch (storageError) {
            console.warn("[DEBUG] AuthService: failed to persist pending email change", storageError);
        }
    }

    async getPendingEmailChange(): Promise<string | null> {
        try {
            return await AsyncStorage.getItem(this.PENDING_EMAIL_CHANGE_KEY);
        } catch (error) {
            console.warn("[DEBUG] AuthService: failed reading pending email change", error);
            return null;
        }
    }

    async clearPendingEmailChange(): Promise<void> {
        try {
            await AsyncStorage.removeItem(this.PENDING_EMAIL_CHANGE_KEY);
        } catch (error) {
            console.warn("[DEBUG] AuthService: failed clearing pending email change", error);
        }
    }

    // Password update remains same (Auth only)
    async updatePassword(oldPassword: string, newPassword: string): Promise<void> {
        if (!this._validatePassword(newPassword)) throw new Error(getPasswordRequirementsText());

        const { data: sessionData } = await supabase.auth.getSession();
        const email = sessionData.session?.user.email?.trim().toLowerCase();
        const accessToken = sessionData.session?.access_token;
        if (!email || !accessToken) {
            throw new Error("Sessione assente. Effettua di nuovo l'accesso.");
        }

        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

        const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: supabaseAnonKey,
            },
            body: JSON.stringify({
                email,
                password: oldPassword,
            }),
        });

        if (!verifyResponse.ok) {
            throw new Error("Password attuale non corretta.");
        }

        const updateResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ password: newPassword }),
        });

        if (!updateResponse.ok) {
            let rawMessage = 'Errore aggiornamento password.';
            try {
                const payload = await updateResponse.json();
                rawMessage = payload?.msg || payload?.message || payload?.error_description || payload?.error || rawMessage;
            } catch {}

            throw new Error(rawMessage);
        }
    }

    async resendSignupConfirmation(email: string): Promise<void> {
        const cleanEmail = email.trim();
        if (!cleanEmail) throw new Error("Email non disponibile.");

        console.log("[DEBUG] AuthService: resend signup confirmation start", {
            emailDomain: cleanEmail.split("@")[1] || "unknown",
            redirectTo: this._getAuthEmailRedirectUrl(),
        });

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: cleanEmail,
            options: {
                emailRedirectTo: this._getAuthEmailRedirectUrl(),
            },
        });

        if (error) {
            let msg = error.message || 'Invio email fallito.';
            if (msg.toLowerCase().includes('rate limit')) {
                msg = 'Hai già richiesto una mail di conferma da poco. Riprova tra qualche minuto.';
            }
            console.warn("[DEBUG] AuthService: resend signup confirmation failed", msg);
            throw new Error(msg);
        }

        console.log("[DEBUG] AuthService: resend signup confirmation accepted");
    }

    async getEmailConfirmationState(email: string): Promise<EmailConfirmationState> {
        const cleanEmail = email.trim();
        if (!cleanEmail) throw new Error("Email non disponibile.");

        const { data, error } = await this._withTimeout(
            supabase.functions.invoke("auth-confirmation-status", {
                body: { email: cleanEmail },
            }),
            'functions.auth-confirmation-status',
            3000
        );

        if (error) {
            throw new Error(error.message || "Non siamo riusciti a verificare lo stato della conferma.");
        }

        return {
            exists: data?.exists === true,
            confirmed: data?.confirmed === true,
            role: typeof data?.role === "string" ? data.role : null,
        };
    }

    async checkEmailConfirmationStatus(email: string): Promise<boolean> {
        const state = await this.getEmailConfirmationState(email);
        return state.confirmed;
    }

    async requestPasswordReset(email: string): Promise<void> {
        const cleanEmail = email.trim();
        if (!cleanEmail) throw new Error("Inserisci la tua email.");
        if (!this._validateEmail(cleanEmail)) throw new Error("Formato email non valido.");

        console.log("[DEBUG] AuthService: password reset start", {
            emailDomain: cleanEmail.split("@")[1] || "unknown",
            redirectTo: this._getPasswordRecoveryRedirectUrl(),
        });

        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: this._getPasswordRecoveryRedirectUrl(),
        });

        if (error) {
            let msg = error.message || "Invio email di reset fallito.";
            if (msg.toLowerCase().includes("rate limit")) {
                msg = "Hai già richiesto un reset da poco. Riprova tra qualche minuto.";
            }
            throw new Error(msg);
        }

        console.log("[DEBUG] AuthService: password reset accepted");
    }

    async completePasswordRecovery(newPassword: string): Promise<void> {
        if (!this._validatePassword(newPassword)) {
            throw new Error(getPasswordRequirementsText());
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session?.user) {
            throw new Error("Sessione di recupero non disponibile. Apri il link della mail su questo dispositivo.");
        }

        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            throw new Error(error.message || "Non siamo riusciti ad aggiornare la password.");
        }
    }

    // SELF-HEALING: Ensure a record exists in public.profiles for a given user ID
    // This handles cases where the server-side trigger might have failed or been bypassed
    async ensureProfileExists(userId: string): Promise<void> {
        try {
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('id', userId)
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (!profile) {
                console.log(`[AuthService] Profile missing for ${userId}, attempting self-healing...`);
                const { data: { user } } = await supabase.auth.getUser(); // Must use getUser for security

                if (user && user.id === userId) {
                    const metadata = user.user_metadata || {};
                    const { error: insertError } = await supabase
                        .from('profiles')
                        .insert({
                            id: userId,
                            email: user.email,
                            full_name: metadata.full_name || metadata.name || metadata.displayName || 'Utente',
                            avatar_url: metadata.avatar_url || metadata.avatar,
                            role: (metadata.role || 'VOLUNTEER').toUpperCase(),
                            npo_name: metadata.npoName,
                            company_name: metadata.companyName,
                            profile_completed: metadata.profile_completed || metadata.profileCompleted || false
                        });

                    if (insertError) {
                        console.error("[AuthService] Self-healing failed:", insertError.message);
                    } else {
                        console.log("[AuthService] Self-healing successful: Created missing profile");
                    }
                }
            } else if (!profile.full_name) {
                const { data: { user } } = await supabase.auth.getUser();

                if (user && user.id === userId) {
                    const metadata = user.user_metadata || {};
                    const fallbackFullName = metadata.full_name || metadata.name || metadata.displayName || null;
                    if (fallbackFullName) {
                        const { error: patchError } = await supabase
                            .from('profiles')
                            .update({
                                full_name: fallbackFullName,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', userId)
                            .is('full_name', null);

                        if (patchError) {
                            console.error("[AuthService] Missing full_name backfill failed:", patchError.message);
                        } else {
                            console.log("[AuthService] Backfilled missing full_name from auth metadata");
                        }
                    }
                }
            }
        } catch (e) {
            console.error("[AuthService] Error in ensureProfileExists:", e);
        }
    }

    // Helper: Sync relational lists (skills, interests) with diff logic
    private async _syncRelationalList(userId: string, table: string, column: string, rawList: string[]): Promise<void> {
        try {
            console.log(`[DEBUG] AuthService: _syncRelationalList start ${table}`, rawList);
            // 0. Deduplicate Input (Critical for Unique Constraints)
            const newList = Array.from(new Set(rawList)).filter(item => item && item.trim().length > 0);

            // 1. Fetch current
            const { data: currentData, error: fetchError } = await this._awaitQuery(
                supabase
                    .from(table)
                    .select(column)
                    .eq('user_id', userId),
                `${table}.select`
            );

            if (fetchError) {
                console.error(`[AuthService] Fetch failed for ${table}:`, fetchError);
                throw new Error(`${table}.select rejected: ${this._formatErrorDetails(fetchError)}`);
            }

            const currentList = currentData?.map((row: any) => row[column]) || [];

            // 2. Calculate Diff
            const toAdd = newList.filter(item => !currentList.includes(item));
            const toRemove = currentList.filter(item => !newList.includes(item));

            console.log(`[AuthService] Syncing ${table} for ${userId}. Current: ${currentList.length}, New: ${newList.length}. Add: ${toAdd.length}, Remove: ${toRemove.length}`);

            // 3. Remove
            if (toRemove.length > 0) {
                const { error: deleteError } = await this._awaitQuery(
                    supabase
                        .from(table)
                        .delete()
                        .eq('user_id', userId)
                        .in(column, toRemove),
                    `${table}.delete`
                );

                if (deleteError) {
                    console.error(`[AuthService] Delete failed for ${table}:`, deleteError);
                    throw new Error(`${table}.delete rejected: ${this._formatErrorDetails(deleteError)}`);
                }
            }

            // 4. Add
            if (toAdd.length > 0) {
                const insertions = toAdd.map(item => ({ user_id: userId, [column]: item }));
                // Use default insert. Since we filtered against currentList locally, 
                // we shouldn't hit duplicates UNLESS race condition.
                // But to be super safe, we could use upsert (ignoreDuplicates).
                // However, standard insert is fine if logic is sound. We will log error if it happens.
                const { error: insertError } = await this._awaitQuery(
                    supabase
                        .from(table)
                        .insert(insertions),
                    `${table}.insert`
                );

                if (insertError) {
                    console.error(`[AuthService] Insert failed for ${table}:`, insertError);
                    // If unique violation (23505), it means we raced or logic failed. 
                    // We shouldn't throw to avoid killing the whole profile update, but we should know.
                    // For now, let's throw to be loud.
                    throw new Error(`${table}.insert rejected: ${this._formatErrorDetails(insertError)}`);
                }
            }
            console.log(`[DEBUG] AuthService: _syncRelationalList done ${table}`);
        } catch (e) {
            console.error(`Error syncing ${table}:`, {
                userId,
                table,
                column,
                details: this._formatErrorDetails(e),
            });
            // We swallow the error here to allow the main profile update to succeed? 
            // Phase 33 requirement says "Fix persistence". If this fails, persistence fails.
            // So we should probably NOT swallow it if we want to debug.
            // But if we throw, the user sees an error toast.
            throw e;
        }
    }

    private async _syncAuthMetadata(updates: Partial<AppUser>, skills?: string[], interests?: string[]): Promise<void> {
        const metadata: Record<string, unknown> = {};
        const metadataFields = [
            'full_name', 'avatar_url', 'bio', 'npo_name', 'company_name',
            'phone', 'website', 'location_string', 'location_lat', 'location_lng',
            'public_email', 'gender', 'date_of_birth', 'profile_completed', 'impact_points', 'is_verified',
            'profile_public', 'show_email', 'show_volunteering_history', 'volunteer_list_visible',
            'allow_calls', 'expo_push_token', 'deletion_requested_at',
            'npo_vat_id', 'npo_website', 'referent_name', 'referent_role', 'referent_avatar_url',
            'auto_welcome_message', 'address_full', 'sought_skills', 'verification_doc_url',
            'verification_status', 'referral_code', 'referred_by',
        ] as const;

        for (const field of metadataFields) {
            if ((updates as any)[field] !== undefined) {
                metadata[field] = (updates as any)[field];
            }
        }

        if ((updates as any).name !== undefined && metadata.full_name === undefined) {
            metadata.full_name = (updates as any).name;
        }
        if ((updates as any).avatar !== undefined && metadata.avatar_url === undefined) {
            metadata.avatar_url = (updates as any).avatar;
        }
        if ((updates as any).locationString !== undefined && metadata.location_string === undefined) {
            metadata.location_string = (updates as any).locationString;
        }

        if (metadata.full_name !== undefined) metadata.name = metadata.full_name;
        if (metadata.avatar_url !== undefined) metadata.avatar = metadata.avatar_url;
        if (metadata.location_string !== undefined) metadata.locationString = metadata.location_string;
        if (metadata.public_email !== undefined) metadata.publicEmail = metadata.public_email;
        if (metadata.npo_name !== undefined) metadata.npoName = metadata.npo_name;
        if (metadata.company_name !== undefined) metadata.companyName = metadata.company_name;
        if (metadata.impact_points !== undefined) metadata.impactPoints = metadata.impact_points;
        if (metadata.deletion_requested_at !== undefined) metadata.deletionRequestedAt = metadata.deletion_requested_at;
        if (metadata.profile_completed !== undefined) metadata.profileCompleted = metadata.profile_completed;

        if (metadata.location_lat !== undefined || metadata.location_lng !== undefined) {
            metadata.locationCoords = {
                lat: Number(metadata.location_lat ?? 0),
                lng: Number(metadata.location_lng ?? 0),
            };
        }

        if (skills !== undefined) metadata.skills = skills;
        if (interests !== undefined) metadata.interests = interests;

        if (Object.keys(metadata).length === 0) {
            return;
        }

        const { error } = await supabase.auth.updateUser({ data: metadata });
        if (error) throw error;
    }

    /**
     * Submits a verification request for an NPO
     */
    async submitVerificationRequest(userId: string, npoDetails: any): Promise<boolean> {
        try {
            const { data: existingPending, error: existingError } = await supabase
                .from('verification_requests')
                .select('id')
                .eq('user_id', userId)
                .eq('status', 'pending')
                .limit(1);

            if (existingError) throw existingError;
            if (existingPending && existingPending.length > 0) {
                throw new Error("Hai gia una richiesta di verifica in revisione.");
            }

            const { error } = await supabase
                .from('verification_requests')
                .insert({
                    user_id: userId,
                    npo_details: npoDetails,
                    status: 'pending'
                });

            if (error) throw error;

            // Also update the profile status to pending
            await this.updateProfile(userId, { verification_status: 'pending' });

            return true;
        } catch (error) {
            console.error("Error submitting verification request:", error);
            throw error;
        }
    }

    /**
     * Get the count of users referred by a specific user
     */
    async getReferralCount(userId: string): Promise<number> {
        try {
            console.log("[DEBUG] AuthService: getReferralCount start", userId);
            const accessToken = await this._getAccessTokenForRest();
            const count = await this._withTimeout(
                profileRest.countReferrals(userId, accessToken),
                'profiles.referralCount.rest',
                8000
            );
            console.log("[DEBUG] AuthService: getReferralCount done", count || 0);
            return count || 0;
        } catch (error) {
            console.error("Error fetching referral count:", error);
            return 0;
        }
    }

    /**
     * Resolve a referral code to a user ID
     */
    async resolveReferralCode(code: string): Promise<string | null> {
        try {
            const accessToken = await this._getAccessTokenForRest();
            return await this._withTimeout(
                profileRest.resolveReferralCode(code, accessToken),
                'profiles.resolveReferralCode.rest',
                8000
            );
        } catch {
            return null;
        }
    }
}

export const authService = new AuthService();
