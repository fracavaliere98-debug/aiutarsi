import { Stack, useRouter, useSegments, Redirect } from "expo-router";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ActivityProvider } from "../context/ActivityContext";
import { NotificationProvider } from "../context/NotificationContext";
import { ApplicationProvider } from "../context/ApplicationContext";
import { GamificationProvider } from "../context/GamificationContext";
import { ToastProvider } from "../context/ToastContext";
import { SmartMatchProvider } from "../context/SmartMatchContext";
import { ChatProvider } from "../context/ChatContext";
import { ToastContainer } from "../components/Toast";
import { LevelUpOverlay } from "../components/LevelUpOverlay";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, Alert } from "react-native";
import * as Updates from "expo-updates";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, isLoaded, isLoading: isAuthLoading, isLoggingOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const isRedirecting = useRef(false);

  // Join segments to avoid reference mismatch loops
  const routeSegments = segments as string[];
  const segmentKey = routeSegments.join("/");

  const inVolunteerGroup = routeSegments.includes("(volunteer)");
  const inNPOGroup = routeSegments.includes("(npo)");
  const inCorporateGroup = routeSegments.includes("(corporate)");
  const inProtectedGroup = inVolunteerGroup || inNPOGroup || inCorporateGroup;

  const onLandingPage = routeSegments.length === 0 || (routeSegments.length === 1 && routeSegments[0] === "index");

  // Redirection Logic
  useEffect(() => {
    // 1. BASIC GUARDS
    if (!isLoaded || isRedirecting.current) return;

    const inOnboarding = segmentKey.includes("onboarding");
    const hasCompletedOnboarding = user?.profileCompleted;

    // 2. NO USER -> MUST ESCAPE PROTECTED GROUPS
    // This MUST trigger even during isLoggingOut to avoid infinite spinners on protected pages.
    if (!user) {
      if (inProtectedGroup || inOnboarding) {
        console.log("[DEBUG] RootLayoutNav: No user, escaping to /");
        isRedirecting.current = true;
        router.replace("/");
        setTimeout(() => { isRedirecting.current = false; }, 800);
      }
      return;
    }

    // 3. LOGOUT ACTIVE GUARD: Prevent re-entering the app while logging out
    if (isLoggingOut) {
      console.log("[DEBUG] RootLayoutNav: Redirection to App paused due to active logout");
      return;
    }

    // 4. LANDING PAGE GUARD: Logged user trying to access landing
    if (onLandingPage) {
      console.log("[DEBUG] RootLayoutNav: User present on Landing, going to App");
      isRedirecting.current = true;

      const dest = user.role === "VOLUNTEER"
        ? (user.profileCompleted ? "/(volunteer)/(tabs)" : "/onboarding/interests")
        : user.role === "NPO"
          ? "/(npo)/(tabs)"
          : "/(corporate)"; // Assuming corporate also has a default path

      router.replace(dest as any);
      setTimeout(() => { isRedirecting.current = false; }, 800);
      return;
    }

    // 5. ONBOARDING GUARD: User logged in but profile incomplete
    if (user.role === "VOLUNTEER" && !hasCompletedOnboarding && !inOnboarding) {
      console.log("[DEBUG] RootLayoutNav: Incomplete profile, forcing onboarding to /onboarding/interests");
      isRedirecting.current = true;
      router.replace("/onboarding/interests" as any);
      setTimeout(() => { isRedirecting.current = false; }, 800);
      return;
    }

    // 6. COMPLETION GUARD: User logged in, profile complete, but stuck in onboarding
    if (hasCompletedOnboarding && inOnboarding) {
      console.log("[DEBUG] RootLayoutNav: Profile complete, escaping onboarding to dashboard");
      isRedirecting.current = true;
      if (user.role === "VOLUNTEER") router.replace("/(volunteer)/(tabs)" as any);
      else if (user.role === "NPO") router.replace("/(npo)/(tabs)" as any);
      else if (user.role === "CORPORATE") router.replace("/(corporate)" as any);
      setTimeout(() => { isRedirecting.current = false; }, 800);
      return;
    }

    // 7. OTA UPDATE CHECK
    if (!__DEV__) {
      const checkUpdates = async () => {
        try {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            Alert.alert(
              "Nuovo Aggiornamento",
              "È disponibile una nuova versione dell'app. Vuoi installarla ora?",
              [
                { text: "Più tardi", style: "cancel" },
                {
                  text: "Installa ora",
                  onPress: async () => {
                    try {
                      await Updates.fetchUpdateAsync();
                      await Updates.reloadAsync();
                    } catch (e) {
                      console.error("Error fetching update:", e);
                    }
                  }
                }
              ]
            );
          }
        } catch (e) {
          console.log("[DEBUG] OTA Check error:", e);
        }
      };

      checkUpdates();
    }

  }, [user, isLoaded, isLoggingOut, segmentKey, inProtectedGroup, onLandingPage]);

  // Loading spinner (Combined: Initial Load + Ongoing Auth actions + Logout Guard + Redirection Guard)
  if (!isLoaded || isAuthLoading || isLoggingOut || (!user && inProtectedGroup)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <ActivityIndicator size="large" color="#311b92" />
      </View>
    );
  }

  console.log("[DEBUG] RootLayoutNav Rendering key:", segmentKey || "root", "user:", user ? user.role : "NULL");

  // No other conditional returns that prevent the Stack from rendering
  // unless we want to show a generic unauthorized state, but the sub-layouts handle it.

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />

      <Stack.Screen name="(volunteer)" />
      <Stack.Screen name="(npo)" />
      <Stack.Screen name="(corporate)" />

      {/* Shared Routes */}
      <Stack.Screen name="activity/[id]" />
      <Stack.Screen name="feedback/[id]" />
      <Stack.Screen name="npo-profile/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch((e) => {
        console.log("SplashScreen hide error ignored:", e);
      });
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <GamificationProvider>
            <NotificationProvider>
              <ActivityProvider>
                <SmartMatchProvider>
                  <ApplicationProvider>
                    <ChatProvider>
                      <StatusBar style="dark" />
                      <RootLayoutNav />
                      <ToastContainer />
                      <LevelUpOverlay />
                    </ChatProvider>
                  </ApplicationProvider>
                </SmartMatchProvider>
              </ActivityProvider>
            </NotificationProvider>
          </GamificationProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
