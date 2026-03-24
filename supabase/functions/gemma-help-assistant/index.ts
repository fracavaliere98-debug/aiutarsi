import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import { buildHelpCenterContext } from "../../../shared/helpCenterContent.ts";

type AssistantMode = "help_center" | "shadow";

type ChatHistoryItem = {
  role?: "user" | "model";
  parts?: { text?: string }[];
};

type MatchedActivityInput = {
  id: string;
  title: string;
  npoName?: string;
  category?: string;
  description?: string;
  matchPercentage?: number;
};

type NPOInsightInput = {
  id: string;
  type: string;
  title: string;
  description: string;
  actionLabel: string;
  priority?: number;
};

const hfApiKey = Deno.env.get("HUGGINGFACE_API_KEY") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const HELP_CENTER_CONTEXT = `=== GUIDE CENTRO ASSISTENZA AIUTARSI ===\n\n${buildHelpCenterContext()}`;

function getTokenFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

function buildUserContext(profile: any): string {
  if (!profile) return "";

  const skills = (profile.user_skills || []).map((s: any) => s.skill).filter(Boolean);
  const interests = (profile.user_interests || []).map((i: any) => i.interest).filter(Boolean);
  const followedNPOs = (profile.followed_entities || []).map((f: any) => f.npo_id).filter(Boolean);

  return `
=== CONTESTO UTENTE ===
Ruolo: ${profile.role || "sconosciuto"}
Profilo completato: ${profile.profile_completed ? "sì" : "no"}
Nome: ${profile.full_name || profile.npo_name || "utente"}
Bio: ${profile.bio || "non disponibile"}
Competenze: ${skills.length > 0 ? skills.join(", ") : "nessuna"}
Interessi: ${interests.length > 0 ? interests.join(", ") : "nessuno"}
Posizione: ${profile.location_string || "non disponibile"}
NPO seguiti: ${followedNPOs.length}
XP: ${profile.impact_points || 0}
`;
}

async function getHfToken(serviceClient: any): Promise<string> {
  const { data: secretData } = await serviceClient
    .from("internal_secrets")
    .select("value")
    .eq("key", "HUGGINGFACE_API_KEY")
    .single();

  return secretData?.value || hfApiKey;
}

async function getUserProfile(serviceClient: any, userId: string) {
  const { data } = await serviceClient
    .from("profiles")
    .select(`
      *,
      user_skills (skill),
      user_interests (interest),
      followed_entities:npo_followers!npo_followers_follower_id_fkey (npo_id)
    `)
    .eq("id", userId)
    .single();

  return data;
}

async function getSuggestedActivities(serviceClient: any, userId: string, profile: any) {
  const { data: enrollments } = await serviceClient
    .from("activity_participants")
    .select("activity_id")
    .eq("user_id", userId);

  const enrolledIds = new Set((enrollments || []).map((row: any) => row.activity_id));

  const { data, error } = await serviceClient.rpc("get_activities_with_match", {
    p_user_id: userId,
    p_category: null,
    p_search: null,
    p_center_lat: profile?.location_lat || null,
    p_center_lng: profile?.location_lng || null,
    p_radius_km: 100,
    p_limit: 5,
    p_offset: 0,
    p_skills: [],
    p_only_urgent: false,
    p_date_from: null,
    p_date_to: null,
    p_statuses: ["APERTA", "IN_CORSO"],
  });

  if (error) {
    console.error("[GemmaHelp] Smart Match fetch failed:", error.message);
    return [];
  }

  return (data || []).filter((activity: any) => !enrolledIds.has(activity.id)).slice(0, 3);
}

function formatSuggestedActivities(activities: any[]): string {
  if (!activities.length) return "";

  let text = "\n=== ATTIVITÀ PERSONALIZZATE CONSIGLIATE ===\n";
  activities.forEach((activity: any, index: number) => {
    text += `${index + 1}. Titolo: "${activity.title}" | Ente: ${activity.npo_name || "NPO"} | Categoria: ${activity.category || "Generale"} | Match: ${Math.round(activity.match_percentage || 0)}% | Descrizione: ${(activity.description || "").slice(0, 140)}\n`;
  });
  return text;
}

function formatMatchedActivitiesContext(activities: MatchedActivityInput[]): string {
  if (!activities.length) return "";

  let text = "\n=== ATTIVITÀ CORRENTI DA SPIEGARE ===\n";
  activities.forEach((activity, index) => {
    text += `${index + 1}. ID: ${activity.id} | Titolo: "${activity.title}" | Ente: ${activity.npoName || "NPO"} | Categoria: ${activity.category || "Generale"} | Match: ${Math.round(activity.matchPercentage || 0)}% | Descrizione: ${(activity.description || "").slice(0, 160)}\n`;
  });
  return text;
}

function formatNPOInsightsContext(insights: NPOInsightInput[]): string {
  if (!insights.length) return "";

  let text = "\n=== PRIORITÀ OPERATIVE NPO ===\n";
  insights.forEach((insight, index) => {
    text += `${index + 1}. ID: ${insight.id} | Tipo: ${insight.type} | Priorità: ${insight.priority || index + 1} | Titolo attuale: "${insight.title}" | Descrizione attuale: ${insight.description} | CTA attuale: ${insight.actionLabel}\n`;
  });
  return text;
}

function parseJsonResponse(text: string) {
  const trimmed = text.trim();
  const jsonText = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(jsonText);
}

function buildSystemPrompt(mode: AssistantMode, userContext: string, suggestedActivitiesText: string) {
  const sharedRules = `
Il tuo unico scopo è aiutare gli utenti di AiutarSì usando ESCLUSIVAMENTE le informazioni che ti vengono fornite in questo prompt.
Non inventare MAI informazioni, policy, nomi di enti, luoghi o funzionalità che non sono presenti nel contesto.
Se non hai abbastanza informazioni, rispondi: "Mi dispiace, non ho questa informazione a disposizione. Prova a cercare nell'app o a riformulare la domanda!"
Rispondi sempre in italiano.`;

  if (mode === "shadow") {
    return `Tu sei Gemma, shadow agent personale di AiutarSì.
Agisci come una guida silenziosa e personalizzata durante onboarding, Smart Match e scoperta attività.
Devi essere molto concreta: dai il prossimo passo utile, evidenzia 1-3 attività pertinenti se presenti, e collega sempre il consiglio al profilo dell'utente.
Non comportarti come un help desk generale. Non fare chiacchiere lunghe. Massimo 3 frasi brevi o 3 bullet.
Se l'utente è volontario e il profilo non è completo, priorità assoluta: spiegare quale informazione manca e perché aiuta i match.
Se ci sono attività suggerite, usa solo quelle reali e non inventarne altre.

${sharedRules}
${userContext}
${suggestedActivitiesText}`;
  }

  return `Tu sei Gemma, assistente virtuale ufficiale del Centro Assistenza di AiutarSì.
Sei un agente conversazionale di supporto prodotto. Devi aiutare l'utente a capire come usare l'app, le regole, l'account, le notifiche e lo Smart Match.
Non fare raccomandazioni personalizzate se non ci sono dati sufficienti. Se hai suggerimenti attività reali, puoi citarli solo quando l'utente chiede cosa fare o quali opportunità vedere.
Rispondi in modo cordiale, chiaro e conciso, massimo 3-4 frasi.
Puoi usare emoji con moderazione.

${sharedRules}
${userContext}
${suggestedActivitiesText}

${HELP_CENTER_CONTEXT}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase configuration");
    }

    const authToken = getTokenFromAuthHeader(req.headers.get("Authorization"));
    if (!authToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await serviceClient.auth.getUser(authToken);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { question, history, mode, responseFormat, matchedActivities, npoInsights } = await req.json();
    const assistantMode: AssistantMode = mode === "shadow" ? "shadow" : "help_center";
    const normalizedQuestion = String(question || "").trim() || (
      assistantMode === "shadow"
        ? "Dammi il prossimo consiglio utile e personalizzato per questo utente."
        : ""
    );

    if (!normalizedQuestion) {
      return new Response(JSON.stringify({ error: "Domanda mancante" }), { status: 400, headers: corsHeaders });
    }

    const profile = await getUserProfile(serviceClient, authData.user.id);
    const userContext = buildUserContext(profile);

    let suggestedActivitiesText = "";
    if (profile?.role === "VOLUNTEER") {
      const suggestedActivities = await getSuggestedActivities(serviceClient, authData.user.id, profile);
      suggestedActivitiesText = formatSuggestedActivities(suggestedActivities);
    }
    const matchedActivitiesContext = Array.isArray(matchedActivities)
      ? formatMatchedActivitiesContext(matchedActivities as MatchedActivityInput[])
      : "";
    const npoInsightsContext = Array.isArray(npoInsights)
      ? formatNPOInsightsContext(npoInsights as NPOInsightInput[])
      : "";

    const tokenToUse = await getHfToken(serviceClient);
    if (!tokenToUse) {
      throw new Error("Hugging Face token not configured");
    }

    const systemPrompt = buildSystemPrompt(
      assistantMode,
      userContext,
      suggestedActivitiesText + matchedActivitiesContext + npoInsightsContext,
    );

    const messages = [
      { role: "system", content: systemPrompt },
    ];

    if (assistantMode === "help_center") {
      messages.push({
        role: "assistant",
        content: "Ciao! Sono Gemma, il tuo assistente su AiutarSì 👋 Come posso aiutarti?",
      });
    }

    if (Array.isArray(history)) {
      for (const msg of (history as ChatHistoryItem[]).slice(-10)) {
        messages.push({
          role: msg.role === "model" ? "assistant" : "user",
          content: msg.parts?.[0]?.text || "",
        });
      }
    }

    messages.push({ role: "user", content: normalizedQuestion });

    if (responseFormat === "smart_match_reasons") {
      messages.push({
        role: "user",
        content:
          'Restituisci solo JSON valido nel formato {"summary":"string","reasons":[{"activityId":"string","reason":"string"}]}. Ogni "reason" deve essere breve, concreta, personalizzata e riferita ai dati forniti. Massimo 18 parole per motivo.',
      });
    }

    if (responseFormat === "npo_insight_drafts") {
      messages.push({
        role: "user",
        content:
          'Restituisci solo JSON valido nel formato {"insights":[{"id":"string","title":"string","description":"string","actionLabel":"string"}]}. Riscrivi le priorità NPO in modo concreto, orientato all\'azione e coerente con i dati reali. Ogni "description" deve stare entro 24 parole. Ogni "actionLabel" entro 4 parole.',
      });
    }

    const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenToUse}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/Meta-Llama-3-8B-Instruct",
        messages,
        temperature: assistantMode === "shadow" ? 0.45 : 0.7,
        max_tokens: assistantMode === "shadow" ? 220 : 500,
        frequency_penalty: 0.15,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API Error: ${errorText}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "";

    if (responseFormat === "smart_match_reasons") {
      try {
        const parsed = parseJsonResponse(answer);
        return new Response(JSON.stringify({ ...parsed, mode: assistantMode }), {
          headers: corsHeaders,
        });
      } catch (parseError) {
        console.error("[GemmaHelp] Failed to parse smart_match_reasons JSON:", parseError);
        const fallbackReasons = Array.isArray(matchedActivities)
          ? (matchedActivities as MatchedActivityInput[]).map((activity) => ({
              activityId: activity.id,
              reason: `Match ${Math.round(activity.matchPercentage || 0)}% in linea con il tuo profilo.`,
            }))
          : [];

        return new Response(
          JSON.stringify({
            mode: assistantMode,
            summary: "Gemma ha selezionato attività in linea con il tuo profilo attuale.",
            reasons: fallbackReasons,
          }),
          { headers: corsHeaders },
        );
      }
    }

    if (responseFormat === "npo_insight_drafts") {
      try {
        const parsed = parseJsonResponse(answer);
        return new Response(JSON.stringify({ ...parsed, mode: assistantMode }), {
          headers: corsHeaders,
        });
      } catch (parseError) {
        console.error("[GemmaHelp] Failed to parse npo_insight_drafts JSON:", parseError);
        const fallbackInsights = Array.isArray(npoInsights)
          ? (npoInsights as NPOInsightInput[]).map((insight) => ({
              id: insight.id,
              title: insight.title,
              description: insight.description,
              actionLabel: insight.actionLabel,
            }))
          : [];

        return new Response(
          JSON.stringify({
            mode: assistantMode,
            insights: fallbackInsights,
          }),
          { headers: corsHeaders },
        );
      }
    }

    const safeAnswer =
      answer || "Mi dispiace, non ho trovato una risposta. Prova a riformulare la domanda!";

    return new Response(JSON.stringify({ answer: safeAnswer, mode: assistantMode }), {
      headers: corsHeaders,
    });
  } catch (err: any) {
    console.error("[GemmaHelp Error]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
