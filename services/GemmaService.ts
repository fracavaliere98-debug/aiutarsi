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
  private async invokeShadowGemma(body: Record<string, unknown>) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
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
    const matchedActivities = matches.map((match) => ({
      id: match.activity.id,
      title: match.activity.title,
      npoName: match.activity.npoName,
      category: match.activity.category,
      description: match.activity.description,
      matchPercentage: match.score,
    }));

    const data = await this.invokeShadowGemma({
      question: "Spiega perché queste attività sono adatte a questo utente e qual è la migliore da valutare per prima.",
      responseFormat: "smart_match_reasons",
      matchedActivities,
    });

    return {
      summary: data?.summary || "Gemma ha selezionato attività in linea con il tuo profilo attuale.",
      reasons: Array.isArray(data?.reasons) ? data.reasons : [],
    };
  }

  async getNPOInsightDrafts(insights: NPOInsightDraftInput[]): Promise<NPOInsightDraftResult> {
    const data = await this.invokeShadowGemma({
      question: "Analizza queste priorità per un ente non profit e suggerisci le azioni più utili e immediate.",
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
      question: "Prepara una bozza breve e credibile per la community di un ente non profit.",
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
