import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import { buildHelpCenterContextForRole } from "../../../shared/helpCenterContent.ts";

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

type CommunityDraftInput = {
  purpose: "activity_promo" | "recent_recap" | "community_update";
  activity?: {
    id?: string;
    title?: string;
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

const hfApiKey = Deno.env.get("HUGGINGFACE_API_KEY") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const RATE_LIMIT_WINDOW_SECONDS = 3600; // 1 hour
const RATE_LIMIT_AUTH = 30;             // authenticated users
const RATE_LIMIT_ANON = 5;             // unauthenticated (by IP)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function getTokenFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

function getFirstName(rawName?: string | null): string {
  const normalized = String(rawName || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "utente";
  return normalized.split(" ")[0] || "utente";
}

function buildUserContext(profile: any): string {
  if (!profile) return "";

  const skills = (profile.user_skills || []).map((s: any) => s.skill).filter(Boolean);
  const interests = (profile.user_interests || []).map((i: any) => i.interest).filter(Boolean);
  const followedNPOs = (profile.followed_entities || []).map((f: any) => f.npo_id).filter(Boolean);
  const displayName = profile.role === "VOLUNTEER"
    ? getFirstName(profile.full_name || profile.npo_name)
    : (profile.npo_name || profile.full_name || "utente");

  return `
=== CONTESTO UTENTE ===
Ruolo: ${profile.role || "sconosciuto"}
Profilo completato: ${profile.profile_completed ? "sì" : "no"}
Nome: ${displayName}
Bio: ${profile.bio || "non disponibile"}
Competenze: ${skills.length > 0 ? skills.join(", ") : "nessuna"}
Interessi: ${interests.length > 0 ? interests.join(", ") : "nessuno"}
Posizione: ${profile.location_string || "non disponibile"}
NPO seguiti: ${followedNPOs.length}
XP: ${profile.impact_points || 0}
`;
}

function buildRoleOnlyContext(role?: string | null): string {
  if (!role) return "";

  return `
=== CONTESTO UTENTE ===
Ruolo: ${role}
Profilo autenticato: non disponibile
Usa solo le FAQ e i flussi pertinenti a questo ruolo.
`;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function checkRateLimit(
  serviceClient: any,
  userId: string | null,
  ip: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const scopeKey = userId ? `gemma:${userId}` : `gemma:anon:${ip}`;
  const maxCalls = userId ? RATE_LIMIT_AUTH : RATE_LIMIT_ANON;

  try {
    const { data, error } = await serviceClient.rpc("try_consume_ai_rate_limit", {
      p_scope_key: scopeKey,
      p_max_calls: maxCalls,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    if (error) {
      // If rate limit check fails, allow through to avoid blocking legitimate users
      console.warn("[GemmaHelp] Rate limit check error, allowing through:", error.message);
      return { allowed: true, retryAfterSeconds: 0 };
    }

    return { allowed: Boolean(data), retryAfterSeconds: data ? 0 : RATE_LIMIT_WINDOW_SECONDS };
  } catch (err) {
    console.warn("[GemmaHelp] Rate limit check threw, allowing through:", err);
    return { allowed: true, retryAfterSeconds: 0 };
  }
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
    text += `${index + 1}. ID: ${insight.id} | Tipo: ${insight.type} | Priorità: ${insight.priority || index + 1} | Titolo attuale: "${insight.title}" | Descrizione attuale: ${insight.description} | CTA attuale: ${insight.actionLabel}`;
    if (insight.metrics) {
      text += ` | NPO: ${insight.metrics.npoName || "Ente"} | Followers: ${insight.metrics.followerCount ?? 0} | Attività aperte: ${insight.metrics.openActivitiesCount ?? 0} | Candidature pendenti: ${insight.metrics.pendingApplicationsCount ?? 0} | Volontari approvati: ${insight.metrics.approvedVolunteersCount ?? 0} | Ore impatto: ${insight.metrics.totalImpactHours ?? 0}`;
      if (insight.metrics.nextActivityTitle) {
        text += ` | Prossima attività: ${insight.metrics.nextActivityTitle}`;
      }
      if (insight.metrics.nextActivityDate) {
        text += ` | Data prossima attività: ${insight.metrics.nextActivityDate}`;
      }
    }
    text += `\n`;
  });
  return text;
}

function formatCommunityDraftContext(draft?: CommunityDraftInput | null): string {
  if (!draft) return "";

  const base = [
    "\n=== BOZZA COMMUNITY DA PREPARARE ===",
    `Obiettivo: ${draft.purpose}`,
  ];

  if (draft.activity) {
    base.push(
      `Attività: ${draft.activity.title || "non disponibile"}`,
      `Descrizione: ${(draft.activity.description || "").slice(0, 180) || "non disponibile"}`,
      `Data: ${draft.activity.dateTime || "non disponibile"}`,
      `Luogo: ${draft.activity.location || "non disponibile"}`,
      `Ente: ${draft.activity.npoName || "non disponibile"}`,
    );
  }

  if (draft.metrics) {
    base.push(
      `NPO: ${draft.metrics.npoName ?? "non disponibile"}`,
      `Followers: ${draft.metrics.followerCount ?? 0}`,
      `Attività aperte: ${draft.metrics.openActivitiesCount ?? 0}`,
      `Candidature pendenti: ${draft.metrics.pendingApplicationsCount ?? 0}`,
      `Ore di impatto: ${draft.metrics.totalImpactHours ?? 0}`,
    );
  }

  return `${base.join("\n")}\n`;
}

function parseJsonResponse(text: string) {
  const trimmed = text.trim();
  const jsonText = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(jsonText);
}

function buildSystemPrompt(
  mode: AssistantMode,
  userContext: string,
  suggestedActivitiesText: string,
  roleScopedHelpCenterContext: string,
) {
  const sharedRules = `
Il tuo unico scopo è aiutare gli utenti di AiutarSì usando ESCLUSIVAMENTE le informazioni che ti vengono fornite in questo prompt.
Non inventare MAI informazioni, policy, nomi di enti, luoghi o funzionalità che non sono presenti nel contesto.
Se non hai abbastanza informazioni, rispondi: "Mi dispiace, non ho questa informazione a disposizione. Prova a cercare nell'app o a riformulare la domanda!"
Rispondi sempre in italiano.`;

  if (mode === "shadow") {
    return `Tu sei Gemma, shadow agent personale di AiutarSì.
Agisci come una guida silenziosa e personalizzata durante onboarding, Smart Match e scoperta attività.
Devi essere molto concreta: dai il prossimo passo utile, evidenzia 1-3 attività pertinenti se presenti, e collega sempre il consiglio al profilo dell'utente.
Parla in modo umano, vicino e incoraggiante. Non sembrare un widget o una funzione di sistema.
Non comportarti come un help desk generale. Non fare chiacchiere lunghe. Massimo 3 frasi brevi o 3 bullet.
Se l'utente è volontario e il profilo non è completo, priorità assoluta: spiegare quale informazione manca e perché aiuta i match.
Se ci sono attività suggerite, usa solo quelle reali e non inventarne altre.
Se ti rivolgi direttamente a un volontario, usa solo il nome proprio. Non usare mai nome e cognome insieme.

${sharedRules}
${userContext}
${suggestedActivitiesText}`;
  }

  return `Tu sei Gemma, assistente virtuale ufficiale del Centro Assistenza di AiutarSì.
Sei un agente conversazionale di supporto prodotto. Devi aiutare l'utente a capire come usare l'app, le regole, l'account, le notifiche e lo Smart Match.
Non fare raccomandazioni personalizzate se non ci sono dati sufficienti. Se hai suggerimenti attività reali, puoi citarli solo quando l'utente chiede cosa fare o quali opportunità vedere.
Rispondi in modo cordiale, chiaro e conciso, massimo 3-4 frasi.
Puoi usare emoji con moderazione.
Se l'utente è un VOLUNTEER, usa solo FAQ comuni + volunteer. Se l'utente è una NPO, usa solo FAQ comuni + NPO.
Non dare risposte dell'altro profilo se non sono rilevanti per il ruolo corrente. Se la domanda riguarda funzionalità non previste per quel ruolo, dillo chiaramente.
Se ti rivolgi direttamente a un volontario, usa solo il nome proprio. Non usare mai nome e cognome insieme.

${sharedRules}
${userContext}
${suggestedActivitiesText}

=== GUIDE CENTRO ASSISTENZA AIUTARSI ===

${roleScopedHelpCenterContext}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase configuration");
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const authToken = getTokenFromAuthHeader(req.headers.get("Authorization"));

    const { question, history, mode, responseFormat, matchedActivities, npoInsights, communityDraft, role } = await req.json();
    const assistantMode: AssistantMode = mode === "shadow" ? "shadow" : "help_center";
    const normalizedQuestion = String(question || "").trim() || (
      assistantMode === "shadow"
        ? "Dammi il prossimo consiglio utile e personalizzato per questo utente."
        : ""
    );

    if (!normalizedQuestion) {
      return new Response(JSON.stringify({ error: "Domanda mancante" }), { status: 400, headers: corsHeaders });
    }

    let authUserId: string | null = null;
    let profile: any = null;
    let effectiveRole: string | null = typeof role === "string" ? role : null;

    if (authToken) {
      const { data: authData, error: authError } = await serviceClient.auth.getUser(authToken);
      if (!authError && authData.user) {
        authUserId = authData.user.id;
        profile = await getUserProfile(serviceClient, authUserId);
        effectiveRole = profile?.role || effectiveRole;
      } else if (assistantMode === "shadow") {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
    } else if (assistantMode === "shadow") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Rate limit check — runs before any HuggingFace call
    const clientIp = getClientIp(req);
    const { allowed, retryAfterSeconds } = await checkRateLimit(serviceClient, authUserId, clientIp);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Troppe richieste. Riprova tra qualche minuto." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Retry-After": String(retryAfterSeconds) },
        },
      );
    }

    const userContext = profile ? buildUserContext(profile) : buildRoleOnlyContext(effectiveRole);
    const roleScopedHelpCenterContext = buildHelpCenterContextForRole(effectiveRole);

    let suggestedActivitiesText = "";
    if (profile?.role === "VOLUNTEER" && authUserId) {
      const suggestedActivities = await getSuggestedActivities(serviceClient, authUserId, profile);
      suggestedActivitiesText = formatSuggestedActivities(suggestedActivities);
    }
    const matchedActivitiesContext = Array.isArray(matchedActivities)
      ? formatMatchedActivitiesContext(matchedActivities as MatchedActivityInput[])
      : "";
    const npoInsightsContext = Array.isArray(npoInsights)
      ? formatNPOInsightsContext(npoInsights as NPOInsightInput[])
      : "";
    const communityDraftContext = communityDraft
      ? formatCommunityDraftContext(communityDraft as CommunityDraftInput)
      : "";

    const tokenToUse = await getHfToken(serviceClient);
    if (!tokenToUse) {
      throw new Error("Hugging Face token not configured");
    }

    const systemPrompt = buildSystemPrompt(
      assistantMode,
      userContext,
      suggestedActivitiesText + matchedActivitiesContext + npoInsightsContext + communityDraftContext,
      roleScopedHelpCenterContext,
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
          'Restituisci solo JSON valido nel formato {"summary":"string","reasons":[{"activityId":"string","reason":"string"}]}. "summary" deve sembrare un consiglio personale di Gemma, caldo ma concreto, massimo 18 parole. Ogni "reason" deve essere breve, concreta, personalizzata e riferita ai dati forniti. Massimo 12 parole per motivo. Evita tono burocratico o tecnico.',
      });
    }

    if (responseFormat === "npo_insight_drafts") {
      messages.push({
        role: "user",
        content:
          'Restituisci solo JSON valido nel formato {"insights":[{"id":"string","title":"string","description":"string","actionLabel":"string"}]}. Riscrivi le priorita NPO in modo concreto, caldo e orientato all\'azione, coerente con i dati reali di questo ente. Deve sembrare che Gemma conosca davvero il momento che sta vivendo l\'ente. Ogni "description" deve stare entro 22 parole. Ogni "actionLabel" entro 4 parole.',
      });
    }

    if (responseFormat === "community_post_draft") {
      messages.push({
        role: "user",
        content:
          'Restituisci solo JSON valido nel formato {"caption":"string","suggestedMode":"post|story"}. La caption deve essere naturale, breve, pronta da pubblicare, massimo 55 parole. Deve sembrare vera, sentita e vicina alle persone, non corporate. "story" solo se il contenuto sembra un aggiornamento rapido o dietro le quinte; altrimenti usa "post".',
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
            summary: "Partirei da queste: qui c'e piu possibilita di sentirti nel posto giusto.",
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

    if (responseFormat === "community_post_draft") {
      try {
        const parsed = parseJsonResponse(answer);
        return new Response(JSON.stringify({ ...parsed, mode: assistantMode }), {
          headers: corsHeaders,
        });
      } catch (parseError) {
        console.error("[GemmaHelp] Failed to parse community_post_draft JSON:", parseError);
        const draftInput = communityDraft as CommunityDraftInput | undefined;
        const fallbackCaption =
          draftInput?.purpose === "activity_promo" && draftInput.activity?.title
            ? `Stiamo preparando ${draftInput.activity.title}. Se ti va di esserci, trovi tutti i dettagli nell'attivita collegata.`
            : draftInput?.purpose === "recent_recap"
              ? "Un momento semplice, ma importante per noi. Grazie a chi c'era e a chi continua a camminare con la nostra community."
              : "Oggi volevamo farci sentire: la nostra community continua a muoversi, un passo alla volta, insieme.";

        return new Response(
          JSON.stringify({
            mode: assistantMode,
            caption: fallbackCaption,
            suggestedMode: draftInput?.purpose === "recent_recap" ? "story" : "post",
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
