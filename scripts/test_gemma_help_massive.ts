import { buildContextAwareHelpAnswer, type LocalHelpContext } from "../utils/gemmaHelpLocal";

const volunteerContext: LocalHelpContext = {
  profile: {
    displayName: "Francesca Romano",
    role: "VOLUNTEER",
    bio: "Mi piace il sociale e mi occupo di grafica e supporto eventi.",
    location: "Napoli",
    website: null,
    npoName: null,
    skills: ["Creatività e Grafica", "Digital & Social Media", "Assistenza e Compagnia"],
    interests: ["Sociale", "Animali", "Educazione"],
  },
  followedNpos: [
    { id: "n1", name: "Associare" },
    { id: "n2", name: "Casa Verde" },
  ],
  pendingNpos: [{ id: "n3", name: "Mani Aperte" }],
  approvedNpos: [{ id: "n4", name: "Rete Solidale" }],
  registeredActivities: [
    { id: "a1", title: "Distribuzione viveri", dateStart: "2026-04-02T10:00:00.000Z", status: "REGISTERED", npoName: "Rete Solidale" },
    { id: "a2", title: "Laboratorio creativo", dateStart: "2026-04-05T15:00:00.000Z", status: "APPROVED", npoName: "Associare" },
  ],
  npoActivities: [],
  pendingVolunteers: [],
  approvedVolunteers: [],
};

const npoContext: LocalHelpContext = {
  profile: {
    displayName: "Associare",
    role: "NPO",
    bio: "Ci occupiamo di inclusione sociale e laboratori territoriali.",
    location: "Napoli",
    website: "https://associare.example",
    npoName: "Associare",
    skills: ["Educazione e Mentoring", "Logistica e Distribuzione"],
    interests: ["Sociale", "Educazione"],
  },
  followedNpos: [],
  pendingNpos: [],
  approvedNpos: [],
  registeredActivities: [],
  npoActivities: [
    { id: "na1", title: "Doposcuola di quartiere", status: "APERTA" },
    { id: "na2", title: "Raccolta alimentare", status: "APERTA" },
  ],
  pendingVolunteers: [{ id: "u1", name: "Mario Rossi" }],
  approvedVolunteers: [
    { id: "u2", name: "Giulia Bianchi" },
    { id: "u3", name: "Paolo Neri" },
  ],
};

const cases = [
  ["VOLUNTEER", "Cosa puoi fare?", [], ["AiutarSì", "Posso aiutarti"]],
  ["VOLUNTEER", "Come trovo una attività?", [], ["Esplora", "Mappa"]],
  ["VOLUNTEER", "come le cerco?", ["Come trovo una attività?"], ["Esplora", "Mappa"]],
  ["VOLUNTEER", "dove vedo le attività a cui sono iscritta?", [], ["Distribuzione viveri", "Laboratorio creativo"]],
  ["VOLUNTEER", "cosa ho in calendario?", [], ["Distribuzione viveri", "attività registrate"]],
  ["VOLUNTEER", "e quali sono questo weekend?", ["dove vedo le attività a cui sono iscritta?"], ["attività registrate", "calendario"]],
  ["VOLUNTEER", "quali enti seguo?", [], ["Associare", "Casa Verde"]],
  ["VOLUNTEER", "e dove vedo i loro aggiornamenti?", ["quali enti seguo?"], ["Community", "aggiornamenti"]],
  ["VOLUNTEER", "come stanno le mie candidature?", [], ["Mani Aperte", "Rete Solidale"]],
  ["VOLUNTEER", "di quale ente faccio già parte?", ["come stanno le mie candidature?"], ["Rete Solidale"]],
  ["VOLUNTEER", "cosa c'è nel mio profilo?", [], ["Bio:", "Competenze:", "Interessi:"]],
  ["VOLUNTEER", "come funziona il sistema di livelli?", [], ["Livello", "XP"]],
  ["VOLUNTEER", "che notifiche posso ricevere?", [], ["notifiche", "attività"]],
  ["VOLUNTEER", "a cosa serve la community?", [], ["Community", "post"]],
  ["VOLUNTEER", "da dove parto?", [], ["Ti conviene partire", "Distribuzione viveri"]],
  ["VOLUNTEER", "posso usare l'app senza posizione?", [], ["posizione", "opzionale"]],
  ["VOLUNTEER", "come cambio password?", [], ["Impostazioni", "Sicurezza"]],
  ["VOLUNTEER", "come elimino l'account?", [], ["Elimina Account", "30 giorni"]],
  ["NPO", "quali attività ho pubblicato?", [], ["Doposcuola di quartiere", "Raccolta alimentare"]],
  ["NPO", "chi è in attesa di approvazione?", [], ["Mario Rossi", "Giulia Bianchi"]],
  ["NPO", "e chi è già approvato?", ["chi è in attesa di approvazione?"], ["Giulia Bianchi", "Paolo Neri"]],
  ["NPO", "e quali attività ho aperte?", ["chi è in attesa di approvazione?"], ["Doposcuola di quartiere", "Raccolta alimentare"]],
  ["NPO", "come creo una nuova attività?", [], ["dashboard NPO", "Aggiungi"]],
  ["NPO", "chi vede il profilo della mia npo?", [], ["volontari", "profilo"]],
  ["NPO", "come funziona la verifica dell'ente?", [], ["documenti", "stato della verifica"]],
] as const;

let failures = 0;

for (const [role, question, history, includes] of cases) {
  const context = role === "NPO" ? npoContext : volunteerContext;
  const answer = buildContextAwareHelpAnswer(question, context, role, [...history]);
  const missing = includes.filter((value) => !answer.includes(value));
  if (missing.length > 0) {
    failures += 1;
    console.error(`FAIL: ${role} :: ${question}`);
    console.error(`Missing: ${missing.join(", ")}`);
    console.error(`Answer: ${answer}`);
  } else {
    console.log(`PASS: ${role} :: ${question}`);
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log("All massive Gemma help tests passed.");
