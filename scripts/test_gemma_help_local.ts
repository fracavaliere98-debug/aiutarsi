import { buildContextAwareHelpAnswer, type LocalHelpContext } from '../utils/gemmaHelpLocal';

const volunteerContext: LocalHelpContext = {
  profile: {
    displayName: 'Francesca Romano',
    role: 'VOLUNTEER',
    bio: 'Mi piace il sociale e mi occupo di grafica e supporto eventi.',
    location: 'Napoli',
    website: null,
    npoName: null,
    skills: ['Creatività e Grafica', 'Digital & Social Media', 'Assistenza e Compagnia'],
    interests: ['Sociale', 'Animali', 'Educazione'],
  },
  followedNpos: [
    { id: 'n1', name: 'Associare' },
    { id: 'n2', name: 'Casa Verde' },
  ],
  pendingNpos: [{ id: 'n3', name: 'Mani Aperte' }],
  approvedNpos: [{ id: 'n4', name: 'Rete Solidale' }],
  registeredActivities: [
    { id: 'a1', title: 'Distribuzione viveri', dateStart: '2026-04-02T10:00:00.000Z', status: 'REGISTERED', npoName: 'Rete Solidale' },
    { id: 'a2', title: 'Laboratorio creativo', dateStart: '2026-04-05T15:00:00.000Z', status: 'APPROVED', npoName: 'Associare' },
  ],
  npoActivities: [],
  pendingVolunteers: [],
  approvedVolunteers: [],
};

const npoContext: LocalHelpContext = {
  profile: {
    displayName: 'Associare',
    role: 'NPO',
    bio: 'Ci occupiamo di inclusione sociale e laboratori territoriali.',
    location: 'Napoli',
    website: 'https://associare.example',
    npoName: 'Associare',
    skills: ['Educazione e Mentoring', 'Logistica e Distribuzione'],
    interests: ['Sociale', 'Educazione'],
  },
  followedNpos: [],
  pendingNpos: [],
  approvedNpos: [],
  registeredActivities: [],
  npoActivities: [
    { id: 'na1', title: 'Doposcuola di quartiere', status: 'APERTA' },
    { id: 'na2', title: 'Raccolta alimentare', status: 'APERTA' },
  ],
  pendingVolunteers: [{ id: 'u1', name: 'Mario Rossi' }],
  approvedVolunteers: [
    { id: 'u2', name: 'Giulia Bianchi' },
    { id: 'u3', name: 'Paolo Neri' },
  ],
};

const cases = [
  {
    name: 'Volunteer activities direct',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'A quali attività sono iscritta?',
    history: [],
    includes: ['Distribuzione viveri', 'Laboratorio creativo'],
  },
  {
    name: 'Volunteer activity follow-up weekend',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'E quali sono questo weekend?',
    history: ['A quali attività sono iscritta?'],
    includes: ['attività registrate', 'calendario'],
  },
  {
    name: 'Volunteer follows direct',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'Quali enti seguo?',
    history: [],
    includes: ['Associare', 'Casa Verde'],
  },
  {
    name: 'Volunteer follow-up from activities to follows',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'E quali enti seguo?',
    history: ['A quali attività sono iscritta?'],
    includes: ['Associare', 'Casa Verde'],
  },
  {
    name: 'Volunteer follow-up from generic profile',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'E quali enti seguo?',
    history: ['Sto guardando il mio profilo'],
    includes: ['Associare', 'Casa Verde'],
  },
  {
    name: 'Volunteer applications',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'Come sono messe le mie candidature?',
    history: [],
    includes: ['Mani Aperte', 'Rete Solidale'],
  },
  {
    name: 'Volunteer applications follow-up approved only',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'E di quale ente faccio già parte?',
    history: ['Come sono messe le mie candidature?'],
    includes: ['Rete Solidale'],
  },
  {
    name: 'Volunteer profile',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'Che cosa c’è nel mio profilo?',
    history: [],
    includes: ['Bio:', 'Competenze:', 'Interessi:'],
  },
  {
    name: 'Volunteer recommendation',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'Da dove parto?',
    history: [],
    includes: ['Ti conviene partire', 'Distribuzione viveri'],
  },
  {
    name: 'Volunteer xp faq',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'Come funziona il sistema di livelli?',
    history: [],
    includes: ['Livello', 'XP'],
  },
  {
    name: 'Volunteer notifications',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'Che notifiche posso ricevere?',
    history: [],
    includes: ['notifiche', 'attività'],
  },
  {
    name: 'Volunteer community',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'A cosa serve la community?',
    history: [],
    includes: ['Community', 'post'],
  },
  {
    name: 'Volunteer calendar direct',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'Cosa ho in calendario?',
    history: [],
    includes: ['attività registrate', 'Distribuzione viveri'],
  },
  {
    name: 'Volunteer profile to applications follow-up',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'E invece le candidature come stanno?',
    history: ['Che cosa c’è nel mio profilo?'],
    includes: ['Mani Aperte', 'Rete Solidale'],
  },
  {
    name: 'Volunteer xp to profile follow-up',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'E nel mio profilo cosa manca?',
    history: ['Come funziona il sistema di livelli?'],
    includes: ['Bio:', 'Competenze:', 'Interessi:'],
  },
  {
    name: 'Volunteer follows to community follow-up',
    role: 'VOLUNTEER',
    context: volunteerContext,
    question: 'E dove vedo i loro aggiornamenti?',
    history: ['Quali enti seguo?'],
    includes: ['Community', 'aggiornamenti'],
  },
  {
    name: 'NPO activities',
    role: 'NPO',
    context: npoContext,
    question: 'Quali attività ho pubblicato?',
    history: [],
    includes: ['Doposcuola di quartiere', 'Raccolta alimentare'],
  },
  {
    name: 'NPO volunteers',
    role: 'NPO',
    context: npoContext,
    question: 'Chi è in attesa di approvazione?',
    history: [],
    includes: ['Mario Rossi', 'Giulia Bianchi'],
  },
  {
    name: 'NPO volunteers follow-up approved',
    role: 'NPO',
    context: npoContext,
    question: 'E chi è già approvato?',
    history: ['Chi è in attesa di approvazione?'],
    includes: ['Giulia Bianchi', 'Paolo Neri'],
  },
  {
    name: 'NPO activities to volunteers follow-up',
    role: 'NPO',
    context: npoContext,
    question: 'E chi è ancora in attesa?',
    history: ['Quali attività ho pubblicato?'],
    includes: ['Mario Rossi', 'Giulia Bianchi'],
  },
  {
    name: 'NPO volunteers to activities follow-up',
    role: 'NPO',
    context: npoContext,
    question: 'E quali attività ho aperte?',
    history: ['Chi è in attesa di approvazione?'],
    includes: ['Doposcuola di quartiere', 'Raccolta alimentare'],
  },
];

let failures = 0;

for (const testCase of cases) {
  const answer = buildContextAwareHelpAnswer(
    testCase.question,
    testCase.context,
    testCase.role,
    testCase.history
  );

  const missing = testCase.includes.filter((value) => !answer.includes(value));
  if (missing.length > 0) {
    failures++;
    console.error(`FAIL: ${testCase.name}`);
    console.error(`Missing: ${missing.join(', ')}`);
    console.error(`Answer: ${answer}`);
    continue;
  }

  console.log(`PASS: ${testCase.name}`);
}

if (failures > 0) {
  process.exit(1);
}

console.log('All Gemma local help tests passed.');
