import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { Alert, AppState, AppStateStatus } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { AppUser } from "../types";
import { authService } from "../services/AuthService";
import { npoService } from "../services/NPOService";
import { eventEmitter, SyncEvents } from "../utils/EventEmitter";
import { supabase } from "../utils/supabase";
import { profileService } from "../services/ProfileService";

interface AuthContextType {
    user: AppUser | null;
    users: AppUser[];
    usersDB: AppUser[]; 
    login: (email: string, password: string) => Promise<boolean>;
    register: (userData: Partial<AppUser>) => Promise<boolean>;
    logout: () => void;
    isLoaded: boolean;
    isLoading: boolean;
    isLoggingOut: boolean;
    updateUserProfile: (data: Partial<AppUser>) => Promise<boolean>;
    getUserById: (id: string) => AppUser | undefined;
    fetchUserById: (id: string) => Promise<AppUser | null>;
    setUser: (user: AppUser | null) => void;
    resetUsers: () => Promise<void>;
    refreshUsers: (role?: string) => Promise<void>;
    requestAccountDeletion: () => Promise<void>;
    cancelAccountDeletion: () => Promise<void>;
    getReferralCount: () => Promise<number>;
    updateEmail: (newEmail: string) => Promise<boolean>;
    updatePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    users: [],
    usersDB: [],
    login: async () => false,
    register: async () => false,
    logout: () => { },
    isLoaded: false,
    isLoading: false,
    isLoggingOut: false,
    updateUserProfile: async () => false,
    getUserById: () => undefined,
    fetchUserById: async () => null,
    setUser: () => { },
    resetUsers: async () => { },
    refreshUsers: async () => { },
    requestAccountDeletion: async () => { },
    cancelAccountDeletion: async () => { },
    getReferralCount: async () => 0,
    updateEmail: async () => false,
    updatePassword: async () => false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const hasCompletedOnboarding = user?.profile_completed;
    const [isLoading, setIsLoading] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [usersDB, setUsersDB] = useState<AppUser[]>([]);

    // Use ref to track logout intent immediately and synchronously across closures
    const isLoggingOutRef = React.useRef(false);
    const usersRefreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const refreshUsers = useCallback(async (role?: string) => {
        // Fetch only a small page of users initially or based on role
        const relevantUsers = await authService.getUsers(0, role ? 50 : 20, role);
        setUsersDB(prev => {
            const map = new Map(prev.map(u => [u.id, u]));
            relevantUsers.forEach(u => map.set(u.id, u));
            return Array.from(map.values());
        });
    }, []);

    const scheduleUsersRefresh = useCallback((delayMs = 1000) => {
        if (usersRefreshTimerRef.current) {
            clearTimeout(usersRefreshTimerRef.current);
        }

        usersRefreshTimerRef.current = setTimeout(() => {
            usersRefreshTimerRef.current = null;
            void refreshUsers();
        }, delayMs);
    }, [refreshUsers]);

    // Load users and session on mount
    useEffect(() => {
        let isMounted = true;

        const init = async () => {
            // Safety timeout to ensure app loads even if Supabase hangs
            const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 5000));

            try {
                // 1. Check active session via Supabase with race
                const sessionPromise = supabase.auth.getSession();

                const result: any = await Promise.race([
                    sessionPromise,
                    timeoutPromise.then(() => ({ error: { message: "Auth init timeout" } }))
                ]);

                // HANDLE CRITICAL AUTH ERRORS (e.g. Invalid Refresh Token)
                if (result?.error && authService.isUnrecoverableAuthError(result.error)) {
                    console.error("[Supabase Auth] Unrecoverable session error detected during init:", result.error.message);
                    await logout(); // Force clean slate
                    return;
                }

                // If Supabase finds a session, we load the full app user (with DB profile)
                if (result?.data?.session?.user && isMounted) {
                    const currentUser = await authService.getCurrentUser();
                    console.log("[DEBUG USER] Init:", currentUser);
                    setUser(currentUser);
                }
                // REMOVED FALLBACK: We rely on Supabase Persistence. 
                // Manual loadUserLocally() causes race conditions with onAuthStateChange.

                // Defer the initial profile refresh (e.g. only NPCs for common lists)
                if (isMounted && result?.data?.session) {
                    scheduleUsersRefresh(1000); // 1s delay
                }

            } catch (error) {
                console.error("Auth init error:", error);
            } finally {
                if (isMounted) setIsLoaded(true);
            }
        };

        init();

        // 3. Listen for Supabase Auth Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`[Supabase Auth] Event: ${event}`);

            // Handle potential session errors during auth state change events
            if ((event as any) === 'INITIAL_SESSION_ERROR' || (event as any) === 'TOKEN_REFRESH_FAILED') {
                console.warn(`[Supabase Auth] Critical event ${event} detected.`);
                // We might want to trigger logout here if it's persistent, 
                // but let's prioritize init() for now as it's the most common failure point.
            }

            if (!isMounted) return;

            // GUARD: Ignore sign-in events if we are manually logging out
            if (isLoggingOutRef.current && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
                return;
            }

            if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
                if (session?.user) {
                    const appUser = await authService.getCurrentUser();
                    console.log("[DEBUG USER] AuthStateChange:", appUser);
                    setUser(appUser);
                    setUser(appUser);
                    // No automatic full refresh anymore
                }
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setUsersDB([]);
            }
        });


        // 5. Handle Deep Links for Supabase Auth (Magic Links, Social Login)
        const handleDeepLink = async (url: string) => {
            if (!url) return;
            const { path, queryParams } = Linking.parse(url);
            console.log("AuthContext: Received Deep Link URL:", url, "path:", path);

            // Referral link handling: aiutarsiapp://referral/[CODE] or https://aiutarsi.app/referral/[CODE]
            if (path && path.includes('referral/')) {
                const code = path.split('referral/')[1];
                if (code) {
                    console.log("AuthContext: Detected referral code:", code);
                    await AsyncStorage.setItem('@pending_referral_code', code);
                }
            }
        };

        // Check initial URL
        Linking.getInitialURL().then(url => {
            if (url) handleDeepLink(url);
        });

        // Listen for new URLs
        const linkingSubscription = Linking.addEventListener('url', (event) => {
            handleDeepLink(event.url);
        });

        return () => {
            isMounted = false;
            if (usersRefreshTimerRef.current) {
                clearTimeout(usersRefreshTimerRef.current);
            }
            subscription.unsubscribe();
            linkingSubscription.remove();
        };
    }, [refreshUsers, scheduleUsersRefresh]);

    // Heartbeat for "Online now" status
    useEffect(() => {
        if (!user) return;

        const updateStatus = () => {
            authService.updateLastSeen(user.id);
        };

        // Initial update
        updateStatus();

        // Update every 3 minutes
        const interval = setInterval(updateStatus, 180000);

        // IMMEDIATE UPDATE ON APP FOCUS
        const handleAppStateChange = async (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                console.log("[Heartbeat] App returned to active. Immediate status update...");
                updateStatus();
                try {
                    const { data } = await supabase.auth.refreshSession();
                    if (data?.session?.user?.user_metadata?.is_banned) {
                        // Aggiorniamo lo user in locale così scatta la UI BannedScreen
                        setUser(prev => prev ? { ...prev, is_banned: true } : null);
                    }
                } catch(e) {}
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        // REALTIME SUBSCRIPTION PER IL BAN ISTANTANEO
        const profileSubscription = supabase.channel('public:profiles:is_banned')
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'profiles', 
                filter: `id=eq.${user.id}` 
            }, async (payload) => {
                if (payload.new) {
                    console.log(`[AuthContext] Stato ban aggiornato tramite Realtime a: ${payload.new.is_banned}`);
                    setUser(prev => prev ? { ...prev, is_banned: !!payload.new.is_banned, ban_reason: payload.new.ban_reason, ban_report_id: payload.new.ban_report_id } : null);
                }
            }).subscribe();

        return () => {
            clearInterval(interval);
            subscription.remove();
            profileSubscription.unsubscribe();
        };
    }, [user?.id]);

    const login = useCallback(async (email: string, password: string): Promise<boolean> => {
        // FORCE RESET LOGOUT GUARD
        // If user logs in immediately after logout, we must allow the event.
        isLoggingOutRef.current = false;

        // setIsLoading(true); // Don't trigger global loading
        try {
            const loggedUser = await authService.login(email, password);
            // State update is handled by onAuthStateChange
            setUser(loggedUser);
            return true;
        } catch (error) {
            console.warn("Login failed:", error);
            throw error;
        } finally {
            // setIsLoading(false);
        }
    }, []);

    const register = useCallback(async (userData: Partial<AppUser>): Promise<boolean> => {
        // setIsLoading(true); // Don't trigger global loading
        try {
            // Check required fields (basic validation)
            if (!userData.email || !userData.password || (!userData.full_name && !userData.name)) {
                throw new Error("Missing required fields");
            }

            const newUser = await authService.register(userData as any);
            setUser(newUser);
            await refreshUsers();
            return true;
        } catch (error) {
            console.warn("Registration failed:", error);
            throw error;
        } finally {
            // setIsLoading(false);
        }
    }, [refreshUsers]);

    const updateUserProfile = useCallback(async (data: Partial<AppUser>): Promise<boolean> => {
        // PREVENTIVE BLOCK: Ignore updates if logout is in progress
        if (!user || isLoggingOutRef.current) return false;

        try {
            console.log("[DEBUG] AuthContext: Update started for", data);

            // 1. Calculate new state
            const cleanData = Object.fromEntries(
                Object.entries(data).filter(([, v]) => v !== undefined)
            );

            // Ensure both snake_case and camelCase for profile completion and avatar are synced
            const updatedUser = { ...user, ...cleanData };
            
            // Sync Avatar keys
            if (cleanData.avatar_url !== undefined) {
                (updatedUser as any).avatar = cleanData.avatar_url;
            } else if ((cleanData as any).avatar !== undefined) {
                updatedUser.avatar_url = (cleanData as any).avatar;
            }

            // 2. Update Local State Immediately (Optimistic)
            setUser(updatedUser);

            // 3. Sync to Backend (Awaited)
            await authService.updateProfile(user.id, data);

            console.log("[DEBUG USER] Profile Updated:", updatedUser);

            await refreshUsers();

            return true;
        } catch (error: any) {
            console.error("Update profile local error:", error);
            throw error;
        }
    }, [user, refreshUsers]);

    const resetState = useCallback(async () => {
        try {
            console.log("[DEBUG] AuthContext: Force clearing all storage");
            const keys = await AsyncStorage.getAllKeys();
            // Project ID: pavnfiladmnwbptwlwpr
            const authKeys = keys.filter(k => k.includes('supabase') || k.includes('pavnfiladmnwbptwlwpr') || k === 'auth_user');
            if (authKeys.length > 0) {
                await AsyncStorage.multiRemove(authKeys);
            }
        } catch (e) {
            console.error("[DEBUG] AuthContext: failed to clear AsyncStorage", e);
        }

        setUser(null);
        console.log("[DEBUG] AuthContext: resetState completed, user null");
    }, []);

    const logout = useCallback(async () => {
        console.log("[DEBUG] AuthContext: logout process started");

        // 1. STATO DI EMERGENZA (Sincrono e Immediato)
        isLoggingOutRef.current = true;
        setIsLoggingOut(true);
        setIsLoading(true);

        try {
            // 2. LOGOUT LOCALE (SDK) + BACKGROUND GLOBAL
            // Usiamo un timeout rapido (500ms) anche per il logout locale nel caso l'SDK sia bloccato.
            console.log("[DEBUG] AuthContext: Performing local SDK signOut");
            try {
                await Promise.race([
                    supabase.auth.signOut({ scope: 'local' }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Local SignOut Timeout")), 500))
                ]);
            } catch (e: any) {
                console.warn("[DEBUG] Local SDK SignOut skipped/timed out:", e.message);
            }

            // Lanciamo la pulizia globale e dello storage in background
            authService.logout();

            // 3. AZZERA STATO UI ISTANTANEAMENTE
            // Questo comando smonta le rotte protette.
            setUser(null);

            // 4. RESET STORAGE AGGIUNTIVO
            await resetState();

            console.log("[DEBUG] AuthContext: logout logic sequence completed");

        } catch (error) {
            console.error("[DEBUG] AuthContext: Critical logout error:", error);
        } finally {
            // Rilasciamo i flag dopo 800ms: tempo sufficiente per il redirect
            setTimeout(() => {
                setIsLoading(false);
                setIsLoggingOut(false);
                isLoggingOutRef.current = false;
                console.log("[DEBUG] AuthContext: Logout flags cleared, app stable.");
            }, 800);
        }
    }, [resetState]);

    const getNPOFollowers = useCallback((npoId: string): AppUser[] => {
        return usersDB.filter(u =>
            u.role === "VOLUNTEER" &&
            u.followed_entities?.some(e => e.npo_id === npoId)
        );
    }, [usersDB]);

    const getUserById = useCallback((id: string) => {
        return usersDB.find(u => u.id === id);
    }, [usersDB]);

    const fetchUserById = useCallback(async (id: string): Promise<AppUser | null> => {
        // Check local cache first
        const cached = usersDB.find(u => u.id === id);
        if (cached) return cached;

        const profile = await authService.getProfileById(id);
        if (profile) {
            setUsersDB(prev => {
                if (prev.find(u => u.id === id)) return prev;
                return [...prev, profile];
            });
        }
        return profile;
    }, [usersDB]);

    const requestAccountDeletion = useCallback(async () => {
        if (!user) return;
        try {
            await profileService.requestAccountDeletion(user.id);
            // The service calls authService.getCurrentUser() which should sync local user if needed,
            // but for immediate UI response we update locally too.
            setUser(prev => prev ? { ...prev, deletionRequestedAt: new Date().toISOString() } : null);
        } catch (error) {
            console.error("Request account deletion failed:", error);
            throw error;
        }
    }, [user]);

    const cancelAccountDeletion = useCallback(async () => {
        if (!user) return;
        try {
            await profileService.cancelAccountDeletion(user.id);
            setUser(prev => prev ? { ...prev, deletionRequestedAt: null } : null);
        } catch (error) {
            console.error("Cancel account deletion failed:", error);
            throw error;
        }
    }, [user]);

    const getReferralCount = useCallback(async (): Promise<number> => {
        if (!user) return 0;
        return await authService.getReferralCount(user.id);
    }, [user]);
    
    const updateEmail = useCallback(async (newEmail: string): Promise<boolean> => {
        if (!user) return false;
        try {
            const updatedUser = await authService.updateEmail(newEmail);
            setUser(updatedUser);
            return true;
        } catch (error) {
            console.error("Update email failed:", error);
            throw error;
        }
    }, [user]);

    const updatePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<boolean> => {
        if (!user) return false;
        try {
            await authService.updatePassword(oldPassword, newPassword);
            return true;
        } catch (error) {
            console.error("Update password failed:", error);
            throw error;
        }
    }, [user]);

    // Legacy Reset - Not really applicable with Supabase but kept for interface compatibility
    const resetUsers = useCallback(async () => {
        try {
            console.warn("Reset Users not fully supported in Supabase mode client-side.");
            await authService.logout();
            setUser(null);
        } catch (error) {
            console.error("Reset failed", error);
        }
    }, []);

    const value = useMemo(() => ({
        user,
        users: usersDB,
        usersDB,
        login,
        register,
        logout,
        isLoading,
        isLoggingOut,
        isLoaded,
        updateUserProfile,
        getNPOFollowers,
        getUserById,
        fetchUserById,
        setUser,
        resetUsers,
        refreshUsers,
        requestAccountDeletion,
        cancelAccountDeletion,
        getReferralCount,
        updateEmail,
        updatePassword
    }), [user, usersDB, login, register, logout, isLoading, isLoggingOut, isLoaded, updateUserProfile, getNPOFollowers, getUserById, fetchUserById, setUser, resetUsers, refreshUsers, requestAccountDeletion, cancelAccountDeletion, getReferralCount, updateEmail, updatePassword]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
