import { runStagingAccountDeletionSmoke } from "./run_staging_account_deletion_smoke";

runStagingAccountDeletionSmoke()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
