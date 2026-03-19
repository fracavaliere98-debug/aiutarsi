import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const hfApiKey = Deno.env.get('HUGGINGFACE_API_KEY')!;

const HELP_CENTER_CONTEXT = `
=== GUIDE CENTRO ASSISTENZA AIUTARSI ===

--- SEZIONE 1: INIZIARE CON AIUTARSI ---
Q: Come mi registro su AiutarSi?
A: Scarica l'app dal tuo store, apri l'app e scegli "Registrati". Puoi registrarti come Volontario (per partecipare alle attività) o come NPO (ente non-profit, per pubblicare opportunità). Segui l'onboarding passo per passo.

Q: Ho dimenticato la password, come la recupero?
A: Nella schermata di accesso, tocca "Password dimenticata?" e inserisci la tua email. Riceverai un link per reimpostare la password entro pochi minuti.

Q: Posso usare AiutarSi senza condividere la mia posizione?
A: Sì. La posizione è opzionale e serve solo per trovare attività vicine a te. Puoi impostarla manualmente nelle impostazioni oppure negarla e cercare manualmente per città.

--- SEZIONE 2: PUNTI E BADGE (XP) ---
Q: Come funziona il sistema di livelli?
A: Guadagni XP (Punti Esperienza) completando azioni nella piattaforma. All'aumentare degli XP sali di livello: Livello 1 (0 XP), Lvl 2 (110 XP), Lvl 3 (450 XP), Lvl 4 (1000 XP), Lvl 5 (2000 XP), Lvl 6 (3500 XP), Lvl 7 (5500 XP), Lvl 8 (8000 XP), Lvl 9 (11000 XP), Lvl 10+ (ogni +5000 XP).

Q: Come guadagno XP?
A: Ecco come guadagnare XP: Candidatura accettata da un NPO (+200 XP). Attività completata fino a 3h (+100 XP), tra 3 e 6h (+150 XP), oltre 6h (+200 XP). Ogni 10 attività completate (+1000 XP bonus). Condivisione di un'attività (+10 XP, 1 volta per attività). Seguire un NPO (+10 XP). Scrivere 5 recensioni (+150 XP bonus). Raggiungere 100 ore totali di volontariato (+1000 XP bonus una tantum).

Q: Cosa sono i badge?
A: I badge sono distintivi speciali che si sbloccano al raggiungimento di traguardi specifici: Debuttante 🌱 (prima attività completata), Networker 🤝 (segui 5 NPO), Recensore d'Oro 🌟 (5 recensioni scritte), Stacanovista 🏎️ (un'attività di oltre 6 ore), Voce del Popolo 📢 (10 attività condivise), Pilastro 🏛️ (10 attività completate), Veterano 🏅 (100 ore totali raggiunte).

Q: Dove vedo i miei XP e badge?
A: Nella sezione "Profilo" trovi il tuo livello attuale, la barra di avanzamento XP e tutti i badge sbloccati.

Q: Posso perdere XP o livelli?
A: No. Gli XP accumulati non si perdono mai. Puoi solo salire di livello, mai scendere.

--- SEZIONE 3: ISCRIZIONI E ATTIVITÀ ---
Q: Come mi iscrivo a un'attività?
A: Cerca un'attività che ti interessa (nella Home, Esplora o sulla Mappa), apri il dettaglio e tocca "Iscriviti". Sarai confermato automaticamente per il turno.

Q: Dove trovo le attività a cui sono registrato?
A: Puoi verificare lo stato in "Le tue attività" dal tuo profilo. Lì troverai le attività imminenti e quelle passate.

Q: Posso ritirarmi da un'attività?
A: Sì. Finché l'attività non è completata, puoi ritirarla dalla sezione "Le tue attività" nel profilo.

--- SEZIONE 4: DIVENTARE MEMBRO DI UN NPO ---
Q: Come mi candido a un NPO?
A: Visita il profilo di un'organizzazione (NPO) che ti interessa e tocca "Candidati". Invia una breve presentazione. Il NPO valuterà la tua richiesta e potrà accettarla o rifiutarla.

Q: Come faccio a sapere se la mia candidatura è stata accettata?
A: Riceverai una notifica push quando il NPO prenderà una decisione. Puoi anche controllare nella sezione "I tuoi NPO" per vedere a quali organizzazioni sei attualmente affiliato.

Q: Posso far parte di più NPO contemporaneamente?
A: Sì, non c'è limite al numero di collaborazioni che puoi avere. Puoi candidarti ed essere membro di più NPO simultaneamente.

--- SEZIONE 5: NOTIFICHE ---
Q: Non ricevo notifiche, cosa faccio?
A: Verifica che le notifiche siano abilitate nelle impostazioni del dispositivo per AiutarSi. Puoi ricontrollare anche nelle Impostazioni dell'app > Notifiche.

Q: Quali notifiche ricevo?
A: Ricevi notifiche quando: una tua candidatura viene accettata o rifiutata, un NPO aggiorna lo stato di un'attività, ricevi un messaggio in chat, sali di livello o sblocchi un badge.

--- SEZIONE 6: ACCOUNT E PRIVACY ---
Q: Come cambio la mia email o password?
A: Vai su Impostazioni > Sicurezza e credenziali. Puoi modificare email e password da lì.

Q: Chi può vedere il mio profilo?
A: I tuoi dati (nome, foto, bio) sono visibili agli NPO a cui ti candidi e ad altri volontari nella Community. Puoi gestire la visibilità nelle Impostazioni > Privacy e Visibilità.

Q: Come elimino il mio account?
A: Vai in Impostazioni, scorri fino in fondo e tocca "Elimina Account". Avrai 30 giorni per cambiare idea prima che i dati vengano cancellati definitivamente.

--- SEZIONE 7: ASSISTENTE AI (GEMMA) ---
Q: Chi è Gemma?
A: Gemma è l'assistente virtuale ufficiale di AiutarSì. È qui per aiutarti a navigare nell'app, spiegarti le regole del volontariato e suggerirti attività interessanti basate sui tuoi gusti.

Q: Come funziona lo "Smart Match"?
A: Lo Smart Match è un sistema intelligente che analizza le tue preferenze e le attività disponibili per trovare l'abbinamento perfetto. Prova a chiedere a Gemma "Cosa posso fare oggi?" per ricevere suggerimenti personalizzati.

Q: Le risposte di Gemma sono sempre corrette?
A: Gemma risponde basandosi esclusivamente sulle informazioni ufficiali di AiutarSì e sulle attività presenti nel database. Se non conosce una risposta, ti inviterà a consultare le guide o a contattare il supporto, senza mai inventare informazioni.
`;

const SYSTEM_PROMPT = `Tu sei Gemma, l'assistente ufficiale di AiutarSì — un'app di volontariato che connette volontari e organizzazioni non-profit.
Il tuo database di conoscenze è aggiornato al 18 Marzo 2026.
Gemma, ora sei integrata con un sistema di matchmaking vettoriale (Hugging Face). Se un utente ti chiede 'Cosa posso fare?', cerca di incoraggiarlo a usare l'esplorazione Smart Match o farti guidare dalle attività suggerite con score > 0.7. Conosci i 10 livelli di carriera (da Novizio a Mito) e incoraggia chi è vicino al traguardo (-50 XP). Se un'attività è finita, ricorda all'utente di usare il tasto 'Recensisci'.
Il tuo unico scopo è aiutare gli utenti (Volontari e NPO) usando ESCLUSIVAMENTE le informazioni che ti vengono fornite in questo prompt (attività da DB o testo del Centro Assistenza).

REGOLA CRITICA E GUARDRAIL:
Non inventare MAI informazioni, policy, nomi di enti, luoghi o funzionalità che non sono presenti nelle guide sottostanti o nelle attività esplicitamente fornite.
Se un utente ti fa una domanda la cui risposta non è contenuta nel contesto fornito, DEVI rispondere: "Mi dispiace, non ho questa informazione a disposizione. Prova a cercare nell'app o a riformulare la domanda!"
Se una domanda non riguarda AiutarSì, rispondi gentilmente che non puoi assisterlo su quell'argomento.

Rispondi sempre in italiano, in modo cordiale, chiaro e conciso (max 3-4 frasi).
Puoi usare emoji per rendere la risposta più amichevole.

${HELP_CENTER_CONTEXT}
`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    const { question, history } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: 'Domanda mancante' }), { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(`Missing vars: URL=${!!supabaseUrl}, KEY=${!!serviceRoleKey}`);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch HF API Key from database or env (using the stored one as fallback)
    const { data: secretData } = await supabase
        .from('internal_secrets')
        .select('value')
        .eq('key', 'HUGGINGFACE_API_KEY')
        .single();
    
    const tokenToUse = secretData?.value || hfApiKey;

    // 1. Generate text embedding for the user's question
    let suggestedActivitiesText = "";
    
    try {
        const hfEmbedResponse = await fetch(
            `https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction`,
            {
                headers: {
                    Authorization: `Bearer ${tokenToUse}`,
                    "Content-Type": "application/json",
                    "x-wait-for-model": "true",
                },
                method: "POST",
                body: JSON.stringify({ inputs: question }),
            }
        );

        if (hfEmbedResponse.ok) {
            const hfResult = await hfEmbedResponse.json();
            const queryEmbedding = Array.isArray(hfResult[0]) ? hfResult[0] : hfResult;

            if (queryEmbedding && queryEmbedding.length === 384) {
                // 2. Query Supabase for matching open activities (>0.70)
                const { data: matchedActivities, error: matchError } = await supabase.rpc('match_activities', {
                    query_embedding: queryEmbedding,
                    match_threshold: 0.70,
                    match_count: 3,
                    user_lat: null,
                    user_lng: null
                });

                if (!matchError && matchedActivities && matchedActivities.length > 0) {
                    suggestedActivitiesText = "\n\nATTIVITÀ SUGGERITE (Smart Match > 0.70):\n";
                    matchedActivities.forEach((act: any, index: number) => {
                        suggestedActivitiesText += `${index + 1}. Titolo: "${act.title}" presso ${act.npo_name}. Categoria: ${act.category}. Descrizione breve: ${act.description.substring(0, 100)}...\n`;
                    });
                    suggestedActivitiesText += "\nSe l'utente cerca qualcosa da fare, proponi rigorosamente QUESTE attività reali disponibili sull'app e non inventarne altre. Suggerisci loro di cercarle nella Home o Esplora.";
                }
            }
        }
    } catch (embErr) {
        console.error("Embedding / Match Error:", embErr);
        // Continue even if embedding fails to still answer the question
    }

    // 3. Construct messages array compatible with OpenAI API
    const messages = [
      { role: "system", content: SYSTEM_PROMPT + suggestedActivitiesText },
      { role: "assistant", content: "Ciao! Sono Gemma, il tuo assistente su AiutarSì 👋 Come posso aiutarti?" },
    ];

    // Format old history
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messages.push({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.parts?.[0]?.text || ""
        });
      }
    }

    // Add current question
    messages.push({ role: "user", content: question });

    // 4. Call HuggingFace LLM
    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tokenToUse}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/Meta-Llama-3-8B-Instruct",
          messages: messages,
          temperature: 0.7,
          max_tokens: 500,
          frequency_penalty: 0.15,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API Error: ${errorText}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "Mi dispiace, non ho trovato una risposta. Prova a riformulare la domanda!";

    return new Response(JSON.stringify({ answer }), {
      headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    console.error('[GemmaHelp Error]', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
});
