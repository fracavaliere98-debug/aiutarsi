import { Stack, useRouter, useSegments } from "expo-router";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import { ToastContainer } from "../components/Toast";
import { LevelUpOverlay } from "../components/LevelUpOverlay";
import { NotificationsRuntimeBridge } from "../components/notifications/NotificationsRuntimeBridge";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { QueryProvider } from "../providers/QueryProvider";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Animated, StyleSheet } from "react-native";
import * as Updates from "expo-updates";
import { usePushNotifications } from "../hooks/usePushNotifications";
import BannedScreen from "../components/BannedScreen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { STACK_TRANSITIONS } from "../constants/motion";
import { BrandedLoadingVideo } from "../components/BrandedLoadingVideo";
import { consumeIntroVideoTransition } from "../utils/introVideoTransition";
import * as Sentry from "@sentry/react-native";
import { initializeMonitoring, isMonitoringEnabled } from "../utils/monitoring";
import { isCorporateEnabled } from "../utils/runtimeConfig";

const appIntroVideo = require("../assets/videos/hailuo-2_3_bright_lens_flare_Create_a_premium_mobile_app_opening_animation_for_a_brand_call-0.mp4");

initializeMonitoring();

SplashScreen.preventAutoHideAsync();

if (Platform.OS !== "web") {
  void import("expo-notifications")
    .then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: false,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: false,
          shouldShowList: true,
        }),
      });
    })
    .catch((error) => {
      console.warn("[Push] Notification handler unavailable:", error);
    });
}

function RootLayoutNav() {
  const { user, isLoaded, isLoading: isAuthLoading, isLoggingOut, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const isRedirecting = useRef(false);
  const hasCheckedForUpdates = useRef(false);
  const [showStartupVideo, setShowStartupVideo] = useState(true);
  const startupVideoOpacity = useRef(new Animated.Value(1)).current;

  const playIntroOverlay = useCallback(() => {
    startupVideoOpacity.setValue(1);
    setShowStartupVideo(true);
  }, [startupVideoOpacity]);

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
  const corporateEnabled = isCorporateEnabled();
  const inCorporateRegister = segmentKey.includes("register/corporate");

  // Navigation Guard Logic
  useEffect(() => {
    if (!isLoaded || isRedirecting.current || isLoggingOut) return;

    const inOnboarding = segmentKey.includes("onboarding");
    const hasCompletedOnboarding = user?.profile_completed;

    const navigate = (dest: string) => {
      isRedirecting.current = true;
      router.replace(dest as any);
      setTimeout(() => { isRedirecting.current = false; }, 800);
    };

    // 1. Unauthenticated users: Can't stay in protected/onboarding areas
    if (!user) {
      if (inProtectedGroup || inOnboarding || (!corporateEnabled && inCorporateRegister)) {
        navigate("/");
      }
      return;
    }

    if (!corporateEnabled && user.role === "CORPORATE") {
      isRedirecting.current = true;
      void logout().finally(() => {
        router.replace("/");
        setTimeout(() => { isRedirecting.current = false; }, 800);
      });
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

    // 6. OTA Update Check (Once per session-ish): download automatically, then force a restart
    if (!__DEV__ && !hasCheckedForUpdates.current) {
      hasCheckedForUpdates.current = true;
      Updates.checkForUpdateAsync()
        .then(async (update) => {
          if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            Alert.alert(
              "Aggiornamento necessario",
              "È stato scaricato un aggiornamento dell'app. Riavvia per applicarlo.",
              [{ text: "Riavvia ora", onPress: () => Updates.reloadAsync() }],
              { cancelable: false }
            );
          }
        })
        .catch((error) => {
          console.warn("[Updates] Check/fetch failed:", error);
        });
    }

    }, [user, isLoaded, isLoggingOut, segmentKey, inProtectedGroup, onLandingPage, router, logout, corporateEnabled, inCorporateRegister]);

  useEffect(() => {
    if (!isLoaded || isAuthLoading || isLoggingOut || !showStartupVideo) return;

    const fadeTimer = setTimeout(() => {
      Animated.timing(startupVideoOpacity, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }).start();
    }, 3300);

    const timer = setTimeout(() => {
      setShowStartupVideo(false);
    }, 4000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(timer);
    };
  }, [isLoaded, isAuthLoading, isLoggingOut, showStartupVideo, startupVideoOpacity]);

  useEffect(() => {
    if (!isLoaded || isAuthLoading || isLoggingOut) return;
    if (consumeIntroVideoTransition()) {
      playIntroOverlay();
    }
  }, [segmentKey, isLoaded, isAuthLoading, isLoggingOut, playIntroOverlay]);

  // Loading spinner (Combined: Initial Load + Ongoing Auth actions + Logout Guard + Redirection Guard)
  if (!isLoaded || isAuthLoading || isLoggingOut || (!user && inProtectedGroup)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <ActivityIndicator size="large" color="#311b92" />
      </View>
    );
  }


  // BANNED USER GUARD 
  // Rende la schermata fissa di account sospeso invece di navigare
  if (user?.is_banned) {
    return <BannedScreen reason={user.ban_reason || undefined} reportId={user.ban_report_id || undefined} onLogout={logout} />;
  }

  // No other conditional returns that prevent the Stack from rendering
  // unless we want to show a generic unauthorized state, but the sub-layouts handle it.

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Stack screenOptions={STACK_TRANSITIONS.root}>
          <Stack.Screen name="index" options={STACK_TRANSITIONS.root} />
          <Stack.Screen name="onboarding" options={STACK_TRANSITIONS.push} />

          <Stack.Screen name="(volunteer)" options={STACK_TRANSITIONS.root} />
          <Stack.Screen name="(npo)" options={STACK_TRANSITIONS.root} />
          <Stack.Screen name="(corporate)" options={STACK_TRANSITIONS.root} />
          <Stack.Screen name="admin" options={STACK_TRANSITIONS.root} />

          {/* Shared Routes */}
          <Stack.Screen name="activity/[id]" options={STACK_TRANSITIONS.push} />
          <Stack.Screen name="feedback/[id]" options={STACK_TRANSITIONS.modal} />
          <Stack.Screen name="npo-profile/[id]" options={STACK_TRANSITIONS.push} />
          <Stack.Screen name="npo-activities/[id]" options={STACK_TRANSITIONS.push} />
          <Stack.Screen name="blocked-users" options={STACK_TRANSITIONS.push} />
          <Stack.Screen name="community/create-post" options={STACK_TRANSITIONS.modal} />
          <Stack.Screen name="help-center" options={STACK_TRANSITIONS.modal} />
          <Stack.Screen name="terms" options={STACK_TRANSITIONS.push} />
        </Stack>
      </KeyboardAvoidingView>

      {showStartupVideo && (
        <Animated.View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            opacity: startupVideoOpacity,
          }}
        >
          <BrandedLoadingVideo source={appIntroVideo} showOverlay={false} startAtSeconds={2} />
        </Animated.View>
      )}
    </View>
  );
}

function RootLayout() {
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
              <NotificationsRuntimeBridge />
              <StatusBar style="dark" />
              <RootLayoutNav />
              <ToastContainer />
              <LevelUpOverlay />
            </ToastProvider>
          </AuthProvider>
        </ErrorBoundary>
      </QueryProvider>
    </SafeAreaProvider>
  );
}

const WrappedRootLayout = isMonitoringEnabled() ? Sentry.wrap(RootLayout) : RootLayout;

export default WrappedRootLayout;
