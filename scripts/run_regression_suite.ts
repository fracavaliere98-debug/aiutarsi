import { spawnSync } from "node:child_process";

const suite = [
  { label: "notifications-routing", path: "scripts/test_notification_routing.ts" },
  { label: "notifications-payload-contract", path: "scripts/test_notification_payload_contract.ts" },
  { label: "chat-filter-contract", path: "scripts/test_chat_filter_contract.ts" },
  { label: "chat-ux-contract", path: "scripts/test_chat_ux_contract.ts" },
  { label: "gemma-invocation-guard-contract", path: "scripts/test_gemma_invocation_guard_contract.ts" },
  { label: "gemma-shadow-minimization-contract", path: "scripts/test_gemma_shadow_minimization_contract.ts" },
  { label: "gemma-help-context-minimization-contract", path: "scripts/test_gemma_help_context_minimization_contract.ts" },
  { label: "smoke-functions-staging-only-contract", path: "scripts/test_smoke_functions_staging_only_contract.ts" },
  { label: "activity-enrollment-contract", path: "scripts/test_activity_enrollment_contract.ts" },
  { label: "attendance-confirmation-contract", path: "scripts/test_attendance_confirmation_contract.ts" },
  { label: "attendance-auto-confirm-and-reminder-contract", path: "scripts/test_attendance_auto_confirm_and_reminder_contract.ts" },
  { label: "reports-admin-contract", path: "scripts/test_reports_admin_contract.ts" },
  { label: "referral-contract", path: "scripts/test_referral_contract.ts" },
  { label: "banned-profile-contract", path: "scripts/test_banned_profile_contract.ts" },
  { label: "preferred-city-contract", path: "scripts/test_preferred_city_contract.ts" },
  { label: "my-reports-contract", path: "scripts/test_my_reports_contract.ts" },
  { label: "no-placeholder-avatar-contract", path: "scripts/test_no_placeholder_avatar_contract.ts" },
  { label: "profile-embed-columns-contract", path: "scripts/test_profile_embed_columns_contract.ts" },
  { label: "banned-hidden-everywhere-contract", path: "scripts/test_banned_hidden_everywhere_contract.ts" },
  { label: "required-fields-contract", path: "scripts/test_required_fields_contract.ts" },
  { label: "activity-invites-contract", path: "scripts/test_activity_invites_contract.ts" },
  { label: "chat-access-contract", path: "scripts/test_chat_access_contract.ts" },
  { label: "confirm-email-pending-contract", path: "scripts/test_confirm_email_pending_contract.ts" },
  { label: "activity-form-contract", path: "scripts/test_activity_form_contract.ts" },
  { label: "stories-contract", path: "scripts/test_stories_contract.ts" },
  { label: "story-views-contract", path: "scripts/test_story_views_contract.ts" },
  { label: "gamification-contract", path: "scripts/test_gamification_contract.ts" },
  { label: "gamification-report", path: "scripts/test_volunteer_report.ts" },
  { label: "npo-report-quick-wins", path: "scripts/test_npo_report_quick_wins.ts" },
  { label: "smart-match-compatibility", path: "scripts/test_smart_match_compatibility_contract.ts" },
  { label: "smart-match-reason-consistency", path: "scripts/test_smart_match_reason_consistency_contract.ts" },
  { label: "category-colors-contract", path: "scripts/test_category_colors_contract.ts" },
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
  { label: "skills-taxonomy-contract", path: "scripts/test_skills_taxonomy_contract.ts" },
  { label: "activity-organizer-onboarding-contract", path: "scripts/test_activity_organizer_and_onboarding_contract.ts" },
  { label: "application-success-contract", path: "scripts/test_application_success_contract.ts" },
  { label: "activity-cancel-contract", path: "scripts/test_activity_cancel_contract.ts" },
  { label: "review-application-contract", path: "scripts/test_review_application_contract.ts" },
  { label: "service-query-timeout-contract", path: "scripts/test_service_query_timeout_contract.ts" },
  { label: "feedback-ui-convention-contract", path: "scripts/test_feedback_ui_convention_contract.ts" },
  { label: "help-center-freshness-contract", path: "scripts/test_help_center_freshness_contract.ts" },
  { label: "css-import-typing-contract", path: "scripts/test_css_import_typing_contract.ts" },
  { label: "review-no-time-limit-contract", path: "scripts/test_review_no_time_limit_contract.ts" },
  { label: "css-interop-stringify-patch-contract", path: "scripts/test_css_interop_stringify_patch_contract.ts" },
  { label: "auth-timeout-telemetry-contract", path: "scripts/test_auth_timeout_telemetry_contract.ts" },
  { label: "auth-state-change-no-deadlock-contract", path: "scripts/test_auth_state_change_no_deadlock_contract.ts" },
  { label: "join-activity-no-upsert-contract", path: "scripts/test_join_activity_no_upsert_contract.ts" },
  { label: "shared-contacts-contract", path: "scripts/test_shared_contacts_contract.ts" },
  { label: "verification-single-source-contract", path: "scripts/test_verification_single_source_contract.ts" },
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
