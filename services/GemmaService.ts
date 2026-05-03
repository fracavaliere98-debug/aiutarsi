import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../utils/supabase";
import { OldSmartMatchResult } from "../types";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export type SmartMatchReasonResult = {
  summary: string;
  reasons: { activityId: string; reason: string }[];
};

export type NPOInsightDraftInput = {
  id: string;
  type: string;
  title: string;
  description: string;
  actionLabel: string;
  priority: number;
  metrics?: {
    npoName?: string;
    followerCount?: number;
    openActivitiesCount?: number;
    pendingApplicationsCount?: number;
    approvedVolunteersCount?: number;
    totalImpactHours?: number;
    nextActivityTitle?: string;
    nextActivityDate?: string;
  };
};

export type NPOInsightDraftResult = {
  insights: {
    id: string;
    title: string;
    description: string;
    actionLabel: string;
  }[];
};

export type CuratedActivityDraftResult = {
  expandedDescription: string;
  suggestedSkills: string[];
  suggestedCategory: string;
};

export type CommunityPostDraftInput = {
  purpose: "activity_promo" | "recent_recap" | "community_update";
  activity?: {
    id?: string;
    title: string;
    description?: string;
    dateTime?: string;
    location?: string;
    npoName?: string;
  };
  metrics?: {
    npoName?: string;
    followerCount?: number;
    openActivitiesCount?: number;
    pendingApplicationsCount?: number;
    totalImpactHours?: number;
  };
};

export type CommunityPostDraftResult = {
  caption: string;
  suggestedMode: "post" | "story";
};

const NPO_INSIGHT_CACHE_PREFIX = "gemma:npo-insight-drafts:";
const NPO_INSIGHT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const NPO_INSIGHT_STALE_TTL_MS = 48 * 60 * 60 * 1000;
const GEMMA_CIRCUIT_FAILURE_THRESHOLD = 3;
const GEMMA_CIRCUIT_FAILURE_WINDOW_MS = 2 * 60 * 1000;
const GEMMA_CIRCUIT_COOLDOWN_MS = 10 * 60 * 1000;

type CachedNPOInsightDrafts = {
  savedAt: number;
  data: NPOInsightDraftResult;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

class GemmaService {
  private inFlight = new Map<string, Promise<any>>();
  private consecutiveFailures = 0;
  private firstFailureAt = 0;
  private circuitOpenUntil = 0;

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
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

  private buildSmartMatchFallback(matches: OldSmartMatchResult[]): SmartMatchReasonResult {
    const top = matches[0]?.activity?.title;
    return {
      summary: top
        ? `Partirei da ${top}: qui vedo il punto di contatto piu forte con quello che ti interessa adesso.`
        : "Partirei da queste: qui sento piu vicinanza con quello che ti interessa adesso.",
      reasons: matches.filter((match) => !!match.activity).map((match) => ({
        activityId: match.activity!.id,
        reason: this.buildSmartMatchReason(match),
      })),
    };
  }

  private buildSmartMatchReason(match: OldSmartMatchResult): string {
    const activity = match.activity;
    if (!activity) return `${Math.round(match.score || 0)}% in linea con il tuo profilo.`;

    const bits: string[] = [];
    if (activity.isUrgent) bits.push('è urgente');
    if (activity.category) bits.push(`tocca il tema ${activity.category.toLowerCase()}`);
    if (activity.skills?.length) bits.push(`richiede ${activity.skills.slice(0, 2).join(' e ').toLowerCase()}`);

    const when = activity.dateTime ? new Date(activity.dateTime).getTime() : null;
    if (when) {
      const diffDays = (when - Date.now()) / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= 3) bits.push('parte nei prossimi giorni');
      else if (diffDays > 3 && diffDays <= 7) bits.push('succede questa settimana');
    }

    if (!bits.length) {
      return `${activity.title} è tra le opportunità più coerenti con il tuo profilo in questo momento.`;
    }

    const lead = match.score >= 80
      ? `${activity.title} è una delle attività più forti per te perché`
      : `${activity.title} merita attenzione perché`;

    return `${lead} ${bits.slice(0, 3).join(', ')}.`;
  }

  private async getShadowAccessToken() {
    const startedAt = Date.now();
    const { data: sessionData } = await this.withTimeout(supabase.auth.getSession(), 1200, 'gemma.auth.getSession');
    if (sessionData.session?.access_token) {
      console.log('[DEBUG] GemmaService: getShadowAccessToken from session', { elapsedMs: Date.now() - startedAt });
      return sessionData.session.access_token;
    }

    const { data: refreshData, error: refreshError } = await this.withTimeout(supabase.auth.refreshSession(), 1800, 'gemma.auth.refreshSession');
    if (refreshError) {
      console.warn("[GemmaService] Session refresh failed:", refreshError.message);
    }

    console.log('[DEBUG] GemmaService: getShadowAccessToken from refresh', {
      hasToken: !!refreshData.session?.access_token,
      elapsedMs: Date.now() - startedAt,
    });
    return refreshData.session?.access_token || null;
  }

  private async invokeShadowGemma(
    body: Record<string, unknown>,
    options?: { allowMissingAuth?: boolean }
  ) {
    const requestKey = stableStringify({ body, allowMissingAuth: !!options?.allowMissingAuth });
    const pending = this.inFlight.get(requestKey);
    if (pending) return pending;

    const request = this.invokeShadowGemmaRequest(body, options).finally(() => {
      this.inFlight.delete(requestKey);
    });

    this.inFlight.set(requestKey, request);
    return request;
  }

  private registerGemmaFailure() {
    const now = Date.now();
    if (!this.firstFailureAt || now - this.firstFailureAt > GEMMA_CIRCUIT_FAILURE_WINDOW_MS) {
      this.firstFailureAt = now;
      this.consecutiveFailures = 1;
      return;
    }

    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= GEMMA_CIRCUIT_FAILURE_THRESHOLD) {
      this.circuitOpenUntil = now + GEMMA_CIRCUIT_COOLDOWN_MS;
    }
  }

  private resetGemmaCircuit() {
    this.firstFailureAt = 0;
    this.consecutiveFailures = 0;
    this.circuitOpenUntil = 0;
  }

  private async invokeShadowGemmaRequest(
    body: Record<string, unknown>,
    options?: { allowMissingAuth?: boolean }
  ) {
    if (Date.now() < this.circuitOpenUntil) {
      throw new Error("Gemma temporaneamente non disponibile");
    }

    const startedAt = Date.now();
    const accessToken = await this.getShadowAccessToken();
    console.log('[DEBUG] GemmaService: invokeShadowGemma auth resolved', {
      hasAccessToken: !!accessToken,
      allowMissingAuth: !!options?.allowMissingAuth,
      elapsedMs: Date.now() - startedAt,
    });

    if (!accessToken) {
      if (options?.allowMissingAuth) {
        return null;
      }
      throw new Error("Sessione non valida. Effettua di nuovo l'accesso.");
    }

    const controller = new AbortController();
    const abortId = setTimeout(() => controller.abort(), 2200);
    console.log('[DEBUG] GemmaService: invokeShadowGemma request start', {
      elapsedMs: Date.now() - startedAt,
      bodyKeys: Object.keys(body),
    });
    let response: Response;
    try {
      response = await fetch(`${supabaseUrl}/functions/v1/gemma-help-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          mode: "shadow",
          ...body,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      this.registerGemmaFailure();
      throw error;
    } finally {
      clearTimeout(abortId);
    }

    console.log('[DEBUG] GemmaService: invokeShadowGemma response', {
      status: response.status,
      ok: response.ok,
      elapsedMs: Date.now() - startedAt,
    });

    const payload = await response.json().catch(() => null);
    console.log('[DEBUG] GemmaService: invokeShadowGemma payload', {
      hasPayload: !!payload,
      payloadKeys: payload ? Object.keys(payload) : [],
      elapsedMs: Date.now() - startedAt,
    });

    if (!response.ok) {
      if (response.status >= 500) {
        this.registerGemmaFailure();
      }
      throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
    }

    this.resetGemmaCircuit();
    return payload;
  }

  private getNPOInsightCacheKey(insights: NPOInsightDraftInput[]) {
    return `${NPO_INSIGHT_CACHE_PREFIX}${stableStringify(insights)}`;
  }

  private async readNPOInsightCache(cacheKey: string, maxAgeMs: number): Promise<NPOInsightDraftResult | null> {
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as CachedNPOInsightDrafts;
      if (!parsed?.savedAt || !parsed?.data || Date.now() - parsed.savedAt > maxAgeMs) {
        return null;
      }

      return parsed.data;
    } catch {
      return null;
    }
  }

  private async writeNPOInsightCache(cacheKey: string, data: NPOInsightDraftResult) {
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data }));
    } catch {
      // Cache failures must never affect the dashboard.
    }
  }

  async getSmartMatchReasons(matches: OldSmartMatchResult[]): Promise<SmartMatchReasonResult> {
    return this.buildSmartMatchFallback(matches);
  }

  async getNPOInsightDrafts(insights: NPOInsightDraftInput[]): Promise<NPOInsightDraftResult> {
    const cacheKey = this.getNPOInsightCacheKey(insights);
    const cached = await this.readNPOInsightCache(cacheKey, NPO_INSIGHT_CACHE_TTL_MS);
    if (cached) return cached;

    try {
      const data = await this.invokeShadowGemma({
        question: "Parla come Gemma con tono caldo e concreto: guarda le priorita di questo ente e suggerisci l'azione piu utile da fare adesso, senza suonare generica.",
        responseFormat: "npo_insight_drafts",
        npoInsights: insights,
      });

      const result = {
        insights: Array.isArray(data?.insights) ? data.insights : [],
      };
      await this.writeNPOInsightCache(cacheKey, result);
      return result;
    } catch (error) {
      const stale = await this.readNPOInsightCache(cacheKey, NPO_INSIGHT_STALE_TTL_MS);
      if (stale) return stale;
      throw error;
    }
  }

  async curateActivityDraft(activity: {
    title: string;
    description: string;
    category?: string;
  }): Promise<CuratedActivityDraftResult> {
    const { data, error } = await supabase.functions.invoke("activity-curator-ai", {
      body: { activity },
    });

    if (error) {
      throw error;
    }

    return {
      expandedDescription: data?.expandedDescription || activity.description,
      suggestedSkills: Array.isArray(data?.suggestedSkills) ? data.suggestedSkills : [],
      suggestedCategory: data?.suggestedCategory || activity.category || "Sociale",
    };
  }

  async getCommunityPostDraft(input: CommunityPostDraftInput): Promise<CommunityPostDraftResult> {
    const data = await this.invokeShadowGemma({
      question: "Scrivi come Gemma una bozza breve, credibile e sentita per la community di questo ente: deve sembrare vera, vicina alle persone e pronta da pubblicare.",
      responseFormat: "community_post_draft",
      communityDraft: input,
    });

    return {
      caption: data?.caption || "",
      suggestedMode: data?.suggestedMode === "story" ? "story" : "post",
    };
  }
}

export const gemmaService = new GemmaService();
