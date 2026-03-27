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
