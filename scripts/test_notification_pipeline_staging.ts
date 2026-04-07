import { runStagingNotificationSmoke } from "./run_staging_notification_smoke";

runStagingNotificationSmoke("pipeline")
  .then((lines) => {
    for (const line of lines) console.log(line);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
