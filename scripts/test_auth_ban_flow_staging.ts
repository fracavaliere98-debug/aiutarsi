import { runStagingNotificationSmoke } from "./run_staging_notification_smoke";

runStagingNotificationSmoke("auth_ban_flow")
  .then((lines) => {
    if (Array.isArray(lines)) {
      for (const line of lines) console.log(line);
      return;
    }
    console.log(JSON.stringify(lines, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
