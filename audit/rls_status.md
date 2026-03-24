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
