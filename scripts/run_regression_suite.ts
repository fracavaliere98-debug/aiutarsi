import { spawnSync } from "node:child_process";

const suite = [
  { label: "notifications-routing", path: "scripts/test_notification_routing.ts" },
  { label: "notifications-payload-contract", path: "scripts/test_notification_payload_contract.ts" },
  { label: "chat-filter-contract", path: "scripts/test_chat_filter_contract.ts" },
  { label: "chat-ux-contract", path: "scripts/test_chat_ux_contract.ts" },
  { label: "gemma-invocation-guard-contract", path: "scripts/test_gemma_invocation_guard_contract.ts" },
  { label: "activity-enrollment-contract", path: "scripts/test_activity_enrollment_contract.ts" },
  { label: "activity-form-contract", path: "scripts/test_activity_form_contract.ts" },
  { label: "stories-contract", path: "scripts/test_stories_contract.ts" },
  { label: "story-views-contract", path: "scripts/test_story_views_contract.ts" },
  { label: "gamification-contract", path: "scripts/test_gamification_contract.ts" },
  { label: "gamification-report", path: "scripts/test_volunteer_report.ts" },
  { label: "npo-report-quick-wins", path: "scripts/test_npo_report_quick_wins.ts" },
  { label: "smart-match-compatibility", path: "scripts/test_smart_match_compatibility_contract.ts" },
  { label: "unit-logic", path: "scripts/test_unit_logic.ts" },
  { label: "bootstrap-runtime-settings", path: "scripts/test_bootstrap_runtime_settings.ts" },
  { label: "gemma-help-local", path: "scripts/test_gemma_help_local.ts" },
  { label: "gemma-help-massive", path: "scripts/test_gemma_help_massive.ts" },
  { label: "profile-demographics", path: "scripts/test_profile_demographics.ts" },
  { label: "password-validation-contract", path: "scripts/test_password_validation_contract.ts" },
  { label: "gamification-legacy-consistency", path: "scripts/test_gamification_legacy_consistency_contract.ts" },
  { label: "monitoring-contract", path: "scripts/test_monitoring_contract.ts" },
  { label: "community-moderation-contract", path: "scripts/test_community_moderation_contract.ts" },
  { label: "auth-contract", path: "scripts/test_auth_contract.ts" },
  { label: "activities-selectors-contract", path: "scripts/test_activities_selectors_contract.ts" },
  { label: "settings-structure-contract", path: "scripts/test_settings_structure_contract.ts" },
  { label: "cron-invoke-auth-contract", path: "scripts/test_cron_invoke_auth_contract.ts" },
];

for (const test of suite) {
  console.log(`\n[regression] ${test.label}`);

  const result = spawnSync("npx", ["-y", "tsx", test.path], {
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nPASS regression suite completed");
