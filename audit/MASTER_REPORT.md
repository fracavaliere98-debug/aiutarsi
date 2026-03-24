# MASTER AUDIT REPORT

*Generated on: 3/24/2026, 8:20:40 AM*

## 1. Data Schema & RLS
# RLS Security Audit

| Table | RLS | Policy | Action | Roles | Logic |
|-------|-----|--------|--------|-------|-------|
| activities | ✅ | Activities viewable by everyone | SELECT | 0 | `true` |
| activities | ✅ | NPOs can manage own activities | ALL | 0 | `(auth.uid() = npo_id)` |
| activity_participants | ✅ | NPO can manage participants | ALL | 0 | `(EXISTS ( SELECT 1
   FROM activities
  WHERE ((activities.id = activity_participants.activity_id) AND (activities.npo_id = auth.uid()))))` |
| activity_participants | ✅ | Participants can update own status | UPDATE | 0 | `(auth.uid() = user_id)` |
| activity_participants | ✅ | Participants viewable by everyone | SELECT | 0 | `true` |
| activity_participants | ✅ | Volunteers can join | INSERT | 0 | `(auth.uid() = user_id)` |
| activity_participants | ✅ | Volunteers can leave activities | DELETE | 16481 | `(auth.uid() = user_id)` |
| activity_skills | ✅ | Activity skills viewable by everyone | SELECT | 0 | `true` |
| activity_skills | ✅ | NPOs can manage activity skills | ALL | 0 | `(EXISTS ( SELECT 1
   FROM activities
  WHERE ((activities.id = activity_skills.activity_id) AND (activities.npo_id = auth.uid()))))` |
| admin_audit_logs | ✅ | admin_read_audit_logs | SELECT | 0 | `(((auth.jwt() -> 'user_metadata'::text) ->> 'role'::text) = 'ADMIN'::text)` |
| applications | ✅ | Applications viewable by NPO and Volunteer | SELECT | 0 | `((auth.uid() = npo_id) OR (auth.uid() = volunteer_id))` |
| applications | ✅ | NPOs can update status | UPDATE | 0 | `(auth.uid() = npo_id)` |
| applications | ✅ | Volunteers can apply | INSERT | 0 | `(auth.uid() = volunteer_id)` |
| blocked_users | ✅ | blocked_users_delete_own | DELETE | 0 | `(auth.uid() = blocker_id)` |
| blocked_users | ✅ | blocked_users_insert_own | INSERT | 0 | `(auth.uid() = blocker_id)` |
| blocked_users | ✅ | blocked_users_select_own | SELECT | 0 | `(auth.uid() = blocker_id)` |
| community_posts | ✅ | Authenticated users can create posts | INSERT | 16481 | `((COALESCE((((auth.jwt() -> 'user_metadata'::text) ->> 'is_banned'::text))::boolean, false) IS NOT TRUE) AND (author_id = auth.uid()))` |
| community_posts | ✅ | posts_delete_owner | DELETE | 16481 | `(auth.uid() = author_id)` |
| community_posts | ✅ | posts_insert_npo | INSERT | 16481 | `((auth.uid() = author_id) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'NPO'::user_role)))))` |
| community_posts | ✅ | posts_select | SELECT | 16481 | `true` |
| community_reports | ✅ | Users can insert reports | INSERT | 0 | `(auth.uid() = reporter_id)` |
| conversation_participants | ✅ | Authenticated users can insert participants | INSERT | 0 | `(auth.role() = 'authenticated'::text)` |
| conversation_participants | ✅ | NPOs can manage participants in their activity group chats | ALL | 16481 | `(EXISTS ( SELECT 1
   FROM (conversations c
     JOIN activities a ON ((a.id = c.activity_id)))
  WHERE ((c.id = conversation_participants.conversation_id) AND (a.npo_id = auth.uid()))))` |
| conversation_participants | ✅ | NPOs can view participants of their activity group chats | SELECT | 16481 | `(EXISTS ( SELECT 1
   FROM (conversations c
     JOIN activities a ON ((a.id = c.activity_id)))
  WHERE ((c.id = conversation_participants.conversation_id) AND (a.npo_id = auth.uid()))))` |
| conversation_participants | ✅ | Users can leave their own conversations | DELETE | 16481 | `(auth.uid() = user_id)` |
| conversation_participants | ✅ | Users can update their own notification preference | UPDATE | 0 | `(auth.uid() = user_id)` |
| conversation_participants | ✅ | Users can update their own participant read receipts | UPDATE | 0 | `(user_id = auth.uid())` |
| conversation_participants | ✅ | Users can view participants of their conversations | SELECT | 0 | `(conversation_id IN ( SELECT get_my_conversations() AS get_my_conversations))` |
| conversations | ✅ | Authenticated users can insert conversations | INSERT | 0 | `(auth.role() = 'authenticated'::text)` |
| conversations | ✅ | Users can view conversations they are part of | SELECT | 0 | `((created_by = auth.uid()) OR (id IN ( SELECT get_my_conversations() AS get_my_conversations)))` |
| faq_feedback | ✅ | Admins can read faq feedback | SELECT | 16481 | `(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'ADMIN'::user_role))))` |
| faq_feedback | ✅ | Users can insert faq feedback | INSERT | 16481 | `true` |
| gamification_state | ✅ | Authenticated users can view all gamification states | SELECT | 16481 | `true` |
| internal_secrets | ✅ | *NONE* | - | - | `-` |
| levels | ❌ | *NONE* | - | - | `-` |
| messages | ✅ | Participants can insert messages | INSERT | 16481 | `((COALESCE((((auth.jwt() -> 'user_metadata'::text) ->> 'is_banned'::text))::boolean, false) IS NOT TRUE) AND (sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid())))))` |
| messages | ✅ | Users can view messages in their conversations | SELECT | 0 | `(conversation_id IN ( SELECT get_my_conversations() AS get_my_conversations))` |
| messages | ✅ | messages_delete_own | DELETE | 0 | `(sender_id = auth.uid())` |
| messages | ✅ | messages_insert_participants | INSERT | 0 | `((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid())))))` |
| messages | ✅ | messages_no_send_if_blocked | INSERT | 0 | `(NOT (EXISTS ( SELECT 1
   FROM (blocked_users bu
     JOIN conversation_participants cp ON (((cp.conversation_id = messages.conversation_id) AND (cp.user_id <> auth.uid()))))
  WHERE ((bu.blocker_id = cp.user_id) AND (bu.blocked_id = auth.uid())))))` |
| messages | ✅ | messages_select_participants | SELECT | 0 | `(EXISTS ( SELECT 1
   FROM conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid()))))` |
| notification_logs | ✅ | Users can view their own notification logs | SELECT | 0 | `(auth.uid() = user_id)` |
| notifications | ✅ | System/Trigger insert | INSERT | 0 | `true` |
| notifications | ✅ | Users can mark read (update) | UPDATE | 0 | `(auth.uid() = user_id)` |
| notifications | ✅ | Users view own notifications | SELECT | 0 | `(auth.uid() = user_id)` |
| npo_followers | ✅ | Followers viewable by everyone | SELECT | 0 | `true` |
| npo_followers | ✅ | Users can follow | INSERT | 0 | `(auth.uid() = follower_id)` |
| npo_followers | ✅ | Users can unfollow | DELETE | 0 | `(auth.uid() = follower_id)` |
| post_reactions | ✅ | reactions_delete | DELETE | 16481 | `(auth.uid() = user_id)` |
| post_reactions | ✅ | reactions_insert | INSERT | 16481 | `(auth.uid() = user_id)` |
| post_reactions | ✅ | reactions_select | SELECT | 16481 | `true` |
| profiles | ✅ | Public profiles are viewable by everyone except admins. | SELECT | 0 | `((role <> 'ADMIN'::user_role) OR (id = auth.uid()) OR (((auth.jwt() -> 'user_metadata'::text) ->> 'role'::text) = 'ADMIN'::text))` |
| profiles | ✅ | Users can insert their own profile. | INSERT | 0 | `(auth.uid() = id)` |
| profiles | ✅ | Users can update own profile. | UPDATE | 0 | `(auth.uid() = id)` |
| reports | ✅ | reports_insert_auth | INSERT | 0 | `true` |
| reports | ✅ | reports_select_admin | SELECT | 16481 | `(((auth.jwt() -> 'user_metadata'::text) ->> 'role'::text) = 'ADMIN'::text)` |
| reports | ✅ | reports_update_admin | UPDATE | 16481 | `(((auth.jwt() -> 'user_metadata'::text) ->> 'role'::text) = 'ADMIN'::text)` |
| reviews | ✅ | Reviews are visible to everyone | SELECT | 0 | `true` |
| reviews | ✅ | Volunteers can delete their reviews | DELETE | 0 | `(auth.uid() = volunteer_id)` |
| reviews | ✅ | Volunteers can insert reviews | INSERT | 0 | `(auth.uid() = volunteer_id)` |
| reviews | ✅ | Volunteers can update their reviews | UPDATE | 0 | `(auth.uid() = volunteer_id)` |
| spatial_ref_sys | ❌ | *NONE* | - | - | `-` |
| stories | ✅ | stories_delete_owner | DELETE | 16481 | `(auth.uid() = author_id)` |
| stories | ✅ | stories_insert_npo | INSERT | 16481 | `((auth.uid() = author_id) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'NPO'::user_role)))))` |
| stories | ✅ | stories_select_active | SELECT | 16481 | `(expires_at > now())` |
| user_interests | ✅ | Interests viewable by everyone | SELECT | 0 | `true` |
| user_interests | ✅ | Users can manage own interests | ALL | 0 | `(auth.uid() = user_id)` |
| user_skills | ✅ | Skills viewable by everyone | SELECT | 0 | `true` |
| user_skills | ✅ | Users can manage own skills | ALL | 0 | `(auth.uid() = user_id)` |
| verification_requests | ✅ | Admins can update verification requests | UPDATE | 16481 | `(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'ADMIN'::user_role))))` |
| verification_requests | ✅ | Admins can view all verification requests | SELECT | 16481 | `(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'ADMIN'::user_role))))` |
| verification_requests | ✅ | Users can create their own requests | INSERT | 0 | `(auth.uid() = user_id)` |
| verification_requests | ✅ | Users can view their own requests | SELECT | 0 | `(auth.uid() = user_id)` |
| volunteer_reviews | ✅ | NPOs can delete their volunteer reviews | DELETE | 0 | `(auth.uid() = npo_id)` |
| volunteer_reviews | ✅ | NPOs can insert volunteer reviews | INSERT | 0 | `(auth.uid() = npo_id)` |
| volunteer_reviews | ✅ | NPOs can update their volunteer reviews | UPDATE | 0 | `(auth.uid() = npo_id)` |
| volunteer_reviews | ✅ | Volunteer reviews are visible to everyone | SELECT | 0 | `true` |


--- 

## 2. UI/UX Routes & Guards
# UI/UX Routes & Guards

| Route Path | Layout/Guard | Type |
|------------|--------------|------|
| /(auth) | Layout Group | Group |
| /(auth)/login | Standard | Page |
| /(auth)/register/corporate | Standard | Page |
| /(auth)/register/npo | Standard | Page |
| /(auth)/register/volunteer | Standard | Page |
| /(corporate) | Layout Group | Group |
| /(corporate)/catalog | Standard | Page |
| /(corporate)/employees | Standard | Page |
| /(corporate)/ | Standard | Page |
| /(corporate)/profile | Standard | Page |
| /(npo) | Layout Group | Group |
| /(tabs) | Layout Group | Group |
| /(npo)/(tabs)/community | Standard | Page |
| /(npo)/(tabs)/ | Standard | Page |
| /(npo)/(tabs)/profile | Standard | Page |
| /(npo)/(tabs)/projects | Standard | Page |
| /(npo)/(tabs)/volunteers | Standard | Page |
| /(npo)/create-activity | Standard | Page |
| /(npo)/edit-activity/[id] | Standard | Page |
| /(npo)/edit-profile | Standard | Page |
| /(npo)/interests-skills | Standard | Page |
| /(npo)/notifications | Standard | Page |
| /(npo)/referent-details | Standard | Page |
| /(npo)/review-volunteers/[id] | Standard | Page |
| /(npo)/reviews | Standard | Page |
| /(npo)/security | Standard | Page |
| /(npo)/settings/edit-profile | Standard | Page |
| /(npo)/settings/privacy | Standard | Page |
| /(npo)/settings/security | Standard | Page |
| /(npo)/volunteer-profile/[id] | Standard | Page |
| /(volunteer) | Layout Group | Group |
| /(tabs) | Layout Group | Group |
| /(volunteer)/(tabs)/calendar | Standard | Page |
| /(volunteer)/(tabs)/community | Standard | Page |
| /(volunteer)/(tabs)/ | Standard | Page |
| /(volunteer)/(tabs)/map | Standard | Page |
| /(volunteer)/(tabs)/profile | Standard | Page |
| /(volunteer)/(tabs)/search | Standard | Page |
| /(volunteer)/application-success | Standard | Page |
| /(volunteer)/interests-skills | Standard | Page |
| /(volunteer)/my-reviews | Standard | Page |
| /(volunteer)/notifications | Standard | Page |
| /(volunteer)/privacy | Standard | Page |
| /(volunteer)/referral | Standard | Page |
| /(volunteer)/review-application | Standard | Page |
| /(volunteer)/settings | Standard | Page |
| /activity/[id] | Standard | Page |
| /(tabs) | Layout Group | Group |
| /admin/(tabs)/faq-feedback | Standard | Page |
| /admin/(tabs)/ | Standard | Page |
| /admin/(tabs)/settings | Standard | Page |
| /admin/(tabs)/verifications | Standard | Page |
| /admin/report/[id] | Standard | Page |
| /admin/verification/[id] | Standard | Page |
| /blocked-users | Standard | Page |
| /community/create-post | Standard | Page |
| /feedback/[id] | Standard | Page |
| /help-center | Standard | Page |
| / | Standard | Page |
| /messages/[id] | Standard | Page |
| /messages/ | Standard | Page |
| /npo-profile/[id] | Standard | Page |
| /onboarding/interests | Standard | Page |
| /onboarding/intro | Standard | Page |
| /onboarding/npo-category | Standard | Page |
| /onboarding/npo-details | Standard | Page |
| /onboarding/npo-preview | Standard | Page |
| /onboarding/npo-referent | Standard | Page |
| /onboarding/npo-skills | Standard | Page |
| /onboarding/npo-verification | Standard | Page |
| /onboarding/profile | Standard | Page |
| /onboarding/skills | Standard | Page |
| /onboarding/welcome | Standard | Page |
| /user-profile/[id] | Standard | Page |


--- 

## 3. Logic Flow & Edge Functions
# Edge Functions & Logic Flow

| Function Name | Trigger (Inferred) | External APIs |
|---------------|-------------------|---------------|
| activity-curator-ai | HTTP Request | https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash |
| auth-hook | HTTP Request | None |
| community-moderator-ai | HTTP Request | None |
| gemma-help-assistant | HTTP Request | https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction, https://router.huggingface.co/v1/chat/completions |
| generate-embedding | HTTP Request | https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction |
| image-optimizer | HTTP Request | None |
| push-notifications | DB Webhook | https://exp.host/--/api/v2/push/send |


--- 

## 4. API Documentation
> [Full Docs Here](./api_docs.md)

# API Documentation (OpenAPI)

Summarized from Supabase PostgREST.

**External URL:** https://pavnfiladmnwbptwlwpr.supabase.co/rest/v1/

### /
- **GET**: OpenAPI description (this document)

### /activities
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /activity_participants
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /activity_skills
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /admin_audit_logs
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /app_spatial_ref_sys
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /applications
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /blocked_users
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summa...

--- 

## 5. Dependency Graph
# Dependency Graph

```mermaid
graph TD
    "app/_layout.tsx" -.-> "@expo-google-fonts"
    "app/_layout.tsx" --> "AuthContext"
    "app/_layout.tsx" --> "ActivityContext"
    "app/_layout.tsx" --> "NotificationContext"
    "app/_layout.tsx" --> "ApplicationContext"
    "app/_layout.tsx" --> "GamificationContext"
    "app/_layout.tsx" --> "ToastContext"
    "app/_layout.tsx" --> "SmartMatchContext"
    "app/_layout.tsx" --> "ChatContext"
    "app/_layout.tsx" --> "CommunityContext"
    "app/_layout.tsx" --> "StoriesContext"
    "app/_layout.tsx" --> "Toast"
    "app/_layout.tsx" --> "LevelUpOverlay"
    "app/_layout.tsx" --> "ErrorBoundary"
    "app/_layout.tsx" --> "QueryProvider"
    "app/_layout.tsx" --> "usePushNotifications"
    "app/_layout.tsx" --> "BannedScreen"
    "app/blocked-users.tsx" -.-> "lucide-react-native"
    "app/blocked-users.tsx" --> "supabase"
    "app/blocked-users.tsx" --> "AuthContext"
    "app/blocked-users.tsx" --> "StandardLayout"
    "app/blocked-users.tsx" --> "SoftCard"
    "app/blocked-users.tsx" --> "UserAvatar"
    "app/blocked-users.tsx" --> "Colors"
    "app/blocked-users.tsx" --> "ToastContext"
    "app/help-center.tsx" -.-> "lucide-react-native"
    "app/help-center.tsx" --> "StandardLayout"
    "app/help-center.tsx" --> "SoftCard"
    "app/help-center.tsx" --> "Colors"
    "app/help-center.tsx" --> "GemmaAIChat"
    "app/help-center.tsx" --> "supabase"
    "app/index.tsx" -.-> "lucide-react-native"
    "app/index.tsx" --> "Colors"
    "app/index.tsx" --> "AuthService"
    "app/index.tsx" --> "ActivityService"
    "app/index.tsx" --> "types"
    "app/(auth)/login.tsx" --> "ScreenWrapper"
    "app/(auth)/login.tsx" --> "Colors"
    "app/(auth)/login.tsx" --> "AuthContext"
    "app/(auth)/login.tsx" -.-> "lucide-react-native"
    "app/(auth)/login.tsx" --> "Button"
    "app/(corporate)/_layout.tsx" -.-> "lucide-react-native"
    "app/(corporate)/_layout.tsx" --> "Colors"
    "app/(corporate)/catalog.tsx" --> "ActivityContext"
    "app/(corporate)/catalog.tsx" -.-> "lucide-react-native"
    "app/(corporate)/catalog.tsx" --> "Colors"
    "app/(corporate)/catalog.tsx" --> "Card"
    "app/(corporate)/catalog.tsx" --> "StandardLayout"
    "app/(corporate)/employees.tsx" -.-> "lucide-react-native"
    "app/(corporate)/employees.tsx" --> "Colors"
    "app/(corporate)/employees.tsx" --> "Card"
    "app/(corporate)/employees.tsx" --> "StandardLayout"
    "app/(corporate)/index.tsx" --> "AuthContext"
    "app/(corporate)/index.tsx" -.-> "lucide-react-native"
    "app/(corporate)/index.tsx" --> "Colors"
    "app/(corporate)/index.tsx" --> "Card"
    "app/(corporate)/index.tsx" --> "UserAvatar"
    "app/(corporate)/index.tsx" --> "StandardLayout"
    "app/(corporate)/profile.tsx" --> "AuthContext"
    "app/(corporate)/profile.tsx" --> "UserAvatar"
    "app/(corporate)/profile.tsx" -.-> "lucide-react-native"
    "app/(corporate)/profile.tsx" --> "Card"
    "app/(corporate)/profile.tsx" --> "StandardLayout"
    "app/(npo)/create-activity.tsx" --> "ActivityContext"
    "app/(npo)/create-activity.tsx" --> "AuthContext"
    "app/(npo)/create-activity.tsx" --> "ToastContext"
    "app/(npo)/create-activity.tsx" --> "Colors"
    "app/(npo)/create-activity.tsx" -.-> "lucide-react-native"
    "app/(npo)/create-activity.tsx" --> "StandardLayout"
    "app/(npo)/create-activity.tsx" --> "AddressAutocomplete"
    "app/(npo)/create-activity.tsx" --> "CalendarPicker"
    "app/(npo)/create-activity.tsx" --> "Skills"
    "app/(npo)/edit-profile.tsx" -.-> "lucide-react-native"
    "app/(npo)/edit-profile.tsx" --> "StandardLayout"
    "app/(npo)/edit-profile.tsx" --> "SoftCard"
    "app/(npo)/edit-profile.tsx" --> "UserAvatar"
    "app/(npo)/edit-profile.tsx" --> "AuthContext"
    "app/(npo)/edit-profile.tsx" --> "ToastContext"
    "app/(npo)/edit-profile.tsx" --> "Colors"
    "app/(npo)/interests-skills.tsx" --> "StandardLayout"
    "app/(npo)/interests-skills.tsx" --> "AuthContext"
    "app/(npo)/interests-skills.tsx" --> "Colors"
    "app/(npo)/interests-skills.tsx" -.-> "lucide-react-native"
    "app/(npo)/interests-skills.tsx" --> "Skills"
    "app/(npo)/interests-skills.tsx" --> "ToastContext"
    "app/(npo)/notifications.tsx" --> "AuthContext"
    "app/(npo)/notifications.tsx" --> "NotificationContext"
    "app/(npo)/notifications.tsx" --> "StandardLayout"
    "app/(npo)/notifications.tsx" --> "SoftCard"
    "app/(npo)/notifications.tsx" --> "EmptyState"
    "app/(npo)/notifications.tsx" -.-> "lucide-react-native"
    "app/(npo)/notifications.tsx" --> "Colors"
    "app/(npo)/notifications.tsx" --> "ToastContext"
    "app/(npo)/referent-details.tsx" --> "StandardLayout"
    "app/(npo)/referent-details.tsx" --> "AuthContext"
    "app/(npo)/referent-details.tsx" --> "Colors"
    "app/(npo)/referent-details.tsx" -.-> "lucide-react-native"
    "app/(npo)/referent-details.tsx" --> "ToastContext"
    "app/(npo)/referent-details.tsx" --> "UserAvatar"
    "app/(npo)/reviews.tsx" --> "StandardLayout"
    "app/(npo)/reviews.tsx" --> "ActivityContext"
    "app/(npo)/reviews.tsx" --> "AuthContext"
    "app/(npo)/reviews.tsx" -.-> "lucide-react-native"
    "app/(npo)/reviews.tsx" --> "Colors"
    "app/(npo)/reviews.tsx" --> "EmptyState"
    "app/(npo)/reviews.tsx" --> "UserAvatar"
    "app/(npo)/security.tsx" -.-> "lucide-react-native"
    "app/(npo)/security.tsx" --> "StandardLayout"
    "app/(npo)/security.tsx" --> "SoftCard"
    "app/(npo)/security.tsx" --> "AuthContext"
    "app/(npo)/security.tsx" --> "ToastContext"
    "app/(npo)/security.tsx" --> "Colors"
    "app/(npo)/security.tsx" --> "AuthService"
    "app/(volunteer)/_layout.tsx" --> "AuthContext"
    "app/(volunteer)/_layout.tsx" --> "Colors"
    "app/(volunteer)/application-success.tsx" -.-> "lucide-react-native"
    "app/(volunteer)/application-success.tsx" --> "Colors"
    "app/(volunteer)/interests-skills.tsx" --> "StandardLayout"
    "app/(volunteer)/interests-skills.tsx" --> "AuthContext"
    "app/(volunteer)/interests-skills.tsx" --> "Colors"
    "app/(volunteer)/interests-skills.tsx" -.-> "lucide-react-native"
    "app/(volunteer)/interests-skills.tsx" --> "Skills"
    "app/(volunteer)/my-reviews.tsx" --> "StandardLayout"
    "app/(volunteer)/my-reviews.tsx" --> "ActivityContext"
    "app/(volunteer)/my-reviews.tsx" --> "AuthContext"
    "app/(volunteer)/my-reviews.tsx" --> "Colors"
    "app/(volunteer)/my-reviews.tsx" -.-> "lucide-react-native"
    "app/(volunteer)/my-reviews.tsx" --> "EmptyState"
    "app/(volunteer)/my-reviews.tsx" --> "UserAvatar"
    "app/(volunteer)/notifications.tsx" -.-> "lucide-react-native"
    "app/(volunteer)/notifications.tsx" --> "Colors"
    "app/(volunteer)/notifications.tsx" --> "StandardLayout"
    "app/(volunteer)/notifications.tsx" --> "NotificationContext"
    "app/(volunteer)/notifications.tsx" --> "SoftCard"
    "app/(volunteer)/notifications.tsx" --> "EmptyState"
    "app/(volunteer)/notifications.tsx" --> "ToastContext"
    "app/(volunteer)/privacy.tsx" -.-> "lucide-react-native"
    "app/(volunteer)/privacy.tsx" --> "StandardLayout"
    "app/(volunteer)/privacy.tsx" --> "SoftCard"
    "app/(volunteer)/privacy.tsx" --> "AuthContext"
    "app/(volunteer)/privacy.tsx" --> "ToastContext"
    "app/(volunteer)/privacy.tsx" --> "supabase"
    "app/(volunteer)/privacy.tsx" --> "Colors"
    "app/(volunteer)/referral.tsx" --> "AuthContext"
    "app/(volunteer)/referral.tsx" --> "StandardLayout"
    "app/(volunteer)/referral.tsx" --> "SoftCard"
    "app/(volunteer)/referral.tsx" --> "Colors"
    "app/(volunteer)/referral.tsx" -.-> "lucide-react-native"
    "app/(volunteer)/review-application.tsx" -.-> "lucide-react-native"
    "app/(volunteer)/review-application.tsx" --> "AuthContext"
    "app/(volunteer)/review-application.tsx" --> "ActivityContext"
    "app/(volunteer)/review-application.tsx" --> "ApplicationContext"
    "app/(volunteer)/review-application.tsx" --> "Colors"
    "app/(volunteer)/review-application.tsx" --> "UserAvatar"
    "app/(volunteer)/settings.tsx" --> "Colors"
    "app/(volunteer)/settings.tsx" --> "AuthContext"
    "app/(volunteer)/settings.tsx" -.-> "lucide-react-native"
    "app/(volunteer)/settings.tsx" --> "StandardLayout"
    "app/(volunteer)/settings.tsx" --> "SoftCard"
    "app/(volunteer)/settings.tsx" --> "UserAvatar"
    "app/(volunteer)/settings.tsx" --> "ActivityContext"
    "app/(volunteer)/settings.tsx" --> "ApplicationContext"
    "app/(volunteer)/settings.tsx" --> "ToastContext"
    "app/activity/[id].tsx" --> "ActivityContext"
    "app/activity/[id].tsx" --> "AuthContext"
    "app/activity/[id].tsx" --> "GamificationContext"
    "app/activity/[id].tsx" --> "ApplicationContext"
    "app/activity/[id].tsx" --> "ToastContext"
    "app/activity/[id].tsx" --> "ActivityService"
    "app/activity/[id].tsx" --> "types"
    "app/activity/[id].tsx" --> "Colors"
    "app/activity/[id].tsx" -.-> "lucide-react-native"
    "app/activity/[id].tsx" --> "UserAvatar"
    "app/activity/[id].tsx" --> "ErrorState"
    "app/activity/[id].tsx" --> "supabase"
    "app/activity/[id].tsx" --> "Skills"
    "app/admin/_layout.tsx" --> "AuthContext"
    "app/community/create-post.tsx" -.-> "lucide-react-native"
    "app/community/create-post.tsx" --> "Colors"
    "app/community/create-post.tsx" --> "CommunityContext"
    "app/community/create-post.tsx" --> "StoriesContext"
    "app/community/create-post.tsx" --> "ActivityContext"
    "app/community/create-post.tsx" --> "AuthContext"
    "app/community/create-post.tsx" --> "ToastContext"
    "app/feedback/[id].tsx" --> "ActivityContext"
    "app/feedback/[id].tsx" --> "AuthContext"
    "app/feedback/[id].tsx" --> "ToastContext"
    "app/feedback/[id].tsx" --> "Colors"
    "app/feedback/[id].tsx" -.-> "lucide-react-native"
    "app/feedback/[id].tsx" --> "ScreenWrapper"
    "app/messages/[id].tsx" -.-> "lucide-react-native"
    "app/messages/[id].tsx" --> "ChatBubble"
    "app/messages/[id].tsx" --> "Colors"
    "app/messages/[id].tsx" --> "ChatService"
    "app/messages/[id].tsx" --> "AuthContext"
    "app/messages/[id].tsx" --> "ChatContext"
    "app/messages/[id].tsx" --> "supabase"
    "app/messages/[id].tsx" --> "ToastContext"
    "app/messages/[id].tsx" --> "ReportModal"
    "app/messages/index.tsx" -.-> "lucide-react-native"
    "app/messages/index.tsx" --> "ConversationListItem"
    "app/messages/index.tsx" --> "ChatContext"
    "app/messages/index.tsx" --> "Colors"
    "app/messages/index.tsx" --> "AuthContext"
    "app/messages/index.tsx" --> "ChatService"
    "app/messages/index.tsx" --> "ToastContext"
    "app/messages/index.tsx" --> "StandardLayout"
    "app/npo-profile/[id].tsx" --> "AuthContext"
    "app/npo-profile/[id].tsx" --> "ActivityContext"
    "app/npo-profile/[id].tsx" --> "ApplicationContext"
    "app/npo-profile/[id].tsx" --> "ToastContext"
    "app/npo-profile/[id].tsx" --> "types"
    "app/npo-profile/[id].tsx" --> "supabase"
    "app/npo-profile/[id].tsx" -.-> "lucide-react-native"
    "app/npo-profile/[id].tsx" --> "StandardLayout"
    "app/npo-profile/[id].tsx" --> "UserAvatar"
    "app/npo-profile/[id].tsx" --> "SoftCard"
    "app/npo-profile/[id].tsx" --> "StatCard"
    "app/npo-profile/[id].tsx" --> "BadgePill"
    "app/npo-profile/[id].tsx" --> "ActivityCard"
    "app/npo-profile/[id].tsx" --> "Colors"
    "app/npo-profile/[id].tsx" --> "ChatService"
    "app/npo-profile/[id].tsx" --> "ReportModal"
    "app/onboarding/_layout.tsx" --> "Colors"
    "app/onboarding/_layout.tsx" --> "AuthContext"
    "app/onboarding/interests.tsx" -.-> "@react-native-async-storage"
    "app/onboarding/interests.tsx" --> "Colors"
    "app/onboarding/interests.tsx" --> "AuthContext"
    "app/onboarding/interests.tsx" --> "ToastContext"
    "app/onboarding/interests.tsx" -.-> "lucide-react-native"
    "app/onboarding/intro.tsx" -.-> "lucide-react-native"
    "app/onboarding/intro.tsx" --> "Colors"
    "app/onboarding/intro.tsx" --> "AuthContext"
    "app/onboarding/npo-category.tsx" --> "Colors"
    "app/onboarding/npo-category.tsx" --> "AuthContext"
    "app/onboarding/npo-category.tsx" -.-> "lucide-react-native"
    "app/onboarding/npo-details.tsx" --> "Colors"
    "app/onboarding/npo-details.tsx" --> "AuthContext"
    "app/onboarding/npo-details.tsx" --> "ToastContext"
    "app/onboarding/npo-details.tsx" -.-> "lucide-react-native"
    "app/onboarding/npo-details.tsx" --> "AddressAutocomplete"
    "app/onboarding/npo-details.tsx" --> "UserAvatar"
    "app/onboarding/npo-preview.tsx" --> "Colors"
    "app/onboarding/npo-preview.tsx" --> "AuthContext"
    "app/onboarding/npo-preview.tsx" -.-> "lucide-react-native"
    "app/onboarding/npo-preview.tsx" --> "UserAvatar"
    "app/onboarding/npo-referent.tsx" --> "Colors"
    "app/onboarding/npo-referent.tsx" --> "AuthContext"
    "app/onboarding/npo-referent.tsx" --> "ToastContext"
    "app/onboarding/npo-referent.tsx" -.-> "lucide-react-native"
    "app/onboarding/npo-referent.tsx" --> "UserAvatar"
    "app/onboarding/npo-skills.tsx" --> "Colors"
    "app/onboarding/npo-skills.tsx" --> "AuthContext"
    "app/onboarding/npo-skills.tsx" -.-> "lucide-react-native"
    "app/onboarding/npo-skills.tsx" --> "Skills"
    "app/onboarding/npo-verification.tsx" --> "Colors"
    "app/onboarding/npo-verification.tsx" --> "AuthContext"
    "app/onboarding/npo-verification.tsx" --> "ToastContext"
    "app/onboarding/npo-verification.tsx" -.-> "lucide-react-native"
    "app/onboarding/npo-verification.tsx" --> "StorageService"
    "app/onboarding/npo-verification.tsx" --> "AuthService"
    "app/onboarding/profile.tsx" --> "ScreenWrapper"
    "app/onboarding/profile.tsx" --> "AuthContext"
    "app/onboarding/profile.tsx" --> "ToastContext"
    "app/onboarding/profile.tsx" --> "Colors"
    "app/onboarding/profile.tsx" -.-> "lucide-react-native"
    "app/onboarding/profile.tsx" -.-> "@react-native-async-storage"
    "app/onboarding/profile.tsx" --> "AuthService"
    "app/onboarding/skills.tsx" --> "ScreenWrapper"
    "app/onboarding/skills.tsx" --> "AuthContext"
    "app/onboarding/skills.tsx" --> "Colors"
    "app/onboarding/skills.tsx" -.-> "lucide-react-native"
    "app/onboarding/skills.tsx" --> "Skills"
    "app/onboarding/welcome.tsx" --> "ScreenWrapper"
    "app/onboarding/welcome.tsx" --> "Colors"
    "app/onboarding/welcome.tsx" --> "AuthContext"
    "app/onboarding/welcome.tsx" -.-> "lucide-react-native"
    "app/onboarding/welcome.tsx" --> "UserAvatar"
    "app/user-profile/[id].tsx" --> "AuthContext"
    "app/user-profile/[id].tsx" --> "types"
    "app/(auth)/register/_layout.tsx" --> "Colors"
    "app/(auth)/register/_layout.tsx" -.-> "lucide-react-native"
    "app/(auth)/register/corporate.tsx" --> "AuthContext"
    "app/(auth)/register/corporate.tsx" --> "ScreenWrapper"
    "app/(auth)/register/npo.tsx" --> "AuthContext"
    "app/(auth)/register/npo.tsx" --> "ToastContext"
    "app/(auth)/register/npo.tsx" --> "ScreenWrapper"
    "app/(auth)/register/volunteer.tsx" --> "AuthContext"
    "app/(auth)/register/volunteer.tsx" --> "ToastContext"
    "app/(auth)/register/volunteer.tsx" --> "ScreenWrapper"
    "app/(npo)/(tabs)/_layout.tsx" -.-> "lucide-react-native"
    "app/(npo)/(tabs)/_layout.tsx" --> "Colors"
    "app/(npo)/(tabs)/community.tsx" --> "community"
    "app/(npo)/(tabs)/index.tsx" --> "AuthContext"
    "app/(npo)/(tabs)/index.tsx" --> "ActivityContext"
    "app/(npo)/(tabs)/index.tsx" -.-> "lucide-react-native"
    "app/(npo)/(tabs)/index.tsx" --> "Colors"
    "app/(npo)/(tabs)/index.tsx" --> "StatCard"
    "app/(npo)/(tabs)/index.tsx" --> "ActivityCard"
    "app/(npo)/(tabs)/index.tsx" --> "StandardLayout"
    "app/(npo)/(tabs)/index.tsx" --> "EmptyState"
    "app/(npo)/(tabs)/index.tsx" --> "ApplicationContext"
    "app/(npo)/(tabs)/index.tsx" --> "NotificationContext"
    "app/(npo)/(tabs)/index.tsx" --> "NPOHeaderActions"
    "app/(npo)/(tabs)/index.tsx" --> "UserAvatar"
    "app/(npo)/(tabs)/index.tsx" --> "useNPOInsights"
    "app/(npo)/(tabs)/index.tsx" --> "InsightCarousel"
    "app/(npo)/(tabs)/profile.tsx" -.-> "lucide-react-native"
    "app/(npo)/(tabs)/profile.tsx" --> "SoftCard"
    "app/(npo)/(tabs)/profile.tsx" --> "StandardLayout"
    "app/(npo)/(tabs)/profile.tsx" --> "Colors"
    "app/(npo)/(tabs)/profile.tsx" --> "NPOHeaderActions"
    "app/(npo)/(tabs)/profile.tsx" --> "NotificationContext"
    "app/(npo)/(tabs)/profile.tsx" --> "ApplicationContext"
    "app/(npo)/(tabs)/profile.tsx" --> "AuthContext"
    "app/(npo)/(tabs)/profile.tsx" --> "UserAvatar"
    "app/(npo)/(tabs)/profile.tsx" --> "edit-profile"
    "app/(npo)/(tabs)/profile.tsx" --> "interests-skills"
    "app/(npo)/(tabs)/profile.tsx" --> "referent-details"
    "app/(npo)/(tabs)/profile.tsx" --> "security"
    "app/(npo)/(tabs)/profile.tsx" --> "AccountDeletionAlert"
    "app/(npo)/(tabs)/profile.tsx" --> "ToastContext"
    "app/(npo)/(tabs)/projects.tsx" --> "AuthContext"
    "app/(npo)/(tabs)/projects.tsx" --> "ActivityContext"
    "app/(npo)/(tabs)/projects.tsx" -.-> "lucide-react-native"
    "app/(npo)/(tabs)/projects.tsx" --> "StandardLayout"
    "app/(npo)/(tabs)/projects.tsx" --> "EmptyState"
    "app/(npo)/(tabs)/projects.tsx" --> "CalendarGrid"
    "app/(npo)/(tabs)/projects.tsx" --> "Colors"
    "app/(npo)/(tabs)/projects.tsx" --> "ToastContext"
    "app/(npo)/(tabs)/projects.tsx" --> "NPOHeaderActions"
    "app/(npo)/(tabs)/projects.tsx" --> "ErrorState"
    "app/(npo)/(tabs)/projects.tsx" --> "ActivityCard"
    "app/(npo)/(tabs)/volunteers.tsx" -.-> "@shopify"
    "app/(npo)/(tabs)/volunteers.tsx" --> "AuthContext"
    "app/(npo)/(tabs)/volunteers.tsx" --> "ToastContext"
    "app/(npo)/(tabs)/volunteers.tsx" -.-> "lucide-react-native"
    "app/(npo)/(tabs)/volunteers.tsx" --> "StandardLayout"
    "app/(npo)/(tabs)/volunteers.tsx" --> "NPOHeaderActions"
    "app/(npo)/(tabs)/volunteers.tsx" --> "VolunteerCard"
    "app/(npo)/(tabs)/volunteers.tsx" --> "EmptyState"
    "app/(npo)/(tabs)/volunteers.tsx" --> "ErrorState"
    "app/(npo)/(tabs)/volunteers.tsx" --> "Colors"
    "app/(npo)/(tabs)/volunteers.tsx" --> "ActivityContext"
    "app/(npo)/(tabs)/volunteers.tsx" --> "ApplicationContext"
    "app/(npo)/(tabs)/volunteers.tsx" --> "NotificationContext"
    "app/(npo)/edit-activity/[id].tsx" --> "ActivityContext"
    "app/(npo)/edit-activity/[id].tsx" --> "Colors"
    "app/(npo)/edit-activity/[id].tsx" -.-> "lucide-react-native"
    "app/(npo)/edit-activity/[id].tsx" --> "StandardLayout"
    "app/(npo)/edit-activity/[id].tsx" --> "AddressAutocomplete"
    "app/(npo)/edit-activity/[id].tsx" --> "Skills"
    "app/(npo)/review-volunteers/[id].tsx" --> "StandardLayout"
    "app/(npo)/review-volunteers/[id].tsx" --> "ActivityContext"
    "app/(npo)/review-volunteers/[id].tsx" --> "AuthContext"
    "app/(npo)/review-volunteers/[id].tsx" --> "Colors"
    "app/(npo)/review-volunteers/[id].tsx" --> "UserAvatar"
    "app/(npo)/review-volunteers/[id].tsx" -.-> "lucide-react-native"
    "app/(npo)/review-volunteers/[id].tsx" --> "ToastContext"
    "app/(npo)/review-volunteers/[id].tsx" --> "EmptyState"
    "app/(npo)/settings/edit-profile.tsx" -.-> "lucide-react-native"
    "app/(npo)/settings/edit-profile.tsx" --> "StandardLayout"
    "app/(npo)/settings/edit-profile.tsx" --> "SoftCard"
    "app/(npo)/settings/edit-profile.tsx" --> "UserAvatar"
    "app/(npo)/settings/edit-profile.tsx" --> "AuthContext"
    "app/(npo)/settings/edit-profile.tsx" --> "ToastContext"
    "app/(npo)/settings/edit-profile.tsx" --> "Colors"
    "app/(npo)/settings/privacy.tsx" -.-> "lucide-react-native"
    "app/(npo)/settings/privacy.tsx" --> "StandardLayout"
    "app/(npo)/settings/privacy.tsx" --> "SoftCard"
    "app/(npo)/settings/privacy.tsx" --> "AuthContext"
    "app/(npo)/settings/privacy.tsx" --> "ToastContext"
    "app/(npo)/settings/privacy.tsx" --> "supabase"
    "app/(npo)/settings/privacy.tsx" --> "Colors"
    "app/(npo)/settings/security.tsx" -.-> "lucide-react-native"
    "app/(npo)/settings/security.tsx" --> "StandardLayout"
    "app/(npo)/settings/security.tsx" --> "SoftCard"
    "app/(npo)/settings/security.tsx" --> "AuthContext"
    "app/(npo)/settings/security.tsx" --> "ToastContext"
    "app/(npo)/settings/security.tsx" --> "Colors"
    "app/(npo)/settings/security.tsx" --> "AuthService"
    "app/(npo)/volunteer-profile/[id].tsx" --> "AuthContext"
    "app/(npo)/volunteer-profile/[id].tsx" --> "ActivityContext"
    "app/(npo)/volunteer-profile/[id].tsx" --> "ApplicationContext"
    "app/(npo)/volunteer-profile/[id].tsx" --> "GamificationContext"
    "app/(npo)/volunteer-profile/[id].tsx" --> "VolunteerProfileView"
    "app/(npo)/volunteer-profile/[id].tsx" --> "types"
    "app/(npo)/volunteer-profile/[id].tsx" --> "ChatService"
    "app/(npo)/volunteer-profile/[id].tsx" --> "ReportModal"
    "app/(volunteer)/(tabs)/_layout.tsx" -.-> "lucide-react-native"
    "app/(volunteer)/(tabs)/_layout.tsx" --> "AuthContext"
    "app/(volunteer)/(tabs)/_layout.tsx" --> "Colors"
    "app/(volunteer)/(tabs)/calendar.tsx" --> "Colors"
    "app/(volunteer)/(tabs)/calendar.tsx" --> "AuthContext"
    "app/(volunteer)/(tabs)/calendar.tsx" -.-> "lucide-react-native"
    "app/(volunteer)/(tabs)/calendar.tsx" --> "UserAvatar"
    "app/(volunteer)/(tabs)/calendar.tsx" --> "StandardLayout"
    "app/(volunteer)/(tabs)/calendar.tsx" --> "VolunteerHeaderActions"
    "app/(volunteer)/(tabs)/calendar.tsx" --> "SoftCard"
    "app/(volunteer)/(tabs)/calendar.tsx" --> "BadgePill"
    "app/(volunteer)/(tabs)/calendar.tsx" --> "ActivityContext"
    "app/(volunteer)/(tabs)/calendar.tsx" --> "types"
    "app/(volunteer)/(tabs)/calendar.tsx" --> "ToastContext"
    "app/(volunteer)/(tabs)/calendar.tsx" --> "CalendarGrid"
    "app/(volunteer)/(tabs)/calendar.tsx" --> "ActivityCard"
    "app/(volunteer)/(tabs)/calendar.tsx" --> "ErrorState"
    "app/(volunteer)/(tabs)/community.tsx" -.-> "@shopify"
    "app/(volunteer)/(tabs)/community.tsx" -.-> "lucide-react-native"
    "app/(volunteer)/(tabs)/community.tsx" --> "Colors"
    "app/(volunteer)/(tabs)/community.tsx" --> "CommunityContext"
    "app/(volunteer)/(tabs)/community.tsx" --> "AuthContext"
    "app/(volunteer)/(tabs)/community.tsx" --> "ActivityContext"
    "app/(volunteer)/(tabs)/community.tsx" --> "StoriesRow"
    "app/(volunteer)/(tabs)/community.tsx" --> "CommunityPostCard"
    "app/(volunteer)/(tabs)/community.tsx" --> "community"
    "app/(volunteer)/(tabs)/community.tsx" --> "stories"
    "app/(volunteer)/(tabs)/community.tsx" --> "types"
    "app/(volunteer)/(tabs)/community.tsx" --> "StandardLayout"
    "app/(volunteer)/(tabs)/community.tsx" --> "NPOHeaderActions"
    "app/(volunteer)/(tabs)/community.tsx" --> "VolunteerHeaderActions"
    "app/(volunteer)/(tabs)/index.tsx" -.-> "lucide-react-native"
    "app/(volunteer)/(tabs)/index.tsx" --> "Colors"
    "app/(volunteer)/(tabs)/index.tsx" --> "ActivityCard"
    "app/(volunteer)/(tabs)/index.tsx" --> "ActivityContext"
    "app/(volunteer)/(tabs)/index.tsx" --> "AuthContext"
    "app/(volunteer)/(tabs)/index.tsx" --> "UserAvatar"
    "app/(volunteer)/(tabs)/index.tsx" --> "StandardLayout"
    "app/(volunteer)/(tabs)/index.tsx" --> "VolunteerHeaderActions"
    "app/(volunteer)/(tabs)/index.tsx" --> "SoftCard"
    "app/(volunteer)/(tabs)/index.tsx" --> "StatCard"
    "app/(volunteer)/(tabs)/index.tsx" --> "BadgePill"
    "app/(volunteer)/(tabs)/index.tsx" --> "NotificationContext"
    "app/(volunteer)/(tabs)/index.tsx" --> "ToastContext"
    "app/(volunteer)/(tabs)/index.tsx" --> "ChatContext"
    "app/(volunteer)/(tabs)/index.tsx" --> "ErrorState"
    "app/(volunteer)/(tabs)/index.tsx" --> "SmartMatchCarousel"
    "app/(volunteer)/(tabs)/map.tsx" --> "UserAvatar"
    "app/(volunteer)/(tabs)/map.tsx" --> "PageHeader"
    "app/(volunteer)/(tabs)/map.tsx" --> "VolunteerHeaderActions"
    "app/(volunteer)/(tabs)/map.tsx" --> "ScreenWrapper"
    "app/(volunteer)/(tabs)/map.tsx" -.-> "lucide-react-native"
    "app/(volunteer)/(tabs)/map.tsx" --> "Colors"
    "app/(volunteer)/(tabs)/map.tsx" --> "types"
    "app/(volunteer)/(tabs)/map.tsx" --> "NotificationContext"
    "app/(volunteer)/(tabs)/map.tsx" --> "AuthContext"
    "app/(volunteer)/(tabs)/map.tsx" --> "ActivityService"
    "app/(volunteer)/(tabs)/map.tsx" --> "supabase"
    "app/(volunteer)/(tabs)/map.tsx" -.-> "@tanstack"
    "app/(volunteer)/(tabs)/map.tsx" --> "CalendarPicker"
    "app/(volunteer)/(tabs)/map.tsx" --> "Skills"
    "app/(volunteer)/(tabs)/profile.tsx" --> "AuthContext"
    "app/(volunteer)/(tabs)/profile.tsx" --> "ActivityContext"
    "app/(volunteer)/(tabs)/profile.tsx" --> "ApplicationContext"
    "app/(volunteer)/(tabs)/profile.tsx" --> "GamificationContext"
    "app/(volunteer)/(tabs)/profile.tsx" --> "VolunteerProfileView"
    "app/(volunteer)/(tabs)/search.tsx" -.-> "@shopify"
    "app/(volunteer)/(tabs)/search.tsx" --> "Colors"
    "app/(volunteer)/(tabs)/search.tsx" -.-> "lucide-react-native"
    "app/(volunteer)/(tabs)/search.tsx" --> "types"
    "app/(volunteer)/(tabs)/search.tsx" --> "AuthContext"
    "app/(volunteer)/(tabs)/search.tsx" --> "useActivities"
    "app/(volunteer)/(tabs)/search.tsx" --> "ActivityService"
    "app/(volunteer)/(tabs)/search.tsx" --> "supabase"
    "app/(volunteer)/(tabs)/search.tsx" --> "UserAvatar"
    "app/(volunteer)/(tabs)/search.tsx" --> "StandardLayout"
    "app/(volunteer)/(tabs)/search.tsx" --> "VolunteerHeaderActions"
    "app/(volunteer)/(tabs)/search.tsx" --> "SoftCard"
    "app/(volunteer)/(tabs)/search.tsx" --> "EmptyState"
    "app/(volunteer)/(tabs)/search.tsx" --> "ToastContext"
    "app/(volunteer)/(tabs)/search.tsx" --> "CalendarPicker"
    "app/(volunteer)/(tabs)/search.tsx" --> "Skills"
    "app/admin/(tabs)/_layout.tsx" -.-> "lucide-react-native"
    "app/admin/(tabs)/faq-feedback.tsx" -.-> "lucide-react-native"
    "app/admin/(tabs)/faq-feedback.tsx" --> "supabase"
    "app/admin/(tabs)/faq-feedback.tsx" --> "Colors"
    "app/admin/(tabs)/index.tsx" --> "supabase"
    "app/admin/(tabs)/index.tsx" -.-> "lucide-react-native"
    "app/admin/(tabs)/settings.tsx" --> "AuthContext"
    "app/admin/(tabs)/settings.tsx" -.-> "lucide-react-native"
    "app/admin/(tabs)/verifications.tsx" --> "supabase"
    "app/admin/(tabs)/verifications.tsx" -.-> "lucide-react-native"
    "app/admin/report/[id].tsx" --> "supabase"
    "app/admin/report/[id].tsx" --> "AuthContext"
    "app/admin/report/[id].tsx" -.-> "lucide-react-native"
    "app/admin/report/[id].tsx" --> "NotificationContext"
    "app/admin/verification/[id].tsx" --> "supabase"
    "app/admin/verification/[id].tsx" --> "AuthContext"
    "app/admin/verification/[id].tsx" -.-> "lucide-react-native"
    "app/admin/verification/[id].tsx" --> "NotificationContext"
    "components/AccountDeletionAlert.tsx" -.-> "lucide-react-native"
    "components/AccountDeletionAlert.tsx" --> "AuthContext"
    "components/AccountDeletionAlert.tsx" --> "Colors"
    "components/ActivityCard.tsx" -.-> "lucide-react-native"
    "components/ActivityCard.tsx" --> "Colors"
    "components/ActivityCard.tsx" --> "SoftCard"
    "components/ActivityCard.tsx" --> "UserAvatar"
    "components/ActivityCard.tsx" --> "AuthContext"
    "components/ActivityCard.tsx" --> "types"
    "components/ActivityMarker.tsx" -.-> "lucide-react-native"
    "components/ActivityMarker.tsx" --> "types"
    "components/ActivityMarker.tsx" --> "Colors"
    "components/AddressAutocomplete.tsx" -.-> "lucide-react-native"
    "components/AddressAutocomplete.tsx" --> "Colors"
    "components/BannedScreen.tsx" -.-> "lucide-react-native"
    "components/Button.tsx" -.-> "nativewind"
    "components/CalendarGrid.tsx" -.-> "lucide-react-native"
    "components/CalendarGrid.tsx" --> "Colors"
    "components/CalendarGrid.tsx" --> "types"
    "components/CalendarPicker.tsx" -.-> "lucide-react-native"
    "components/CalendarPicker.tsx" --> "Colors"
    "components/Card.tsx" -.-> "nativewind"
    "components/ChatBubble.tsx" --> "UserAvatar"
    "components/ChatBubble.tsx" -.-> "lucide-react-native"
    "components/ChatBubble.tsx" --> "Colors"
    "components/ChatBubble.tsx" --> "MessageRichPreview"
    "components/CommunityPostCard.tsx" -.-> "lucide-react-native"
    "components/CommunityPostCard.tsx" --> "community"
    "components/CommunityPostCard.tsx" --> "Colors"
    "components/CommunityPostCard.tsx" --> "AuthContext"
    "components/CommunityPostCard.tsx" --> "CommunityContext"
    "components/CommunityPostCard.tsx" --> "ToastContext"
    "components/CompactFollowerCard.tsx" --> "UserAvatar"
    "components/CompactFollowerCard.tsx" --> "types"
    "components/CompactFollowerCard.tsx" --> "Colors"
    "components/CompactFollowerCard.tsx" -.-> "lucide-react-native"
    "components/CompactFollowerCard.tsx" --> "SoftCard"
    "components/CompactFollowerCard.tsx" --> "GamificationContext"
    "components/ConversationListItem.tsx" --> "UserAvatar"
    "components/ConversationListItem.tsx" -.-> "lucide-react-native"
    "components/EmptyState.tsx" -.-> "lucide-react-native"
    "components/EmptyState.tsx" --> "Colors"
    "components/EnrolledActivityCard.tsx" -.-> "lucide-react-native"
    "components/EnrolledActivityCard.tsx" --> "Colors"
    "components/EnrolledActivityCard.tsx" --> "SoftCard"
    "components/EnrolledActivityCard.tsx" --> " Or wherever it"
    "components/ErrorBoundary.tsx" --> "Colors"
    "components/ErrorBoundary.tsx" -.-> "lucide-react-native"
    "components/ErrorState.tsx" -.-> "lucide-react-native"
    "components/ErrorState.tsx" --> "Colors"
    "components/GemmaAIChat.tsx" -.-> "lucide-react-native"
    "components/GemmaAIChat.tsx" --> "Colors"
    "components/GemmaAIChat.tsx" --> "supabase"
    "components/InsightCarousel.tsx" -.-> "lucide-react-native"
    "components/InsightCarousel.tsx" --> "Colors"
    "components/InsightCarousel.tsx" --> "useNPOInsights"
    "components/LevelUpOverlay.tsx" -.-> "lucide-react-native"
    "components/LevelUpOverlay.tsx" --> "Colors"
    "components/LevelUpOverlay.tsx" --> "GamificationContext"
    "components/MessageRichPreview.tsx" -.-> "lucide-react-native"
    "components/NPOActivityCard.tsx" --> "Colors"
    "components/NPOActivityCard.tsx" --> "SoftCard"
    "components/NPOActivityCard.tsx" --> "types"
    "components/NPOHeaderActions.tsx" -.-> "lucide-react-native"
    "components/NPOHeaderActions.tsx" --> "UserAvatar"
    "components/NPOHeaderActions.tsx" --> "NotificationContext"
    "components/NPOHeaderActions.tsx" --> "ChatContext"
    "components/ReportModal.tsx" -.-> "lucide-react-native"
    "components/ReportModal.tsx" --> "supabase"
    "components/ReportModal.tsx" --> "AuthContext"
    "components/ReportModal.tsx" --> "ToastContext"
    "components/ReportModal.tsx" --> "types"
    "components/SmartMatchCarousel.tsx" -.-> "lucide-react-native"
    "components/SmartMatchCarousel.tsx" --> "SmartMatchContext"
    "components/SmartMatchCarousel.tsx" --> "Colors"
    "components/SmartMatchCarousel.tsx" --> "types"
    "components/SoftCard.tsx" --> "useCardAnimation"
    "components/StandardLayout.tsx" --> "ScreenWrapper"
    "components/StandardLayout.tsx" -.-> "lucide-react-native"
    "components/StandardLayout.tsx" --> "AuthContext"
    "components/StoriesRow.tsx" --> "Colors"
    "components/StoriesRow.tsx" --> "StoriesContext"
    "components/StoriesRow.tsx" --> "stories"
    "components/Toast.tsx" -.-> "lucide-react-native"
    "components/Toast.tsx" --> "ToastContext"
    "components/UserAvatar.tsx" -.-> "lucide-react-native"
    "components/UserAvatar.tsx" --> "AuthContext"
    "components/UserAvatar.tsx" --> "Colors"
    "components/UserAvatar.tsx" --> "types"
    "components/VolunteerApplicationCard.tsx" --> "UserAvatar"
    "components/VolunteerApplicationCard.tsx" -.-> "lucide-react-native"
    "components/VolunteerApplicationCard.tsx" --> " Or use SoftCard if available, but plans said "Soft UI style (White card, shadow)" which Card is close to, or we can inline styles. Let"
    "components/VolunteerApplicationCard.tsx" --> "Colors"
    "components/VolunteerApplicationCard.tsx" --> "GamificationContext"
    "components/VolunteerApplicationCard.tsx" --> "AuthContext"
    "components/VolunteerApplicationCard.tsx" --> "types"
    "components/VolunteerCard.tsx" --> "UserAvatar"
    "components/VolunteerCard.tsx" --> "SoftCard"
    "components/VolunteerCard.tsx" --> "types"
    "components/VolunteerHeaderActions.tsx" -.-> "lucide-react-native"
    "components/VolunteerHeaderActions.tsx" --> "UserAvatar"
    "components/VolunteerHeaderActions.tsx" --> "ChatContext"
    "components/VolunteerHeaderActions.tsx" --> "NotificationContext"
    "components/VolunteerHeaderActions.tsx" --> "Colors"
    "components/VolunteerProfileView.tsx" -.-> "lucide-react-native"
    "components/VolunteerProfileView.tsx" --> "StandardLayout"
    "components/VolunteerProfileView.tsx" --> "types"
    "components/VolunteerProfileView.tsx" --> "ProfileHeader"
    "components/VolunteerProfileView.tsx" --> "ProfileStats"
    "components/VolunteerProfileView.tsx" --> "BadgeSection"
    "components/VolunteerProfileView.tsx" --> "ApplicationSection"
    "components/VolunteerProfileView.tsx" --> "NPOAffiliationSection"
    "components/VolunteerProfileView.tsx" --> "SkillInterestSection"
    "components/VolunteerProfileView.tsx" --> "AccountDeletionAlert"
    "components/activity/ActivityInfoCard.tsx" -.-> "lucide-react-native"
    "components/activity/ActivityInfoCard.tsx" --> "Colors"
    "components/activity/OrganizerCard.tsx" -.-> "lucide-react-native"
    "components/activity/OrganizerCard.tsx" --> "Colors"
    "components/activity/OrganizerCard.tsx" --> "UserAvatar"
    "components/profile/ApplicationSection.tsx" -.-> "lucide-react-native"
    "components/profile/ApplicationSection.tsx" --> "SoftCard"
    "components/profile/ApplicationSection.tsx" --> "types"
    "components/profile/BadgeSection.tsx" --> "SheetModal"
    "components/profile/BadgeSection.tsx" -.-> "lucide-react-native"
    "components/profile/BadgeSection.tsx" --> "Colors"
    "components/profile/BadgeSection.tsx" --> "GamificationContext"
    "components/profile/NPOAffiliationSection.tsx" -.-> "lucide-react-native"
    "components/profile/NPOAffiliationSection.tsx" --> "SoftCard"
    "components/profile/NPOAffiliationSection.tsx" --> "UserAvatar"
    "components/profile/NPOAffiliationSection.tsx" --> "types"
    "components/profile/ProfileHeader.tsx" -.-> "lucide-react-native"
    "components/profile/ProfileHeader.tsx" --> "UserAvatar"
    "components/profile/ProfileHeader.tsx" --> "types"
    "components/profile/ProfileHeader.tsx" --> "Colors"
    "components/profile/ProfileHeader.tsx" --> "AuthContext"
    "components/profile/ProfileHeader.tsx" --> "FileStorage"
    "components/profile/ProfileStats.tsx" --> "ActivityContext"
    "components/profile/ProfileStats.tsx" -.-> "lucide-react-native"
    "components/profile/ProfileStats.tsx" --> "Colors"
    "components/profile/ProfileStats.tsx" --> "StatCard"
    "services/ActivityService.ts" --> "types"
    "services/ActivityService.ts" --> "EventEmitter"
    "services/ActivityService.ts" --> "supabase"
    "services/ActivityService.ts" --> "StorageService"
    "services/AuthService.ts" --> "types"
    "services/AuthService.ts" --> "EventEmitter"
    "services/AuthService.ts" --> "supabase"
    "services/AuthService.ts" -.-> "@react-native-async-storage"
    "services/AuthService.ts" --> "StorageService"
    "services/ChatService.ts" --> "supabase"
    "services/ChatService.ts" --> "chat"
    "services/ChatService.ts" --> "chatFilter"
    "services/NPOService.ts" --> "types"
    "services/NPOService.ts" --> "EventEmitter"
    "services/NPOService.ts" --> "supabase"
    "services/ProfileService.ts" --> "supabase"
    "services/ProfileService.ts" --> "AuthService"
    "services/StorageAdapter.ts" -.-> "@react-native-async-storage"
    "services/StorageService.ts" -.-> "base64-arraybuffer"
    "services/StorageService.ts" --> "supabase"
    "context/ActivityContext.tsx" -.-> "@tanstack"
    "context/ActivityContext.tsx" --> "types"
    "context/ActivityContext.tsx" --> "AuthContext"
    "context/ActivityContext.tsx" --> "NotificationContext"
    "context/ActivityContext.tsx" --> "GamificationContext"
    "context/ActivityContext.tsx" --> "ActivityService"
    "context/ActivityContext.tsx" --> "EventEmitter"
    "context/ActivityContext.tsx" --> "SmartMatch"
    "context/ApplicationContext.tsx" -.-> "@tanstack"
    "context/ApplicationContext.tsx" --> "AuthContext"
    "context/ApplicationContext.tsx" --> "NotificationContext"
    "context/ApplicationContext.tsx" --> "types"
    "context/ApplicationContext.tsx" --> "NPOService"
    "context/AuthContext.tsx" -.-> "@react-native-async-storage"
    "context/AuthContext.tsx" --> "types"
    "context/AuthContext.tsx" --> "AuthService"
    "context/AuthContext.tsx" --> "NPOService"
    "context/AuthContext.tsx" --> "EventEmitter"
    "context/AuthContext.tsx" --> "supabase"
    "context/AuthContext.tsx" --> "ProfileService"
    "context/ChatContext.tsx" --> "supabase"
    "context/ChatContext.tsx" --> "AuthContext"
    "context/ChatContext.tsx" --> "ChatService"
    "context/CommunityContext.tsx" --> "supabase"
    "context/CommunityContext.tsx" --> "community"
    "context/CommunityContext.tsx" --> "AuthContext"
    "context/CommunityContext.tsx" --> "StorageService"
    "context/GamificationContext.tsx" -.-> "@tanstack"
    "context/GamificationContext.tsx" --> "AuthContext"
    "context/GamificationContext.tsx" --> "supabase"
    "context/GamificationContext.tsx" -.-> "@react-native-async-storage"
    "context/NotificationContext.tsx" --> "AuthContext"
    "context/NotificationContext.tsx" --> "supabase"
    "context/NotificationContext.tsx" --> "ToastContext"
    "context/SmartMatchContext.tsx" --> "supabase"
    "context/SmartMatchContext.tsx" --> "ActivityService"
    "context/SmartMatchContext.tsx" --> "AuthContext"
    "context/SmartMatchContext.tsx" --> "types"
    "context/StoriesContext.tsx" --> "supabase"
    "context/StoriesContext.tsx" --> "stories"
    "context/StoriesContext.tsx" --> "AuthContext"
    "context/StoriesContext.tsx" --> "StorageService"
    "hooks/use-theme-color.ts" --> "Colors"
    "hooks/use-theme-color.ts" -.-> "@"
    "hooks/useActivities.ts" -.-> "@tanstack"
    "hooks/useActivities.ts" --> "ActivityService"
    "hooks/useActivities.ts" --> "types"
    "hooks/useActivities.ts" --> "AuthContext"
    "hooks/useChat.ts" -.-> "@tanstack"
    "hooks/useChat.ts" --> "QueryProvider"
    "hooks/useChat.ts" --> "ChatService"
    "hooks/useChat.ts" --> "supabase"
    "hooks/useNPOInsights.ts" --> "ActivityContext"
    "hooks/useNPOInsights.ts" --> "ApplicationContext"
    "hooks/useNPOInsights.ts" --> "AuthContext"
    "hooks/useNPOInsights.ts" --> "types"
    "hooks/usePushNotifications.ts" --> "supabase"
    "hooks/usePushNotifications.ts" --> "AuthContext"
    "utils/SmartMatch.ts" --> "types"
    "utils/supabase.ts" -.-> "@supabase"
    "utils/supabase.ts" -.-> "@react-native-async-storage"
```


## 6. Audit Logs Schema
Table: `admin_audit_logs` (Immutable)
| Action | Description |
|--------|-------------|
| WARN | Warning sent to user |
| BAN | User banned |
| HIDE | Content removed |
| DISMISS | Report archived |
