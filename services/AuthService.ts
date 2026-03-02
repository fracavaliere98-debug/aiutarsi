import { User } from '../types';
import { eventEmitter, SyncEvents } from '../utils/EventEmitter';
import { supabase } from '../utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageService } from './StorageService';

export class AuthService {

    private _validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

    // Helper to map Supabase User (with metadata) to our App User interface
    private _mapSupabaseUserToAppUser(sbUser: any): User | null {
        if (!sbUser) return null;

        const metadata = sbUser.user_metadata || {};

        return {
            id: sbUser.id,
            email: sbUser.email || '',
            role: metadata.role || 'VOLUNTEER',
            name: metadata.name || 'Utente',
            avatar: metadata.avatar,
            impactPoints: metadata.impactPoints || 0,
            skills: metadata.skills || [],
            interests: metadata.interests || [],
            // Optional fields
            npoName: metadata.npoName,
            companyName: metadata.companyName,
            isVerified: metadata.isVerified,
            locationCoords: metadata.locationCoords,
            locationString: metadata.locationString,
            followedNPOs: metadata.followedNPOs || [],
            bio: metadata.bio,
            phone: metadata.phone,
            website: metadata.website,
            publicEmail: metadata.publicEmail,
            profileCompleted: metadata.profileCompleted,
            createdAt: sbUser.created_at
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

    async saveUserLocally(user: User): Promise<void> {
        try {
            await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
        } catch (e) {
            console.error("Failed to save user locally", e);
        }
    }

    async loadUserLocally(): Promise<User | null> {
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

    async login(email: string, password: string): Promise<User> {
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
                Object.assign(user, dbUser, { email: user.email, role: user.role });
                console.log("[DEBUG] AuthService: Login - Profile merged from DB");
            }
        } catch (e) {
            console.warn("Login profile fetch failed", e);
        }

        // Sync to local storage for persistence
        await this.saveUserLocally(user);

        return user;
    }

    async register(userData: Omit<User, 'id'>): Promise<User> {
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
                    impactPoints: metadata.impactPoints || 0,
                    skills: metadata.skills || [],
                    interests: metadata.interests || [],
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
            throw new Error(error.message);
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

        // Notify subscribers
        eventEmitter.emit(SyncEvents.SYNC_USERS);

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

    // Helper: Map public profile to App User
    private _mapProfileToUser(profile: any): User {
        return {
            id: profile.id,
            email: profile.email || '',
            role: profile.role || 'VOLUNTEER',
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
            followedNPOs: profile.followed_entities?.map((f: any) => f.npo_id) || [],
            lastSeenAt: profile.last_seen_at,
            embedding: profile.embedding
        };
    }

    // NOTE: Fetches all public profiles. 
    // In a large app, this should be paginated or searched on demand.
    async getAllUsers(): Promise<User[]> {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    *,
                    user_skills (skill),
                    user_interests (interest),
                    followed_entities:npo_followers!npo_followers_follower_id_fkey (npo_id)
                `)
                .order('full_name');

            if (error) {
                console.error("Error fetching all users:", error);
                return [];
            }

            const realUsers = data.map(p => this._mapProfileToUser(p));
            if (realUsers.length === 0) return [];

            return realUsers;
        } catch (e) {
            console.error("Exception fetching all users", e);
            return [];
        }
    }

    async getCurrentUser(): Promise<User | null> {
        // 1. Check Session (Basic Auth)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;

        let user: User | null = null;

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

                // Ensure email/role are synced from session if missing in DB (unlikely)
                user.email = session.user.email || user.email;
                user.role = this._mapSupabaseUserToAppUser(session.user)?.role || user.role;
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

    async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
        console.log("[DEBUG] AuthService: updateProfile (DB-First) started for", userId);

        // 1. Handle Avatar Upload first
        if (updates.avatar && (updates.avatar.startsWith('file://') || updates.avatar.startsWith('content://') || updates.avatar.startsWith('data:'))) {
            try {
                console.log("[DEBUG] AuthService: Uploading new avatar...");
                const uploadedUrl = await storageService.uploadAvatar(userId, updates.avatar);
                if (uploadedUrl) {
                    updates.avatar = uploadedUrl;
                }
            } catch (uploadError: any) {
                console.error("[DEBUG] Avatar upload FAILED:", uploadError);
                throw new Error("Errore caricamento immagine: " + uploadError.message);
            }
        }

        // 2. Prepare Payload for 'profiles' table
        const payload: any = {
            id: userId,
            updated_at: new Date().toISOString(),
        };

        // Map updates to DB columns
        if (updates.name !== undefined) payload.full_name = updates.name;
        if (updates.avatar !== undefined) payload.avatar_url = updates.avatar;
        if (updates.bio !== undefined) payload.bio = updates.bio;
        if (updates.npoName !== undefined) payload.npo_name = updates.npoName;
        if (updates.companyName !== undefined) payload.company_name = updates.companyName;
        if (updates.phone !== undefined) payload.phone = updates.phone;
        if (updates.website !== undefined) payload.website = updates.website;
        if (updates.locationString !== undefined) payload.location_string = updates.locationString;
        if (updates.locationCoords?.lat !== undefined) payload.location_lat = updates.locationCoords.lat;
        if (updates.locationCoords?.lng !== undefined) payload.location_lng = updates.locationCoords.lng;
        if (updates.publicEmail !== undefined) payload.public_email = updates.publicEmail;
        if (updates.profileCompleted !== undefined) payload.profile_completed = updates.profileCompleted;
        // NOTE: We do not update 'role' or 'email' here usually, those are strictly auth-managed or separate flows.

        try {
            // 3. Perform Upsert to Public Profiles
            const { error: profileError } = await supabase
                .from('profiles')
                .update(payload) // Logic was to Use update first? No, lets use upsert to be safe.
                .eq('id', userId);

            // Wait, upsert needs all keys to be safe? 
            // Actually, we want to UPDATE existing fields. 
            // If we use upsert with partial data, it might overwrite other fields with null if we aren't careful?
            // "Upsert" in supabase (postgres) with a primary key match will UPDATE the row. 
            // However, existing columns NOT in the payload will be kept AS IS? 
            // Yes, standard SQL UPDATE behaviour. 
            // But `upsert`... if row exists, it updates. If we provide partial data, does it erase the rest?
            // PostgreSQL ON CONFLICT DO UPDATE SET ... usually updates only specific columns.
            // Supabase client `upsert`: "Performs an UPSERT on the table."
            // If we want to be safe, `update` is better if we assume profile exists (which it should).
            // Let's stick to `update` first. If it fails (row missing), we handle it?

            // Actually, `AuthService` maps everything.
            // Let's try `upsert` with `ignoreDuplicates: false` (default) means it updates.
            // But to be safer with partial updates, `.update().eq()` is the standard way to PATCH.

            const { error: updateError } = await supabase
                .from('profiles')
                .update(payload)
                .eq('id', userId);

            if (updateError) {
                // If update fails, throw
                throw new Error(updateError.message);
            }

            // 4. Sync Relationals (Skills/Interests)
            if (updates.skills !== undefined) {
                await this._syncRelationalList(userId, 'user_skills', 'skill', updates.skills);
            }
            if (updates.interests !== undefined) {
                await this._syncRelationalList(userId, 'user_interests', 'interest', updates.interests);
            }

            // 5. Return fresh user object
            const updatedUser = await this.getCurrentUser(); // Re-fetch to ensure we have the full picture (including relational lists)

            // 6. Persistence Fix: Force local storage sync
            if (updatedUser) {
                await this.saveUserLocally(updatedUser);
                console.log("[DEBUG] AuthService: updateProfile - Local storage synced");
            }

            eventEmitter.emit(SyncEvents.SYNC_USERS);
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

    async updateEmail(newEmail: string): Promise<User> {
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
                            full_name: metadata.name || 'Utente',
                            avatar_url: metadata.avatar,
                            role: (metadata.role || 'VOLUNTEER').toUpperCase(),
                            npo_name: metadata.npoName,
                            company_name: metadata.companyName,
                            profile_completed: metadata.profileCompleted || false
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
}

export const authService = new AuthService();
