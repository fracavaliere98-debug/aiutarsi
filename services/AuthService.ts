import { AppUser } from '../types';
import { supabase } from '../utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageService } from './StorageService';

export class AuthService {

    private _validateEmail(email: string): boolean {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }

    private _validatePassword(password: string): boolean {
        return password.length >= 6;
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

        // RESET: Ensure clean slate before attempting login
        // Sometimes the client SDK thinks it has a session even if invalid.
        try {
            // Force local scope signout to clear internal state without network dependency
            await supabase.auth.signOut({ scope: 'local' });
            console.log("[DEBUG] AuthService: Pre-login local cleanup done");
        } catch (e) {
            console.warn("Pre-login cleanup warning:", e);
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
                const dbUser = this._mapProfileToUser(profile);
                // Merge DB profile into user object, keeping the auth email but trusting the profile row for role.
                Object.assign(user, dbUser, { email: user.email });
                console.log("[DEBUG] AuthService: Login - Profile merged from DB");
            }
        } catch (e) {
            console.warn("Login profile fetch failed", e);
        }

        // Sync to local storage for persistence
        await this.saveUserLocally(user);

        return user;
    }

    async register(userData: Omit<AppUser, 'id'>): Promise<AppUser> {
        if (!userData.email) {
            throw new Error("L'email è obbligatoria.");
        }
        const cleanEmail = userData.email.trim();
        // Validation
        if (!this._validateEmail(cleanEmail)) {
            throw new Error("Formato email non valido.");
        }
        if (!userData.password || !this._validatePassword(userData.password)) {
            throw new Error("La password deve essere di almeno 6 caratteri.");
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

        // Since we disabled email confirmation, we should have a session immediately
        // BUT, if for some reason we don't, we must sign in to ensure subsequent calls (updateProfile) work.
        if (!data.session) {
            console.log("Registration successful but no session returned. Attempting auto-login...");
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: password!,
            });
            if (signInError) {
                console.error("Auto-login after registration failed:", signInError.message);
                throw new Error("Registrazione completata, ma login automatico fallito. Riprova ad accedere.");
            }
            console.log("[DEBUG] AuthService: auto-login success");
        }

        console.log("[DEBUG] AuthService: register success");
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("[DEBUG] AuthService: session after register:", sessionData.session?.user?.id ? "Exists" : "Missing");

        const user = this._mapSupabaseUserToAppUser(data.user);

        return user!;
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
            const SUPABASE_PROJECT_ID = 'pavnfiladmnwbptwlwpr'; // ID dal log utente

            const keysToRemove = keys.filter(key =>
                key.includes('supabase') ||
                key.includes(SUPABASE_PROJECT_ID) ||
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
        return {
            ...profile, // Direct spread of schema-compliant fields including user_skills, user_interests, etc.
            name: profile.full_name || profile.npo_name || 'Utente',
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

                // Keep auth email in sync, but trust public.profiles as the source of truth for role.
                user.email = session.user.email || user.email;
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

    async updateProfile(userId: string, updates: Partial<AppUser>): Promise<AppUser> {
        console.log("[DEBUG] AuthService: updateProfile (DB-First) started for", userId);

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
            'public_email', 'profile_completed', 'impact_points', 'is_verified',
            'profile_public', 'show_email', 'show_volunteering_history', 'volunteer_list_visible',
            'allow_calls', 'expo_push_token', 'deletion_requested_at',
            'npo_vat_id', 'npo_website', 'referent_name', 'referent_role', 'referent_avatar_url',
            'auto_welcome_message', 'address_full', 'sought_skills', 'verification_doc_url',
            'verification_status'
        ];

        const payload: any = {
            id: userId,
            updated_at: new Date().toISOString(),
        };

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

        const skillsToSync = (updates as any).skills || (updates as any).user_skills?.map((s: any) => s.skill);
        const interestsToSync = (updates as any).interests || (updates as any).user_interests?.map((i: any) => i.interest);

        try {
            // 3. Perform Update to Public Profiles
            const { error: updateError } = await supabase
                .from('profiles')
                .update(payload)
                .eq('id', userId);

            if (updateError) {
                throw new Error(updateError.message);
            }

            // 4. Sync Relationals (Skills/Interests)
            if (skillsToSync !== undefined) {
                await this._syncRelationalList(userId, 'user_skills', 'skill', skillsToSync);
            }
            if (interestsToSync !== undefined) {
                await this._syncRelationalList(userId, 'user_interests', 'interest', interestsToSync);
            }

            // 5. Return fresh user object
            const updatedUser = await this.getCurrentUser();

            // 6. Persistence Fix: Force local storage sync
            if (updatedUser) {
                await this.saveUserLocally(updatedUser);
                console.log("[DEBUG] AuthService: updateProfile - Local storage synced");
            }

            return updatedUser!;

        } catch (e: any) {
            console.error("Update Profile Failed:", e);
            throw new Error("Errore salvataggio profilo: " + e.message);
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

    async updateEmail(newEmail: string): Promise<AppUser> {
        const cleanEmail = newEmail.trim();
        if (!this._validateEmail(cleanEmail)) throw new Error("Email non valida.");

        const { data, error } = await supabase.auth.updateUser({ email: cleanEmail });
        if (error) throw new Error(error.message);

        // We also update the profile email field for consistency (optional but good)
        await supabase.from('profiles').update({ email: cleanEmail }).eq('id', data.user!.id);

        return (await this.getCurrentUser())!;
    }

    // Password update remains same (Auth only)
    async updatePassword(oldPassword: string, newPassword: string): Promise<void> {
        if (!this._validatePassword(newPassword)) throw new Error("La nuova password deve essere di almeno 6 caratteri.");

        // 1. Verify Old Password (by signing in)
        const { data: sessionData } = await supabase.auth.getSession();
        const email = sessionData.session?.user.email;
        if (!email) throw new Error("Impossibile verificare l'utente.");

        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password: oldPassword
        });

        if (signInError) throw new Error("Password attuale non corretta.");

        // 2. Update Password
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) throw new Error("Errore aggiornamento password: " + updateError.message);
    }

    // SELF-HEALING: Ensure a record exists in public.profiles for a given user ID
    // This handles cases where the server-side trigger might have failed or been bypassed
    async ensureProfileExists(userId: string): Promise<void> {
        try {
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('id')
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
            }
        } catch (e) {
            console.error("[AuthService] Error in ensureProfileExists:", e);
        }
    }

    // Helper: Sync relational lists (skills, interests) with diff logic
    private async _syncRelationalList(userId: string, table: string, column: string, rawList: string[]): Promise<void> {
        try {
            // 0. Deduplicate Input (Critical for Unique Constraints)
            const newList = Array.from(new Set(rawList)).filter(item => item && item.trim().length > 0);

            // 1. Fetch current
            const { data: currentData, error: fetchError } = await supabase
                .from(table)
                .select(column)
                .eq('user_id', userId);

            if (fetchError) {
                console.error(`[AuthService] Fetch failed for ${table}:`, fetchError);
                throw fetchError;
            }

            const currentList = currentData?.map((row: any) => row[column]) || [];

            // 2. Calculate Diff
            const toAdd = newList.filter(item => !currentList.includes(item));
            const toRemove = currentList.filter(item => !newList.includes(item));

            console.log(`[AuthService] Syncing ${table} for ${userId}. Current: ${currentList.length}, New: ${newList.length}. Add: ${toAdd.length}, Remove: ${toRemove.length}`);

            // 3. Remove
            if (toRemove.length > 0) {
                const { error: deleteError } = await supabase
                    .from(table)
                    .delete()
                    .eq('user_id', userId)
                    .in(column, toRemove);

                if (deleteError) {
                    console.error(`[AuthService] Delete failed for ${table}:`, deleteError);
                    throw deleteError;
                }
            }

            // 4. Add
            if (toAdd.length > 0) {
                const insertions = toAdd.map(item => ({ user_id: userId, [column]: item }));
                // Use default insert. Since we filtered against currentList locally, 
                // we shouldn't hit duplicates UNLESS race condition.
                // But to be super safe, we could use upsert (ignoreDuplicates).
                // However, standard insert is fine if logic is sound. We will log error if it happens.
                const { error: insertError } = await supabase
                    .from(table)
                    .insert(insertions);

                if (insertError) {
                    console.error(`[AuthService] Insert failed for ${table}:`, insertError);
                    // If unique violation (23505), it means we raced or logic failed. 
                    // We shouldn't throw to avoid killing the whole profile update, but we should know.
                    // For now, let's throw to be loud.
                    throw insertError;
                }
            }
        } catch (e) {
            console.error(`Error syncing ${table}:`, e);
            // We swallow the error here to allow the main profile update to succeed? 
            // Phase 33 requirement says "Fix persistence". If this fails, persistence fails.
            // So we should probably NOT swallow it if we want to debug.
            // But if we throw, the user sees an error toast.
            throw e;
        }
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
            const { count, error } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('referred_by', userId);

            if (error) throw error;
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
            const { data, error } = await supabase
                .from('profiles')
                .select('id')
                .eq('referral_code', code)
                .single();

            if (error) return null;
            return data.id;
        } catch (error) {
            return null;
        }
    }
}

export const authService = new AuthService();
