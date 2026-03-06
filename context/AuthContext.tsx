import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { Alert, AppState, AppStateStatus } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { AppUser } from "../types";
import { authService } from "../services/AuthService";
import { npoService } from "../services/NPOService";
import { eventEmitter, SyncEvents } from "../utils/EventEmitter";
import { supabase } from "../utils/supabase";

interface AuthContextType {
    user: AppUser | null;
    users: AppUser[]; // All users in the system
    login: (email: string, password: string) => Promise<boolean>;
    register: (userData: Partial<AppUser>) => Promise<boolean>;
    logout: () => void;
    isLoaded: boolean;
    isLoading: boolean;
    isLoggingOut: boolean;
    updateUserProfile: (data: Partial<AppUser>) => Promise<boolean>;
    // NPO Follower Management
    followNPO: (npoId: string) => Promise<boolean>;
    unfollowNPO: (npoId: string) => Promise<boolean>;
    getNPOFollowers: (npoId: string) => AppUser[];
    isFollowingNPO: (npoId: string) => boolean;
    getUserById: (id: string) => AppUser | undefined;
    resetUsers: () => Promise<void>;
    refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    users: [],
    login: async () => false,
    register: async () => false,
    logout: () => { },
    isLoaded: false,
    isLoading: false,
    isLoggingOut: false,
    updateUserProfile: async () => false,
    followNPO: async () => false,
    unfollowNPO: async () => false,
    getNPOFollowers: () => [],
    isFollowingNPO: () => false,
    getUserById: () => undefined,
    resetUsers: async () => { },
    refreshUsers: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [usersDB, setUsersDB] = useState<AppUser[]>([]);

    // Use ref to track logout intent immediately and synchronously across closures
    const isLoggingOutRef = React.useRef(false);

    const refreshUsers = useCallback(async () => {
        const all = await authService.getAllUsers();
        setUsersDB(all);
    }, []);

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

                // 2. Load All Users (Mock + Current)
                if (isMounted && result?.data?.session) await refreshUsers();

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
                    await refreshUsers();
                }
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
            }
        });

        // 4. Listen for Sync Events (Legacy/Internal sync)
        const unsubscribeEventEmitter = eventEmitter.on(SyncEvents.SYNC_USERS, () => {
            console.log("AuthContext: Syncing users...");
            refreshUsers();
        });

        // 5. Handle Deep Links for Supabase Auth (Magic Links, Social Login)
        const handleDeepLink = (url: string) => {
            if (!url) return;
            const { queryParams } = Linking.parse(url);

            // Supabase session tokens usually come in the hash (#) but expo-linking
            // sometimes parses them or we might need to manually trigger refresh.
            // With detectSessionInUrl: true, Supabase client handles it if we are on the same 'instance'.
            console.log("AuthContext: Received Deep Link URL:", url);
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
            subscription.unsubscribe();
            unsubscribeEventEmitter();
            linkingSubscription.remove();
        };
    }, [refreshUsers]);

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
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                console.log("[Heartbeat] App returned to active. Immediate status update...");
                updateStatus();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            clearInterval(interval);
            subscription.remove();
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
            if (!userData.email || !userData.password || !userData.full_name) {
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

            // If updating skills/interests/followedNPOs, ensure we don't break the object structure
            // In theory, if the component sends { skills: ['A'] }, it replaces the flat array.
            const updatedUser = { ...user, ...cleanData };

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

    // NPO Follower Management Functions
    const followNPO = useCallback(async (npoId: string): Promise<boolean> => {
        if (!user || user.role !== "VOLUNTEER") return false;
        try {
            await npoService.followNPO(npoId, user.id);

            // Update both relational and flat arrays for consistency
            const updatedFollowedEntities = [...(user.followed_entities || []), { npo_id: npoId }];
            const updatedFollowedNPOs = [...(user.followedNPOs || []), npoId];

            const updatedUser = {
                ...user,
                followed_entities: updatedFollowedEntities,
                followedNPOs: updatedFollowedNPOs
            };
            setUser(updatedUser);

            refreshUsers();
            return true;
        } catch (error) {
            console.error("Follow NPO failed:", error);
            return false;
        }
    }, [user, refreshUsers]);

    const unfollowNPO = useCallback(async (npoId: string): Promise<boolean> => {
        if (!user || user.role !== "VOLUNTEER") return false;
        try {
            await npoService.unfollowNPO(npoId, user.id);

            // Update both relational and flat arrays
            const updatedFollowedEntities = (user.followed_entities || []).filter(e => e.npo_id !== npoId);
            const updatedFollowedNPOs = (user.followedNPOs || []).filter(id => id !== npoId);

            const updatedUser = {
                ...user,
                followed_entities: updatedFollowedEntities,
                followedNPOs: updatedFollowedNPOs
            };
            setUser(updatedUser);

            refreshUsers();
            return true;
        } catch (error) {
            console.error("Unfollow NPO failed:", error);
            return false;
        }
    }, [user, refreshUsers]);

    const getNPOFollowers = useCallback((npoId: string): AppUser[] => {
        return usersDB.filter(u =>
            u.role === "VOLUNTEER" &&
            u.followed_entities?.some(e => e.npo_id === npoId)
        );
    }, [usersDB]);

    const isFollowingNPO = useCallback((npoId: string): boolean => {
        if (!user || user.role !== "VOLUNTEER") return false;
        return user.followed_entities?.some(e => e.npo_id === npoId) || false;
    }, [user]);

    const getUserById = useCallback((id: string) => {
        return usersDB.find(u => u.id === id);
    }, [usersDB]);

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
        login,
        register,
        logout,
        isLoading,
        isLoggingOut,
        isLoaded,
        updateUserProfile,
        followNPO,
        unfollowNPO,
        getNPOFollowers,
        isFollowingNPO,
        getUserById,
        resetUsers,
        refreshUsers
    }), [user, usersDB, login, register, logout, isLoading, isLoggingOut, isLoaded, updateUserProfile, followNPO, unfollowNPO, getNPOFollowers, isFollowingNPO, getUserById, resetUsers, refreshUsers]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
