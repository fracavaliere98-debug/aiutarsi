export type HelpCenterRole = "VOLUNTEER" | "NPO" | "ALL";

export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export interface GuideSection {
  id: string;
  emoji: string;
  title: string;
  faqs: FAQ[];
}

export const COMMON_GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "start",
    emoji: "🏠",
    title: "Iniziare con AiutarSi",
    faqs: [
      {
        id: "reg",
        question: "Come mi registro su AiutarSi?",
        answer:
          'Scarica l\'app dal tuo store, apri l\'app e scegli "Registrati". Puoi registrarti come Volontario (per partecipare alle attività) o come NPO (ente non-profit, per pubblicare opportunità). Segui l\'onboarding passo per passo per completare il tuo profilo.',
      },
      {
        id: "pwd",
        question: "Ho dimenticato la password, come la recupero?",
        answer:
          'Nella schermata di accesso, tocca "Password dimenticata?" e inserisci la tua email. Riceverai un link per reimpostare la password entro pochi minuti. Controlla anche la cartella spam.',
      },
      {
        id: "loc",
        question: "Posso usare AiutarSi senza condividere la mia posizione?",
        answer:
          'Sì. La posizione è opzionale e serve solo per trovare attività vicine a te. Puoi impostarla manualmente nelle Impostazioni oppure negarla e cercare per città nella sezione Esplora.',
      },
    ],
  },
  {
    id: "notif",
    emoji: "🔔",
    title: "Notifiche",
    faqs: [
      {
        id: "nonotif",
        question: "Non ricevo notifiche, cosa faccio?",
        answer:
          'Verifica che le notifiche siano abilitate nelle impostazioni del dispositivo per AiutarSi. Puoi ricontrollarle anche in Impostazioni > Notifiche nell\'app.',
      },
      {
        id: "whatnotif",
        question: "Quali notifiche ricevo?",
        answer:
          "Ricevi notifiche per messaggi, aggiornamenti attività, candidature e altri eventi importanti legati al tuo profilo.",
      },
    ],
  },
  {
    id: "privacy",
    emoji: "🔒",
    title: "Account e Privacy",
    faqs: [
      {
        id: "creds",
        question: "Come cambio la mia email o password?",
        answer:
          'Vai su Impostazioni > Sicurezza e credenziali. Puoi modificare email e password da lì. Per l\'email è richiesta conferma via link.',
      },
      {
        id: "delete",
        question: "Come elimino il mio account?",
        answer:
          'Vai in Impostazioni, scorri fino in fondo e tocca "Elimina Account". Avrai 30 giorni per cambiare idea prima che i dati vengano cancellati definitivamente.',
      },
    ],
  },
  {
    id: "aiassistant",
    emoji: "🤖",
    title: "Assistente AI (Gemma)",
    faqs: [
      {
        id: "whoisgemma",
        question: "Chi è Gemma?",
        answer:
          "Gemma è l'assistente virtuale ufficiale di AiutarSì. È qui per aiutarti a navigare nell'app, spiegarti le regole del volontariato e suggerirti azioni utili basate sul tuo contesto.",
      },
      {
        id: "accuracy",
        question: "Le risposte di Gemma sono sempre corrette?",
        answer:
          "Gemma risponde basandosi esclusivamente sulle informazioni ufficiali di AiutarSì e sui dati disponibili nell'app. Se non conosce una risposta, ti inviterà a consultare le guide o a contattare il supporto, senza inventare informazioni.",
      },
    ],
  },
];

export const VOLUNTEER_GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "xp",
    emoji: "🌟",
    title: "Punti e Badge (XP)",
    faqs: [
      {
        id: "levels",
        question: "Come funziona il sistema di livelli?",
        answer:
          'Guadagni XP (Punti Esperienza) completando azioni nella piattaforma. All\'aumentare degli XP sali di livello:\n\n' +
          "• Livello 1 · Novizio → 0 XP\n" +
          "• Livello 2 · Apprendista → 110 XP\n" +
          "• Livello 3 · Sociale → 450 XP\n" +
          "• Livello 4 · Attivo → 1.000 XP\n" +
          "• Livello 5 · Esperto → 2.000 XP\n" +
          "• Livello 6 · Mentore → 3.500 XP\n" +
          "• Livello 7 · Pilastro → 5.500 XP\n" +
          "• Livello 8 · Ambasciatore → 8.000 XP\n" +
          "• Livello 9 · Leader → 11.000 XP\n" +
          "• Livello 10+ · Leggenda → ogni +5.000 XP",
      },
      {
        id: "earn",
        question: "Come guadagno XP?",
        answer:
          "Ecco come guadagnare XP:\n\n" +
          "• Approvazione NPO → +200 XP\n" +
          "• Attività completata (<3h) → +100 XP\n" +
          "• Attività completata (3–6h) → +150 XP\n" +
          "• Attività completata (>6h) → +200 XP\n" +
          "• Ogni 10 attività completate → +1.000 XP bonus\n" +
          "• Condivisione attività → +10 XP (1x per attività)\n" +
          "• Seguire un NPO → +10 XP\n" +
          "• 5 recensioni scritte → +150 XP\n" +
          "• Raggiungere 100 ore totali → +1.000 XP una tantum",
      },
      {
        id: "badges",
        question: "Cosa sono i badge?",
        answer:
          "I badge sono distintivi speciali sbloccabili in base alla tua partecipazione, alle ore donate, alla costanza e al coinvolgimento nella piattaforma.",
      },
      {
        id: "seexp",
        question: "Dove vedo i miei XP e badge?",
        answer:
          'Nella sezione "Profilo" trovi il tuo livello attuale, la barra di avanzamento XP e tutti i badge sbloccati con la data di ottenimento.',
      },
    ],
  },
  {
    id: "activities_volunteer",
    emoji: "📋",
    title: "Attività e Iscrizioni",
    faqs: [
      {
        id: "applyact",
        question: "Come mi iscrivo a un'attività?",
        answer:
          'Cerca un\'attività che ti interessa (tramite Home, Esplora o Mappa), apri il dettaglio e tocca "Iscriviti". Sarai confermato automaticamente per il turno.',
      },
      {
        id: "statusact",
        question: "Dove trovo le attività a cui sono registrato?",
        answer:
          'Puoi verificare lo stato in "Le tue attività" dal tuo profilo. Lì troverai le attività imminenti e quelle passate.',
      },
      {
        id: "withdrawact",
        question: "Posso ritirarmi da un'attività?",
        answer:
          'Sì. Finché l\'attività non è completata, puoi ritirarti dalla sezione "Le tue attività" nel profilo.',
      },
      {
        id: "smartmatch",
        question: 'Come funziona lo "Smart Match"?',
        answer:
          'Lo Smart Match analizza il tuo profilo, i tuoi interessi, le tue competenze e il contesto delle attività per proporti opportunità rilevanti. Gemma può aiutarti a capire perché un’attività è adatta a te.',
      },
    ],
  },
  {
    id: "npo_membership",
    emoji: "🏢",
    title: "NPO e Candidature",
    faqs: [
      {
        id: "applynpo",
        question: "Come mi candido a un NPO?",
        answer:
          'Visita il profilo di un\'organizzazione (NPO) che ti interessa e tocca "Candidati". Invia una breve presentazione. Il NPO valuterà la tua richiesta e potrà accettarla o rifiutarla.',
      },
      {
        id: "statusnpo",
        question: "Come faccio a sapere se la mia candidatura è stata accettata?",
        answer:
          'Riceverai una notifica push quando il NPO prenderà una decisione. Puoi anche controllare nella sezione "I tuoi NPO" per vedere a quali organizzazioni sei attualmente affiliato.',
      },
      {
        id: "multinpo",
        question: "Posso far parte di più NPO contemporaneamente?",
        answer:
          "Sì, non c'è limite al numero di collaborazioni che puoi avere. Puoi candidarti ed essere membro di più NPO simultaneamente.",
      },
      {
        id: "whocan_volunteer",
        question: "Chi può vedere il mio profilo?",
        answer:
          'I tuoi dati (nome, foto, bio) sono visibili agli NPO a cui ti candidi e agli altri volontari nella Community. Puoi gestire la visibilità in Impostazioni > Privacy e Visibilità.',
      },
    ],
  },
];

export const NPO_GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "npo_verification",
    emoji: "🏛️",
    title: "Profilo Ente e Verifica",
    faqs: [
      {
        id: "npo_complete_profile",
        question: "Come completo correttamente il profilo della mia organizzazione?",
        answer:
          "Completa nome ente, descrizione, referente, contatti, indirizzo, sito web e documenti di verifica. Un profilo completo aumenta fiducia, candidature e qualità dei match.",
      },
      {
        id: "npo_verification_status",
        question: "Come funziona la verifica dell'ente?",
        answer:
          "Durante l'onboarding o nelle impostazioni puoi caricare i documenti richiesti. Lo stato della verifica viene poi aggiornato dal team di amministrazione e influenza la credibilità del profilo.",
      },
      {
        id: "npo_visibility",
        question: "Chi vede il profilo della mia NPO?",
        answer:
          "Il profilo della tua organizzazione è visibile ai volontari nell'app. Informazioni come descrizione, attività pubblicate e reputazione aiutano i volontari a decidere se candidarsi o seguirti.",
      },
    ],
  },
  {
    id: "npo_activities",
    emoji: "📅",
    title: "Creare e Gestire Attività",
    faqs: [
      {
        id: "npo_create_activity",
        question: "Come creo una nuova attività?",
        answer:
          'Vai nella dashboard NPO e tocca "Aggiungi". Compila titolo, categoria, luogo, data, orari, descrizione, numero di volontari richiesti e, se vuoi, competenze consigliate e immagine.',
      },
      {
        id: "npo_urgent_activity",
        question: "Quando conviene marcare un'attività come urgente?",
        answer:
          "Usa l'opzione urgente quando hai bisogno di volontari in tempi brevi o per iniziative particolarmente sensibili. Le attività urgenti hanno più priorità nella scoperta e nei match.",
      },
      {
        id: "npo_recurring",
        question: "Posso rendere un'attività ricorrente?",
        answer:
          "Sì. Quando crei un'attività puoi impostare una ricorrenza settimanale o mensile per replicare iniziative che funzionano bene nel tempo.",
      },
      {
        id: "npo_ai_draft",
        question: "Cosa significa generare una bozza con AI?",
        answer:
          "La bozza AI ti aiuta a partire più velocemente proponendo un titolo o una descrizione iniziale ispirata alle attività passate della tua NPO. Resta comunque tua la responsabilità di rivedere e completare il contenuto.",
      },
    ],
  },
  {
    id: "npo_volunteers",
    emoji: "🤝",
    title: "Volontari, Followers e Candidature",
    faqs: [
      {
        id: "npo_manage_candidates",
        question: "Dove gestisco candidature e richieste dei volontari?",
        answer:
          'Nella sezione volontari puoi vedere candidature, followers, volontari approvati e storico. Da lì puoi approvare, rifiutare o approfondire i profili.',
      },
      {
        id: "npo_followers_vs_members",
        question: "Che differenza c'è tra followers, candidati e volontari approvati?",
        answer:
          "I followers seguono la tua NPO ma non sono membri. I candidati hanno inviato una richiesta. I volontari approvati sono persone che la tua organizzazione ha già accettato o coinvolto nelle attività.",
      },
      {
        id: "npo_best_matches",
        question: "Come vengono suggeriti i migliori volontari per un'attività?",
        answer:
          "L'app può ordinare i profili in base alla compatibilità tra competenze richieste e dati del volontario. I suggerimenti servono come supporto decisionale, non sostituiscono la valutazione finale del referente.",
      },
      {
        id: "npo_active_volunteers",
        question: "Cosa significa vedere volontari attivi nella dashboard?",
        answer:
          "La dashboard evidenzia i volontari recentemente presenti o coinvolti, così puoi capire rapidamente chi è più vicino all'operatività in questo momento.",
      },
    ],
  },
  {
    id: "npo_ai_insights",
    emoji: "🧠",
    title: "Insight e Suggerimenti per NPO",
    faqs: [
      {
        id: "npo_dashboard_insights",
        question: "Cosa sono gli insight nella dashboard NPO?",
        answer:
          "Sono suggerimenti operativi che evidenziano priorità come attività con pochi iscritti, candidature in attesa, periodi senza iniziative o attività andate molto bene. Ti aiutano a capire su cosa intervenire per primo.",
      },
      {
        id: "npo_ai_actions",
        question: "Gemma può aiutarmi a decidere le prossime azioni come NPO?",
        answer:
          "Sì. Gemma può essere usata come supporto per interpretare il contesto della tua dashboard, capire dove ci sono colli di bottiglia e suggerire il prossimo passo più utile per l'ente.",
      },
    ],
  },
];

export function getGuideSectionsForRole(role?: string | null): GuideSection[] {
  if (role === "NPO") {
    return [...COMMON_GUIDE_SECTIONS, ...NPO_GUIDE_SECTIONS];
  }
  if (role === "VOLUNTEER") {
    return [...COMMON_GUIDE_SECTIONS, ...VOLUNTEER_GUIDE_SECTIONS];
  }
  return [...COMMON_GUIDE_SECTIONS];
}

export function getAllGuideSections(): GuideSection[] {
  return [...COMMON_GUIDE_SECTIONS, ...VOLUNTEER_GUIDE_SECTIONS, ...NPO_GUIDE_SECTIONS];
}

export function buildHelpCenterContext(sections: GuideSection[] = getAllGuideSections()): string {
  return sections
    .map((section) => {
      const faqs = section.faqs
        .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
        .join("\n\n");
      return `--- ${section.title.toUpperCase()} ---\n${faqs}`;
    })
    .join("\n\n");
}

export function buildHelpCenterContextForRole(role?: string | null): string {
  return buildHelpCenterContext(getGuideSectionsForRole(role));
}
