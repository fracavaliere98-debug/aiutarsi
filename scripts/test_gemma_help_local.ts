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
    pendingNpos: [
        { id: 'n3', name: 'Mani Aperte' },
    ],
    approvedNpos: [
        { id: 'n4', name: 'Rete Solidale' },
    ],
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
    pendingVolunteers: [
        { id: 'u1', name: 'Mario Rossi' },
    ],
    approvedVolunteers: [
        { id: 'u2', name: 'Giulia Bianchi' },
        { id: 'u3', name: 'Paolo Neri' },
    ],
};

const scenarios = [
    {
        name: 'Volunteer activities',
        role: 'VOLUNTEER',
        context: volunteerContext,
        question: 'A quali attività sono iscritta?',
        history: [],
    },
    {
        name: 'Volunteer follow-up on follows',
        role: 'VOLUNTEER',
        context: volunteerContext,
        question: 'E quali enti seguo?',
        history: ['Sto guardando il mio profilo'],
    },
    {
        name: 'Volunteer applications',
        role: 'VOLUNTEER',
        context: volunteerContext,
        question: 'Come sono messe le mie candidature?',
        history: [],
    },
    {
        name: 'Volunteer profile retrieval',
        role: 'VOLUNTEER',
        context: volunteerContext,
        question: 'Che cosa c’è nel mio profilo?',
        history: [],
    },
    {
        name: 'Volunteer generic recommendation',
        role: 'VOLUNTEER',
        context: volunteerContext,
        question: 'Da dove parto?',
        history: [],
    },
    {
        name: 'FAQ fallback XP',
        role: 'VOLUNTEER',
        context: volunteerContext,
        question: 'Come funziona il sistema di livelli?',
        history: [],
    },
    {
        name: 'NPO activities',
        role: 'NPO',
        context: npoContext,
        question: 'Quali attività ho pubblicato?',
        history: [],
    },
    {
        name: 'NPO volunteers',
        role: 'NPO',
        context: npoContext,
        question: 'Chi è in attesa di approvazione?',
        history: [],
    },
];

for (const scenario of scenarios) {
    const answer = buildContextAwareHelpAnswer(
        scenario.question,
        scenario.context,
        scenario.role,
        scenario.history
    );

    console.log(`\n=== ${scenario.name} ===`);
    console.log(`Q: ${scenario.question}`);
    console.log(`A: ${answer}`);
}
