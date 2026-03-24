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

export const GUIDE_SECTIONS: GuideSection[] = [
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
    id: "xp",
    emoji: "🌟",
    title: "Punti e Badge (XP)",
    faqs: [
      {
        id: "levels",
        question: "Come funziona il sistema di livelli?",
        answer:
          'Guadagni XP (Punti Esperienza) completando azioni nella piattaforma. All\'aumentare degli XP sali di livello:\n\n' +
          "• Livello 1 → 0 XP\n" +
          "• Livello 2 → 110 XP\n" +
          "• Livello 3 → 450 XP\n" +
          "• Livello 4 → 1.000 XP\n" +
          "• Livello 5 → 2.000 XP\n" +
          "• Livello 6 → 3.500 XP\n" +
          "• Livello 7 → 5.500 XP\n" +
          "• Livello 8 → 8.000 XP\n" +
          "• Livello 9 → 11.000 XP\n" +
          "• Livello 10+ → ogni +5.000 XP",
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
          "I badge sono distintivi speciali sbloccabili:\n\n" +
          "🌱 Debuttante – prima attività completata\n" +
          "🏛️ Pilastro – 10 attività completate\n" +
          "🏎️ Stacanovista – attività superiore a 6 ore\n" +
          "🛠️ Tuttofare – attività in 3 categorie differenti\n" +
          "🗓️ Fedelissimo – attività per 4 settimane consecutive\n" +
          "🏅 Veterano – 100 ore totali di volontariato\n" +
          "🦉 Gufo Notturno – attività tra le 20:00 e le 07:00\n" +
          "📢 Voce del Popolo – 10 attività condivise\n" +
          "🤝 Networker – segui 5 NPO diverse\n" +
          "🎂 Anniversario – attivo per 1 anno\n" +
          "🌟 Recensore d'Oro – 5 recensioni scritte",
      },
      {
        id: "seexp",
        question: "Dove vedo i miei XP e badge?",
        answer:
          'Nella sezione "Profilo" trovi il tuo livello attuale, la barra di avanzamento XP e tutti i badge sbloccati con la data di ottenimento.',
      },
      {
        id: "lose",
        question: "Posso perdere XP o livelli?",
        answer:
          "No. Gli XP accumulati non si perdono mai. Puoi solo salire di livello, mai scendere. Continua a partecipare per sbloccare tutti i badge!",
      },
    ],
  },
  {
    id: "activities",
    emoji: "📋",
    title: "Registrarsi a un'attività",
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
          'Puoi verificare lo stato in "Le tue attività" dal tuo profilo. Li troverai le attività imminenti e quelle passate.',
      },
      {
        id: "withdrawact",
        question: "Posso ritirarmi da un'attività?",
        answer:
          'Sì. Finché l\'attività non è completata, puoi ritirarla dalla sezione "Le tue attività" nel profilo.',
      },
    ],
  },
  {
    id: "npoauth",
    emoji: "🏢",
    title: "Diventare membro di un NPO",
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
          "Ricevi notifiche per: candidatura a NPO accettata/rifiutata, aggiornamento stato attività, nuovo messaggio in chat, salita di livello, nuovo badge sbloccato.",
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
        id: "whocan",
        question: "Chi può vedere il mio profilo?",
        answer:
          'I tuoi dati (nome, foto, bio) sono visibili agli NPO a cui ti candidi e agli altri volontari nella Community. Puoi gestire la visibilità in Impostazioni > Privacy e Visibilità.',
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
          "Gemma è l'assistente virtuale ufficiale di AiutarSì. È qui per aiutarti a navigare nell'app, spiegarti le regole del volontariato e suggerirti attività interessanti basate sui tuoi gusti.",
      },
      {
        id: "smartmatch",
        question: 'Come funziona lo "Smart Match"?',
        answer:
          'Lo Smart Match è un sistema intelligente che analizza le tue preferenze e le attività disponibili per trovare l\'abbinamento perfetto. Prova a chiedere a Gemma "Cosa posso fare oggi?" per ricevere suggerimenti personalizzati.',
      },
      {
        id: "accuracy",
        question: "Le risposte di Gemma sono sempre corrette?",
        answer:
          "Gemma risponde basandosi esclusivamente sulle informazioni ufficiali di AiutarSì e sulle attività presenti nel database. Se non conosce una risposta, ti inviterà a consultare le guide o a contattare il supporto, senza mai inventare informazioni.",
      },
    ],
  },
];

export function buildHelpCenterContext(sections: GuideSection[] = GUIDE_SECTIONS): string {
  const sectionLabels: Record<string, string> = {
    start: "SEZIONE 1: INIZIARE CON AIUTARSI",
    xp: "SEZIONE 2: PUNTI E BADGE (XP)",
    activities: "SEZIONE 3: ISCRIZIONI E ATTIVITÀ",
    npoauth: "SEZIONE 4: DIVENTARE MEMBRO DI UN NPO",
    notif: "SEZIONE 5: NOTIFICHE",
    privacy: "SEZIONE 6: ACCOUNT E PRIVACY",
    aiassistant: "SEZIONE 7: ASSISTENTE AI (GEMMA)",
  };

  return sections
    .map((section) => {
      const header = sectionLabels[section.id] || section.title.toUpperCase();
      const faqs = section.faqs
        .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
        .join("\n\n");
      return `--- ${header} ---\n${faqs}`;
    })
    .join("\n\n");
}
