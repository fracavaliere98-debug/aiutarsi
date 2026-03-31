import { profileRest } from "./profileRest";

let inFlight: Promise<void> | null = null;
let lastRunAt = 0;
let missingBackoffUntil = 0;

type SyncNotificationJobsOptions = {
  limit?: number;
  minIntervalMs?: number;
  force?: boolean;
};

export async function syncNotificationJobs(options: SyncNotificationJobsOptions = {}) {
  const { limit = 100, minIntervalMs = 15_000, force = false } = options;
  const now = Date.now();

  if (!force && missingBackoffUntil > now) {
    return;
  }

  if (!force && now - lastRunAt < minIntervalMs) {
    return;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      await profileRest.processNotificationJobs({ limit });
      missingBackoffUntil = 0;
      lastRunAt = Date.now();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("NOT_FOUND") || message.includes("Requested function was not found")) {
        missingBackoffUntil = Date.now() + 5 * 60 * 1000;
        console.warn("[notificationJobs] process-notification-jobs is not deployed yet");
      } else {
        console.warn("[notificationJobs] Failed to sync notification jobs", error);
      }
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function triggerNotificationJobs(options?: SyncNotificationJobsOptions) {
  void syncNotificationJobs(options);
}
