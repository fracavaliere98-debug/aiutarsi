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

class GemmaService {
  private buildSmartMatchFallback(matches: OldSmartMatchResult[]): SmartMatchReasonResult {
    return {
      summary: "Partirei da queste: qui sento piu vicinanza con quello che ti interessa adesso.",
      reasons: matches.map((match) => ({
        activityId: match.activity.id,
        reason: `${Math.round(match.score || 0)}% in linea con il tuo profilo.`,
      })),
    };
  }

  private async getShadowAccessToken() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.access_token) {
      return sessionData.session.access_token;
    }

    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn("[GemmaService] Session refresh failed:", refreshError.message);
    }

    return refreshData.session?.access_token || null;
  }

  private async invokeShadowGemma(
    body: Record<string, unknown>,
    options?: { allowMissingAuth?: boolean }
  ) {
    const accessToken = await this.getShadowAccessToken();

    if (!accessToken) {
      if (options?.allowMissingAuth) {
        return null;
      }
      throw new Error("Sessione non valida. Effettua di nuovo l'accesso.");
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/gemma-help-assistant`, {
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
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
    }

    return payload;
  }

  async getSmartMatchReasons(matches: OldSmartMatchResult[]): Promise<SmartMatchReasonResult> {
    const accessToken = await this.getShadowAccessToken();
    if (!accessToken) {
      return this.buildSmartMatchFallback(matches);
    }

    const matchedActivities = matches.map((match) => ({
      id: match.activity.id,
      title: match.activity.title,
      npoName: match.activity.npoName,
      category: match.activity.category,
      description: match.activity.description,
      matchPercentage: match.score,
    }));

    try {
      const data = await this.invokeShadowGemma({
        question: "Parla come Gemma in modo umano e incoraggiante: spiega quali attivita senti piu adatte a questa persona e da quale partiresti oggi.",
        responseFormat: "smart_match_reasons",
        matchedActivities,
      }, { allowMissingAuth: true });

      if (!data) {
        return this.buildSmartMatchFallback(matches);
      }

      return {
        summary: data?.summary || "Partirei da queste: qui sento piu vicinanza con quello che ti interessa adesso.",
        reasons: Array.isArray(data?.reasons) ? data.reasons : [],
      };
    } catch (error) {
      console.warn("[GemmaService] Smart Match fallback:", error);
      return this.buildSmartMatchFallback(matches);
    }
  }

  async getNPOInsightDrafts(insights: NPOInsightDraftInput[]): Promise<NPOInsightDraftResult> {
    const data = await this.invokeShadowGemma({
      question: "Parla come Gemma con tono caldo e concreto: guarda le priorita di questo ente e suggerisci l'azione piu utile da fare adesso, senza suonare generica.",
      responseFormat: "npo_insight_drafts",
      npoInsights: insights,
    });

    return {
      insights: Array.isArray(data?.insights) ? data.insights : [],
    };
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
