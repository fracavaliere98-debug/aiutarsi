import { supabase } from "../utils/supabase";
import { OldSmartMatchResult } from "../types";

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

class GemmaService {
  async getSmartMatchReasons(matches: OldSmartMatchResult[]): Promise<SmartMatchReasonResult> {
    const matchedActivities = matches.map((match) => ({
      id: match.activity.id,
      title: match.activity.title,
      npoName: match.activity.npoName,
      category: match.activity.category,
      description: match.activity.description,
      matchPercentage: match.score,
    }));

    const { data, error } = await supabase.functions.invoke("gemma-help-assistant", {
      body: {
        mode: "shadow",
        question: "Spiega perché queste attività sono adatte a questo utente e qual è la migliore da valutare per prima.",
        responseFormat: "smart_match_reasons",
        matchedActivities,
      },
    });

    if (error) {
      throw error;
    }

    return {
      summary: data?.summary || "Gemma ha selezionato attività in linea con il tuo profilo attuale.",
      reasons: Array.isArray(data?.reasons) ? data.reasons : [],
    };
  }

  async getNPOInsightDrafts(insights: NPOInsightDraftInput[]): Promise<NPOInsightDraftResult> {
    const { data, error } = await supabase.functions.invoke("gemma-help-assistant", {
      body: {
        mode: "shadow",
        question: "Analizza queste priorità per un ente non profit e suggerisci le azioni più utili e immediate.",
        responseFormat: "npo_insight_drafts",
        npoInsights: insights,
      },
    });

    if (error) {
      throw error;
    }

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
}

export const gemmaService = new GemmaService();
