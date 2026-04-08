import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { AppUser } from "../types";
import { authService } from "../services/AuthService";
import { supabase } from "../utils/supabase";
import { profileService } from "../services/ProfileService";
import { getSupabaseProjectRef } from "../utils/runtimeConfig";
import { isExpectedUserInputError, setMonitoringUser, trackError, trackEvent } from "../utils/monitoring";

interface AuthContextType {
    user: AppUser | null;
    users: AppUser[];
    usersDB: AppUser[]; 
    login: (email: string, password: string) => Promise<boolean>;
    register: (userData: Partial<AppUser>) => Promise<{ ok: boolean; requiresEmailConfirmation: boolean }>;
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
    resendSignupConfirmation: (email: string) => Promise<void>;
    checkEmailConfirmationStatus: (email: string) => Promise<boolean>;
    requestPasswordReset: (email: string) => Promise<void>;
    completePasswordRecovery: (newPassword: string) => Promise<void>;
    getNPOFollowers: (npoId: string) => AppUser[];
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    users: [],
    usersDB: [],
    login: async () => false,
    register: async () => ({ ok: false, requiresEmailConfirmation: false }),
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
    resendSignupConfirmation: async () => { },
    checkEmailConfirmationStatus: async () => false,
    requestPasswordReset: async () => { },
    completePasswordRecovery: async () => { },
    getNPOFollowers: () => [],
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

    const syncBanStateFromProfile = useCallback(async (profileId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('is_banned, ban_reason, ban_report_id')
                .eq('id', profileId)
                .single();

            if (error) throw error;
            setUser(prev => prev ? {
                ...prev,
                is_banned: !!data?.is_banned,
                ban_reason: data?.ban_reason || null,
                ban_report_id: data?.ban_report_id || null,
            } : null);
        } catch (error) {
            console.warn("[AuthContext] Failed to sync ban state from profile:", error);
        }
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
                    trackError(result.error, {
                        source: "auth_init",
                        kind: "unrecoverable_session",
                    });
                    await logout(); // Force clean slate
                    return;
                }

                // If Supabase finds a session, we load the full app user (with DB profile)
                if (result?.data?.session?.user && isMounted) {
                    authService.setCachedAccessToken(result.data.session.access_token);
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
            trackError(error, {
                source: "auth_init",
                kind: "init_failed",
            }, {
                source: "auth_init",
                classification: "error_technical",
                issueName: "auth_init_failed",
            });
            } finally {
                if (isMounted) setIsLoaded(true);
            }
        };

        init();

        // 3. Listen for Supabase Auth Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`[Supabase Auth] Event: ${event}`);
            trackEvent("auth_state_changed", {
                event,
                hasSession: !!session,
                hasUser: !!session?.user,
            });

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
                    authService.setCachedAccessToken(session.access_token);
                    const appUser = await authService.getCurrentUser();
                    console.log("[DEBUG USER] AuthStateChange:", appUser);
                    setUser(appUser);
                    // No automatic full refresh anymore
                }
            } else if (event === 'SIGNED_OUT') {
                authService.setCachedAccessToken(null);
                setUser(null);
                setUsersDB([]);
            }
        });


        // 5. Handle Deep Links for Supabase Auth (Magic Links, Social Login)
        const handleDeepLink = async (url: string) => {
            if (!url) return;
            const { path } = Linking.parse(url);
            console.log("AuthContext: Received Deep Link URL:", url, "path:", path);

            // Referral link handling: aiutarsiapp://referral/[CODE] or https://aiutarsi.app/referral/[CODE]
            if (path && path.includes('referral/')) {
                const code = path.split('referral/')[1];
                if (code) {
                    console.log("AuthContext: Detected referral code:", code);
                    trackEvent("referral_link_detected", { codeLength: code.length });
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
    }, [logout, refreshUsers, scheduleUsersRefresh]);

    useEffect(() => {
        setMonitoringUser(user);
    }, [user]);

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
                    const { data: refreshed } = await supabase.auth.refreshSession();
                    if (refreshed.session?.access_token) {
                        authService.setCachedAccessToken(refreshed.session.access_token);
                    }
                    const refreshedUser = await authService.getCurrentUser();
                    if (refreshedUser) {
                        setUser(refreshedUser);
                    }
                    if (user?.id) {
                        await syncBanStateFromProfile(user.id);
                    }
                } catch {}
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
    }, [user, syncBanStateFromProfile]);

    const login = useCallback(async (email: string, password: string): Promise<boolean> => {
        // FORCE RESET LOGOUT GUARD
        // If user logs in immediately after logout, we must allow the event.
        isLoggingOutRef.current = false;

        // setIsLoading(true); // Don't trigger global loading
        try {
            trackEvent("auth_login_started", { emailDomain: email.split("@")[1] || "unknown" });
            const loggedUser = await authService.login(email, password);
            // State update is handled by onAuthStateChange
            setUser(loggedUser);
            trackEvent("auth_login_succeeded", { role: loggedUser.role });
            return true;
        } catch (error) {
            console.warn("Login failed:", error);
            const expected = isExpectedUserInputError(error);
            trackError(error, {
                source: "auth_login",
                emailDomain: email.split("@")[1] || "unknown",
            }, {
                source: "auth_login",
                priority: expected ? "low" : "high",
                classification: expected ? "expected_user" : "error_technical",
                issueName: "auth_login_failed",
                expected,
            });
            throw error;
        } finally {
            // setIsLoading(false);
        }
    }, []);

    const register = useCallback(async (userData: Partial<AppUser>): Promise<{ ok: boolean; requiresEmailConfirmation: boolean }> => {
        // setIsLoading(true); // Don't trigger global loading
        try {
            // Check required fields (basic validation)
            if (!userData.email || !userData.password || (!userData.full_name && !userData.name)) {
                throw new Error("Missing required fields");
            }

            trackEvent("auth_register_started", {
                role: userData.role || "unknown",
                emailDomain: userData.email.split("@")[1] || "unknown",
            });
            const result = await authService.register(userData as any);

            if (result.hasSession) {
                setUser(result.user);
                await refreshUsers();
                trackEvent("auth_register_succeeded", {
                    role: result.user.role,
                });
            } else {
                trackEvent("auth_register_confirmation_required", {
                    role: result.user.role,
                    emailDomain: userData.email?.split("@")[1] || "unknown",
                });
            }

            return {
                ok: true,
                requiresEmailConfirmation: result.requiresEmailConfirmation,
            };
        } catch (error) {
            console.warn("Registration failed:", error);
            const expected = isExpectedUserInputError(error);
            trackError(error, {
                source: "auth_register",
                role: userData.role || "unknown",
                emailDomain: userData.email?.split("@")[1] || "unknown",
            }, {
                source: "auth_register",
                priority: expected ? "low" : "high",
                classification: expected ? "expected_user" : "error_technical",
                issueName: "auth_register_failed",
                expected,
            });
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
            trackEvent("profile_update_started", {
                userId: user.id,
                role: user.role,
                fields: Object.keys(data).join(","),
            });

            // Sync to backend first to avoid optimistic local changes
            // from cascading into other providers while the save is still in flight.
            const persistedUser = await authService.updateProfile(user.id, data);
            console.log("[DEBUG] AuthContext: updateProfile resolved", persistedUser?.id, {
                interests: persistedUser?.interests?.length,
                skills: persistedUser?.skills?.length,
            });

            if (persistedUser) {
                setUser(persistedUser);
            }

            console.log("[DEBUG USER] Profile Updated:", persistedUser || user);
            console.log("[DEBUG] AuthContext: updateUserProfile about to return true");

            void refreshUsers().catch((refreshError) => {
                console.warn("Background users refresh failed after profile update:", refreshError);
            });

            trackEvent("profile_update_succeeded", {
                userId: user.id,
                role: user.role,
            });
            return true;
        } catch (error: any) {
            console.error("Update profile local error:", error);
            trackError(error, {
                source: "profile_update",
                userId: user.id,
                role: user.role,
                fields: Object.keys(data).join(","),
            }, {
                source: "profile_update",
                priority: "high",
                classification: "error_technical",
                issueName: "profile_update_failed",
            });
            throw error;
        }
    }, [user, refreshUsers]);

    const resetState = useCallback(async () => {
        try {
            console.log("[DEBUG] AuthContext: Force clearing all storage");
            const keys = await AsyncStorage.getAllKeys();
            const supabaseProjectRef = getSupabaseProjectRef();
            const authKeys = keys.filter((key) => (
                key.includes('supabase')
                || (supabaseProjectRef ? key.includes(supabaseProjectRef) : false)
                || key === 'auth_user'
            ));
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
            trackError(error, {
                source: "auth_logout",
            }, {
                source: "auth_logout",
                priority: "normal",
                classification: "warning_functional",
                issueName: "auth_logout_failed",
            });
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
        // Optimization: use a functional state check to avoid depending on usersDB directly in useEffects
        const profile = await authService.getProfileById(id);
        if (profile) {
            setUsersDB(prev => {
                if (prev.find(u => u.id === id)) return prev;
                return [...prev, profile];
            });
        }
        return profile;
    }, []); // Remove usersDB from deps

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
            await authService.updateEmail(newEmail);
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

    const resendSignupConfirmation = useCallback(async (email: string): Promise<void> => {
        await authService.resendSignupConfirmation(email);
        trackEvent("auth_confirmation_resend_requested", {
            emailDomain: email.split("@")[1] || "unknown",
        });
        trackEvent("auth_confirmation_resend_accepted", {
            emailDomain: email.split("@")[1] || "unknown",
        });
    }, []);

    const checkEmailConfirmationStatus = useCallback(async (email: string): Promise<boolean> => {
        const confirmed = await authService.checkEmailConfirmationStatus(email);
        trackEvent("auth_confirmation_status_checked", {
            emailDomain: email.split("@")[1] || "unknown",
            confirmed,
        });
        return confirmed;
    }, []);

    const requestPasswordReset = useCallback(async (email: string): Promise<void> => {
        await authService.requestPasswordReset(email);
        trackEvent("auth_password_reset_requested", {
            emailDomain: email.split("@")[1] || "unknown",
        });
    }, []);

    const completePasswordRecovery = useCallback(async (newPassword: string): Promise<void> => {
        await authService.completePasswordRecovery(newPassword);
        trackEvent("auth_password_reset_completed", {});
    }, []);

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
        updatePassword,
        resendSignupConfirmation,
        checkEmailConfirmationStatus,
        requestPasswordReset,
        completePasswordRecovery
    }), [user, usersDB, login, register, logout, isLoading, isLoggingOut, isLoaded, updateUserProfile, getNPOFollowers, getUserById, fetchUserById, setUser, resetUsers, refreshUsers, requestAccountDeletion, cancelAccountDeletion, getReferralCount, updateEmail, updatePassword, resendSignupConfirmation, checkEmailConfirmationStatus, requestPasswordReset, completePasswordRecovery]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
