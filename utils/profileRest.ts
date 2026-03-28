import { Platform } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

type RestMethod = "GET" | "POST" | "PATCH" | "DELETE";

const buildHeaders = (accessToken?: string, extra?: Record<string, string>) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  ...extra,
});

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function request<T>(
  method: RestMethod,
  path: string,
  body?: unknown,
  accessToken?: string,
  extraHeaders?: Record<string, string>,
  timeoutMs = 8000
): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase env mancanti.");
  }

  const url = `${SUPABASE_URL}${path}`;
  console.log(`[DEBUG] profileRest ${method} ${path} start`);

  const headers = buildHeaders(accessToken, extraHeaders);

  if (Platform.OS !== "web") {
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const timer = setTimeout(() => {
        xhr.abort();
        reject(new Error(`${method} ${path} timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      xhr.open(method, url, true);
      Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return;
        clearTimeout(timer);
        console.log(`[DEBUG] profileRest ${method} ${path} -> ${xhr.status}`);

        if (xhr.status === 0) {
          reject(new Error(`${method} ${path} failed with status 0`));
          return;
        }

        if (xhr.status === 204 || xhr.status === 205 || !xhr.responseText) {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(undefined as T);
            return;
          }
          reject(new Error(`${method} ${path} failed with ${xhr.status}`));
          return;
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          console.error(`[DEBUG] profileRest ${method} ${path} error body`, xhr.responseText);
          reject(new Error(xhr.responseText || `${method} ${path} failed with ${xhr.status}`));
          return;
        }

        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          resolve(xhr.responseText as T);
        }
      };

      xhr.onerror = () => {
        clearTimeout(timer);
        reject(new Error(`${method} ${path} network error`));
      };

      xhr.ontimeout = () => {
        clearTimeout(timer);
        reject(new Error(`${method} ${path} timeout after ${timeoutMs}ms`));
      };

      try {
        xhr.send(body === undefined ? null : JSON.stringify(body));
      } catch (error: any) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  let response: Response;
  try {
    response = await withTimeout(
      fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      `${method} ${path}`,
      timeoutMs
    );
  } catch (error: any) {
    console.warn(`[DEBUG] profileRest ${method} ${path} failed before response`, error?.message || error);
    throw error;
  }

  console.log(`[DEBUG] profileRest ${method} ${path} -> ${response.status}`);

  // React Native fetch can hang on response.text() for 204/205 empty responses.
  // Short-circuit before reading the body for true no-content responses.
  if (response.status === 204 || response.status === 205) {
    if (!response.ok) {
      throw new Error(`${method} ${path} failed with ${response.status}`);
    }
    return undefined as T;
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength === "0") {
    if (!response.ok) {
      throw new Error(`${method} ${path} failed with ${response.status}`);
    }
    return undefined as T;
  }

  const text = await withTimeout(response.text(), `${method} ${path} body`, timeoutMs);

  if (!response.ok) {
    console.error(`[DEBUG] profileRest ${method} ${path} error body`, text);
    throw new Error(text || `${method} ${path} failed with ${response.status}`);
  }

  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

export const profileRest = {
  getChatInbox: async (userId: string, accessToken?: string) => {
    return request<any[]>(
      "POST",
      `/rest/v1/rpc/get_chat_inbox`,
      { p_user_id: userId },
      accessToken
    );
  },
  getConversationMetadata: async (conversationId: string, accessToken?: string) => {
    return request<any[]>(
      "GET",
      `/rest/v1/conversations?id=eq.${conversationId}&select=id,type,activity_id,created_at,last_message_content,last_message_at,last_message_sender_id,activities(title,npo:profiles!npo_id(npo_name)),participants:conversation_participants(user_id,last_read_at,inbox_visible_at,hidden_at,notifications_muted,profiles(name:full_name,npo_name,avatar:avatar_url,role,phone,allow_calls,last_seen_at))`,
      undefined,
      accessToken
    );
  },
  getMessages: async (conversationId: string, before?: string, limit: number = 20, accessToken?: string) => {
    const beforeFilter = before ? `&created_at=lt.${encodeURIComponent(before)}` : "";
    return request<any[]>(
      "GET",
      `/rest/v1/messages?conversation_id=eq.${conversationId}${beforeFilter}&select=id,conversation_id,sender_id,content,metadata,created_at,profiles:sender_id(name:full_name,avatar:avatar_url)&order=created_at.desc&limit=${limit}`,
      undefined,
      accessToken
    );
  },
  markConversationRead: async (conversationId: string, userId: string, accessToken?: string) => {
    return request(
      "PATCH",
      `/rest/v1/conversation_participants?conversation_id=eq.${conversationId}&user_id=eq.${userId}`,
      { last_read_at: new Date().toISOString() },
      accessToken,
      { Prefer: "return=minimal" }
    );
  },
  hideConversation: async (conversationId: string, userId: string, accessToken?: string) => {
    return request(
      "POST",
      `/rest/v1/rpc/hide_conversation_for_user`,
      { p_conversation_id: conversationId, p_user_id: userId },
      accessToken
    );
  },
  listVolunteerChatApplications: async (userId: string, accessToken?: string) => {
    return request<Array<{ npo_id: string }>>(
      "GET",
      `/rest/v1/applications?volunteer_id=eq.${userId}&select=npo_id`,
      undefined,
      accessToken
    );
  },
  listVolunteerFollowedNpos: async (userId: string, accessToken?: string) => {
    return request<Array<{ npo_id: string }>>(
      "GET",
      `/rest/v1/npo_followers?follower_id=eq.${userId}&select=npo_id`,
      undefined,
      accessToken
    );
  },
  listVolunteerActivityNpos: async (userId: string, accessToken?: string) => {
    return request<Array<{ activities?: { npo_id?: string | null } | null }>>(
      "GET",
      `/rest/v1/activity_participants?user_id=eq.${userId}&status=in.(APPROVED,REGISTERED,PENDING)&select=activities!inner(npo_id)`,
      undefined,
      accessToken
    );
  },
  listNpoApplications: async (npoId: string, accessToken?: string) => {
    return request<Array<{ volunteer_id: string; volunteer?: { id: string; name?: string | null; npo_name?: string | null; avatar?: string | null; role?: string | null } | null }>>(
      "GET",
      `/rest/v1/applications?npo_id=eq.${npoId}&select=volunteer_id,volunteer:profiles!applications_volunteer_id_fkey(id,name:full_name,npo_name,avatar:avatar_url,role)`,
      undefined,
      accessToken
    );
  },
  listNpoActivities: async (npoId: string, accessToken?: string) => {
    return request<Array<{ id: string; title: string; status: string }>>(
      "GET",
      `/rest/v1/activities?npo_id=eq.${npoId}&status=neq.CANCELLATA&select=id,title,status`,
      undefined,
      accessToken
    );
  },
  listActivityParticipants: async (activityIds: string[], accessToken?: string) => {
    if (!activityIds.length) return [];
    const inFilter = activityIds.join(",");
    return request<Array<{ activity_id: string; user_id: string; status: string }>>(
      "GET",
      `/rest/v1/activity_participants?activity_id=in.(${inFilter})&status=in.(APPROVED,REGISTERED)&select=activity_id,user_id,status`,
      undefined,
      accessToken
    );
  },
  sendMessage: async (
    payload: { conversation_id: string; sender_id: string; content: string; metadata?: unknown },
    accessToken?: string
  ) => {
    return request<any[]>(
      "POST",
      `/rest/v1/rpc/send_chat_message`,
      {
        p_conversation_id: payload.conversation_id,
        p_sender_id: payload.sender_id,
        p_content: payload.content,
        p_metadata: payload.metadata ?? {},
      },
      accessToken
    );
  },
  sendMessageLegacy: async (
    payload: { conversation_id: string; sender_id: string; content: string; metadata?: unknown },
    accessToken?: string
  ) => {
    return request<any[]>(
      "POST",
      `/rest/v1/messages?select=id,conversation_id,sender_id,content,metadata,created_at`,
      payload,
      accessToken,
      { Prefer: "return=representation" }
    );
  },
  startPrivateConversationBetween: async (userId1: string, userId2: string, accessToken?: string) => {
    const conversationId = await request<string | null>(
      "POST",
      `/rest/v1/rpc/start_private_conversation_between`,
      { p_user_id_1: userId1, p_user_id_2: userId2 },
      accessToken
    );
    return typeof conversationId === 'string' ? conversationId : null;
  },
  joinActivity: async (
    payload: { activity_id: string; user_id: string; status: "REGISTERED" | "PENDING"; message?: string; phone?: string },
    accessToken?: string
  ) => {
    return request(
      "POST",
      `/rest/v1/activity_participants`,
      payload,
      accessToken,
      { Prefer: "resolution=merge-duplicates,return=minimal" }
    );
  },
  leaveActivity: async (activityId: string, userId: string, accessToken?: string) => {
    return request(
      "DELETE",
      `/rest/v1/activity_participants?activity_id=eq.${activityId}&user_id=eq.${userId}`,
      undefined,
      accessToken,
      { Prefer: "return=minimal" }
    );
  },
  listActivityApplications: async (accessToken?: string) => {
    return request<any[]>(
      "GET",
      `/rest/v1/activity_participants?select=activity_id,user_id,status,created_at,message,phone,volunteer:user_id(full_name,avatar_url,phone)&status=in.(PENDING,APPROVED,REJECTED,REGISTERED)&order=created_at.desc`,
      undefined,
      accessToken
    );
  },
  submitActivityApplication: async (
    payload: { activity_id: string; user_id: string; status: "PENDING"; message?: string },
    accessToken?: string
  ) => {
    return request(
      "POST",
      `/rest/v1/activity_participants`,
      payload,
      accessToken,
      { Prefer: "resolution=merge-duplicates,return=minimal" }
    );
  },
  updateActivityApplicationStatus: async (
    activityId: string,
    userId: string,
    payload: { status: "APPROVED" | "REJECTED" },
    accessToken?: string
  ) => {
    return request(
      "PATCH",
      `/rest/v1/activity_participants?activity_id=eq.${activityId}&user_id=eq.${userId}`,
      payload,
      accessToken,
      { Prefer: "return=minimal" }
    );
  },
  submitApplication: async (
    payload: { npo_id: string; volunteer_id: string; message?: string | null; status?: string },
    accessToken?: string
  ) => {
    return request(
      "POST",
      `/rest/v1/applications`,
      payload,
      accessToken,
      { Prefer: "return=minimal" }
    );
  },
  listApplicationsForNPO: async (npoId: string, accessToken?: string) => {
    return request<any[]>(
      "GET",
      `/rest/v1/applications?select=id,npo_id,volunteer_id,message,status,created_at,reviewed_at,volunteer:volunteer_id(full_name,avatar_url,user_skills(skill)),npo:npo_id(npo_name,full_name,avatar_url)&npo_id=eq.${npoId}&order=created_at.desc`,
      undefined,
      accessToken
    );
  },
  listApplicationsForVolunteer: async (volunteerId: string, accessToken?: string) => {
    return request<any[]>(
      "GET",
      `/rest/v1/applications?select=id,npo_id,volunteer_id,message,status,created_at,reviewed_at,volunteer:volunteer_id(full_name,avatar_url),npo:npo_id(npo_name,full_name,avatar_url)&volunteer_id=eq.${volunteerId}&order=created_at.desc`,
      undefined,
      accessToken
    );
  },
  updateApplicationStatus: async (
    applicationId: string,
    payload: { status: "APPROVED" | "REJECTED"; reviewed_at?: string },
    accessToken?: string
  ) => {
    return request(
      "PATCH",
      `/rest/v1/applications?id=eq.${applicationId}`,
      payload,
      accessToken,
      { Prefer: "return=minimal" }
    );
  },
  listBlockedUsers: async (userId: string, accessToken?: string) => {
    return request<Array<{ id: string; blocked_id: string }>>(
      "GET",
      `/rest/v1/blocked_users?blocker_id=eq.${userId}&select=id,blocked_id`,
      undefined,
      accessToken
    );
  },
  getBasicProfiles: async (ids: string[], accessToken?: string) => {
    if (ids.length === 0) return [];
    const inFilter = ids.join(",");
    return request<Array<{ id: string; full_name?: string | null; npo_name?: string | null; avatar_url?: string | null; role?: string | null; referral_code?: string | null }>>(
      "GET",
      `/rest/v1/profiles?id=in.(${inFilter})&select=id,full_name,npo_name,avatar_url,role,referral_code`,
      undefined,
      accessToken
    );
  },
  countReferrals: async (userId: string, accessToken?: string) => {
    const rows = await request<Array<{ id: string }>>(
      "GET",
      `/rest/v1/profiles?referred_by=eq.${userId}&select=id`,
      undefined,
      accessToken
    );
    return rows.length;
  },
  resolveReferralCode: async (code: string, accessToken?: string) => {
    const rows = await request<Array<{ id: string }>>(
      "GET",
      `/rest/v1/profiles?referral_code=eq.${encodeURIComponent(code)}&select=id&limit=1`,
      undefined,
      accessToken
    );
    return rows[0]?.id || null;
  },
  updateVolunteerProfile: async (userId: string, payload: Record<string, unknown>, accessToken?: string) => {
    return request(
      "PATCH",
      `/rest/v1/profiles?id=eq.${userId}`,
      payload,
      accessToken,
      { Prefer: "return=minimal" }
    );
  },
  replaceVolunteerSkills: async (userId: string, skills: string[], accessToken?: string) => {
    await request(
      "DELETE",
      `/rest/v1/user_skills?user_id=eq.${userId}`,
      undefined,
      accessToken,
      { Prefer: "return=minimal" }
    );
    if (skills.length === 0) return [];
    return request(
      "POST",
      `/rest/v1/user_skills`,
      skills.map((skill) => ({ user_id: userId, skill })),
      accessToken,
      { Prefer: "return=minimal" }
    );
  },
  replaceVolunteerInterests: async (userId: string, interests: string[], accessToken?: string) => {
    await request(
      "DELETE",
      `/rest/v1/user_interests?user_id=eq.${userId}`,
      undefined,
      accessToken,
      { Prefer: "return=minimal" }
    );
    if (interests.length === 0) return [];
    return request(
      "POST",
      `/rest/v1/user_interests`,
      interests.map((interest) => ({ user_id: userId, interest })),
      accessToken,
      { Prefer: "return=minimal" }
    );
  },
};
