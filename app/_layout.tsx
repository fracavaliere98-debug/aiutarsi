import { Stack, useRouter, useSegments } from "expo-router";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ActivityProvider } from "../context/ActivityContext";
import { NotificationProvider } from "../context/NotificationContext";
import { ApplicationProvider } from "../context/ApplicationContext";
import { GamificationProvider } from "../context/GamificationContext";
import { ToastProvider } from "../context/ToastContext";
import { SmartMatchProvider } from "../context/SmartMatchContext";
import { ChatProvider } from "../context/ChatContext";
import { CommunityProvider } from "../context/CommunityContext";
import { StoriesProvider } from "../context/StoriesContext";
import { ToastContainer } from "../components/Toast";
import { LevelUpOverlay } from "../components/LevelUpOverlay";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { QueryProvider } from "../providers/QueryProvider";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import * as Updates from "expo-updates";
import { usePushNotifications } from "../hooks/usePushNotifications";
import BannedScreen from "../components/BannedScreen";
import { SafeAreaProvider } from "react-native-safe-area-context";

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // Disabilita l'alert di sistema in-app (gestito dal Toast in NotificationContext)
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
});

function RootLayoutNav() {
  const { user, isLoaded, isLoading: isAuthLoading, isLoggingOut, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const isRedirecting = useRef(false);
  const hasCheckedForUpdates = useRef(false);

  // Register for push notifications and keep last_seen_at updated
  usePushNotifications();

  // Join segments to avoid reference mismatch loops
  const routeSegments = segments as string[];
  const segmentKey = routeSegments.join("/");

  const inVolunteerGroup = routeSegments.includes("(volunteer)");
  const inNPOGroup = routeSegments.includes("(npo)");
  const inCorporateGroup = routeSegments.includes("(corporate)");
  const inProtectedGroup = inVolunteerGroup || inNPOGroup || inCorporateGroup;

  const onLandingPage = routeSegments.length === 0 || (routeSegments.length === 1 && routeSegments[0] === "index");

  // Navigation Guard Logic
  useEffect(() => {
    if (!isLoaded || isRedirecting.current || isLoggingOut) return;

    const inOnboarding = segmentKey.includes("onboarding");
    const hasCompletedOnboarding = user?.profile_completed;

    const navigate = (dest: string) => {
      console.log(`[DEBUG] RootLayoutNav: Redirecting to ${dest}`);
      isRedirecting.current = true;
      router.replace(dest as any);
      setTimeout(() => { isRedirecting.current = false; }, 800);
    };

    // 1. Unauthenticated users: Can't stay in protected/onboarding areas
    if (!user) {
      if (inProtectedGroup || inOnboarding) {
        navigate("/");
      }
      return;
    }

    // 2. Banned users: Handled in render (BannedScreen)
    if (user.is_banned) return;

    // 3. User on Landing Page: Route them to their dashboard
    if (onLandingPage) {
      const dest = user.role === "ADMIN" ? "/admin" :
                   user.role === "VOLUNTEER" ? (hasCompletedOnboarding ? "/(volunteer)/(tabs)/community" : "/onboarding/intro") :
                   user.role === "NPO" ? (hasCompletedOnboarding ? "/(npo)/(tabs)/community" : "/onboarding/intro") :
                   "/(corporate)";
      navigate(dest);
      return;
    }

    // 4. Incomplete Profile: Forcing onboarding
    if ((user.role === "VOLUNTEER" || user.role === "NPO") && !hasCompletedOnboarding && !inOnboarding) {
      const dest = user.role === "NPO" ? "/onboarding/intro" : "/onboarding/interests";
      navigate(dest);
      return;
    }

    // 5. Stuck in Onboarding: Escape to app
    if ((hasCompletedOnboarding || user.role === "ADMIN") && inOnboarding && !segmentKey.includes("welcome")) {
      const dest = user.role === "ADMIN" ? "/admin" :
                   user.role === "VOLUNTEER" ? "/(volunteer)/(tabs)/community" :
                   user.role === "NPO" ? "/(npo)/(tabs)/community" :
                   "/(corporate)";
      navigate(dest);
      return;
    }

    // 6. OTA Update Check (Once per session-ish)
    if (!__DEV__ && !hasCheckedForUpdates.current) {
      hasCheckedForUpdates.current = true;
      Updates.checkForUpdateAsync().then(update => {
        if (update.isAvailable) {
          Alert.alert("Nuovo Aggiornamento", "È disponibile una nuova versione. Installa ora?", [
            { text: "Più tardi", style: "cancel" },
            { text: "Installa ora", onPress: async () => { await Updates.fetchUpdateAsync(); await Updates.reloadAsync(); } }
          ]);
        }
      }).catch(e => console.log("[DEBUG] OTA Check error:", e));
    }

  }, [user, isLoaded, isLoggingOut, segmentKey, inProtectedGroup, onLandingPage, router]);

  // Loading spinner (Combined: Initial Load + Ongoing Auth actions + Logout Guard + Redirection Guard)
  if (!isLoaded || isAuthLoading || isLoggingOut || (!user && inProtectedGroup)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <ActivityIndicator size="large" color="#311b92" />
      </View>
    );
  }

  console.log("[DEBUG] RootLayoutNav Rendering key:", segmentKey || "root", "user:", user ? user.role : "NULL");

  // BANNED USER GUARD 
  // Rende la schermata fissa di account sospeso invece di navigare
  if (user?.is_banned) {
    return <BannedScreen reason={user.ban_reason || undefined} reportId={user.ban_report_id || undefined} onLogout={logout} />;
  }

  // No other conditional returns that prevent the Stack from rendering
  // unless we want to show a generic unauthorized state, but the sub-layouts handle it.

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />

        <Stack.Screen name="(volunteer)" />
        <Stack.Screen name="(npo)" />
        <Stack.Screen name="(corporate)" />
        <Stack.Screen name="admin" />

        {/* Shared Routes */}
        <Stack.Screen name="activity/[id]" />
        <Stack.Screen name="feedback/[id]" />
        <Stack.Screen name="npo-profile/[id]" />
        <Stack.Screen name="community/create-post" />
        <Stack.Screen name="help-center" />
      </Stack>
    </KeyboardAvoidingView>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  const splashHasHidden = useRef(false);

  useEffect(() => {
    if (loaded || error) {
      if (!splashHasHidden.current) {
        splashHasHidden.current = true;
        // We use a small delay or requestAnimationFrame to ensure the native side 
        // is ready to receive the hide command after the initial render.
        const hide = async () => {
          try {
            await SplashScreen.hideAsync();
          } catch (e) {
            console.log("[SplashScreen] Hide error ignored:", e);
          }
        };

        // Small timeout to avoid "No native splash screen registered" race condition
        setTimeout(hide, 100);
      }
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryProvider>
        <ErrorBoundary>
          <AuthProvider>
            <ToastProvider>
              <GamificationProvider>
                <NotificationProvider>
                  <ActivityProvider>
                    <SmartMatchProvider>
                      <ApplicationProvider>
                        <ChatProvider>
                          <CommunityProvider>
                            <StoriesProvider>
                              <StatusBar style="dark" />
                              <RootLayoutNav />
                              <ToastContainer />
                              <LevelUpOverlay />
                            </StoriesProvider>
                          </CommunityProvider>
                        </ChatProvider>
                      </ApplicationProvider>
                    </SmartMatchProvider>
                  </ActivityProvider>
                </NotificationProvider>
              </GamificationProvider>
            </ToastProvider>
          </AuthProvider>
        </ErrorBoundary>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
