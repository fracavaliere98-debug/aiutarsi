import { runStagingNotificationSmoke } from "./run_staging_notification_smoke";

runStagingNotificationSmoke("cron_modes")
  .then((lines) => {
    for (const line of lines) console.log(line);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
