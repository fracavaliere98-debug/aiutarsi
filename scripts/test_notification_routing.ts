import { normalizeNotificationType } from "../hooks/notifications/mappers";
import { resolveNotificationRoute } from "../hooks/notifications/routeResolver";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function expectRoute(
  label: string,
  actual: string,
  expected: string
) {
  assert(actual === expected, `${label}: expected ${expected}, got ${actual}`);
}

function run() {
  assert(
    normalizeNotificationType("ACTIVITY_COMPLETED") === "ACTIVITY_COMPLETED",
    "ACTIVITY_COMPLETED should remain a first-class notification type"
  );

  expectRoute(
    "NPO followed post redirects to community",
    resolveNotificationRoute("NPO", {
      type: "FOLLOWED_NPO_POST",
      title: "Nuovo post dal tuo ente seguito",
      message: "Apri la community",
      npoId: "npo-1",
    } as any),
    "/(npo)/(tabs)/community"
  );

  expectRoute(
    "Volunteer followed story redirects to community",
    resolveNotificationRoute("VOLUNTEER", {
      type: "FOLLOWED_NPO_STORY",
      title: "Nuova storia pubblicata",
      message: "Apri la community",
      npoId: "npo-1",
    } as any),
    "/(volunteer)/(tabs)/community"
  );

  expectRoute(
    "NPO reengagement INFO redirects to community",
    resolveNotificationRoute("NPO", {
      type: "INFO",
      title: "Riattiva la tua community",
      message: "Pubblica una storia o una nuova attività per tornare visibile ai volontari.",
      payload: { reengagement: true },
    } as any),
    "/(npo)/(tabs)/community"
  );

  expectRoute(
    "Volunteer reengagement INFO redirects to community",
    resolveNotificationRoute("VOLUNTEER", {
      type: "INFO",
      title: "Torna a dare una mano",
      message: "Scopri una nuova attività o segui un ente vicino a te.",
      payload: { reengagement: true },
    } as any),
    "/(volunteer)/(tabs)/community"
  );

  expectRoute(
    "Verification SUCCESS redirects to profile",
    resolveNotificationRoute("NPO", {
      type: "SUCCESS",
      title: "Profilo Verificato! 🎉",
      message: "Hai ottenuto il Bollino Viola.",
    } as any),
    "/(npo)/(tabs)/profile"
  );

  expectRoute(
    "Completed activity redirects to activity detail",
    resolveNotificationRoute("VOLUNTEER", {
      type: "ACTIVITY_COMPLETED",
      title: "Missione Compiuta! 🎉",
      message: "Controlla il tuo profilo per i punti XP.",
      activityId: "activity-123",
    } as any),
    "/activity/activity-123"
  );

  console.log("PASS notification routing covers canonical redirect cases");
}

run();
