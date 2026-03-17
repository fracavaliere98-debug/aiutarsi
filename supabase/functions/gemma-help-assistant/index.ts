import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

--- SEZIONE 3: CANDIDATURE E ATTIVITÀ ---
Q: Come mi candido a un'attività?
A: Cerca un'attività che ti interessa (nella Home, Esplora o sulla Mappa), apri il dettaglio e tocca "Candidati". Il NPO riceverà la tua candidatura e potrà accettarla o rifiutarla.

Q: Come faccio a sapere se la mia candidatura è stata accettata?
A: Ricevi una notifica push quando il NPO aggiorna lo stato della tua candidatura. Puoi anche controllare lo stato nella sezione "Le tue attività" nel profilo.

Q: Posso ritirarmi da un'attività dopo essermi candidato?
A: Sì. Finché l'attività non è completata, puoi ritirarla dalla sezione "Le tue attività".

Q: Posso candidarmi a più attività contemporaneamente?
A: Sì, puoi candidarti a quante attività vuoi. Non c'è limite.

--- SEZIONE 4: NOTIFICHE ---
Q: Non ricevo notifiche, cosa faccio?
A: Verifica che le notifiche siano abilitate nelle impostazioni del dispositivo per AiutarSi. Puoi ricontrollare anche nelle Impostazioni dell'app > Notifiche.

Q: Quali notifiche ricevo?
A: Ricevi notifiche quando: una tua candidatura viene accettata o rifiutata, un NPO aggiorna lo stato di un'attività, ricevi un messaggio in chat, sali di livello o sblocchi un badge.

--- SEZIONE 5: ACCOUNT E PRIVACY ---
Q: Come cambio la mia email o password?
A: Vai su Impostazioni > Sicurezza e credenziali. Puoi modificare email e password da lì.

Q: Chi può vedere il mio profilo?
A: I tuoi dati (nome, foto, bio) sono visibili agli NPO a cui ti candidi e ad altri volontari nella Community. Puoi gestire la visibilità nelle Impostazioni > Privacy e Visibilità.

Q: Come elimino il mio account?
A: Vai in Impostazioni, scorri fino in fondo e tocca "Elimina Account". Avrai 30 giorni per cambiare idea prima che i dati vengano cancellati definitivamente.
`;

const SYSTEM_PROMPT = `Tu sei Gemma, l'assistente ufficiale di AiutarSì — un'app di volontariato che connette volontari e organizzazioni non-profit.
Il tuo unico scopo è aiutare gli utenti (Volontari e NPO) usando ESCLUSIVAMENTE le informazioni contenute nelle guide del Centro Assistenza fornite di seguito.
Se una domanda non riguarda AiutarSì o le sue funzionalità, rispondi gentilmente: "Mi dispiace, posso aiutarti solo con le funzionalità di AiutarSì! Hai altre domande sull'app?"
Non inventare informazioni non presenti nelle guide.
Rispondi sempre in italiano, in modo cordiale, chiaro e conciso (max 3-4 frasi).
Puoi usare emoji per rendere la risposta più amichevole.

${HELP_CENTER_CONTEXT}
`;

Deno.serve(async (req) => {
  // Gestione preflight CORS (OPTIONS) se chiamata da web
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    const { question, history } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: 'Domanda mancante' }), { status: 400 });
    }

    // Costruzione array messaggi compatibile OpenAI
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "assistant", content: "Ciao! Sono Gemma, il tuo assistente su AiutarSì 👋 Come posso aiutarti?" },
    ];

    // Formattazione della cronologia vecchia (da app React Natve: {role: "user"|"model", parts: [{text: ""}]})
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messages.push({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.parts?.[0]?.text || ""
        });
      }
    }

    // Aggiunta domanda corrente
    messages.push({ role: "user", content: question });

    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/Meta-Llama-3-8B-Instruct",
          messages: messages,
          temperature: 0.7,
          max_tokens: 500,
          frequency_penalty: 0.15, // Equivalente a repetition_penalty = 1.15 in standard OpenAI
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
  } catch (err) {
    console.error('[GemmaHelp Error]', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
});
