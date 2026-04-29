import { normalizeNotificationType } from "../hooks/notifications/mappers";
import { resolveNotificationRoute } from "../hooks/notifications/routeResolver";
import { notificationRoutingCases } from "./notificationRoutingCases";

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

  for (const routingCase of notificationRoutingCases) {
    expectRoute(
      routingCase.label,
      resolveNotificationRoute(routingCase.role, routingCase.notification),
      routingCase.expected
    );
  }

  console.log("PASS notification routing covers canonical redirect cases");
}

run();
