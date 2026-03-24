import { supabase } from "../utils/supabase";
import { OldSmartMatchResult } from "../types";

export type SmartMatchReasonResult = {
  summary: string;
  reasons: { activityId: string; reason: string }[];
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
}

export const gemmaService = new GemmaService();
