import { getGuideSectionsForRole } from '../shared/helpCenterContent';

export type LocalHelpContext = {
    profile: {
        displayName: string;
        role: string | null;
        bio?: string | null;
        location?: string | null;
        website?: string | null;
        npoName?: string | null;
        skills: string[];
        interests: string[];
    };
    followedNpos: { id: string; name: string }[];
    pendingNpos: { id: string; name: string }[];
    approvedNpos: { id: string; name: string }[];
    registeredActivities: { id: string; title: string; dateStart: string; status?: string | null; npoName?: string }[];
    npoActivities: { id: string; title: string; status?: string | null }[];
    pendingVolunteers: { id: string; name: string }[];
    approvedVolunteers: { id: string; name: string }[];
};

type SearchDoc = {
    id: string;
    title: string;
    body: string;
    answer: string;
};

type IntentName =
    | 'activities'
    | 'applications'
    | 'followed_npos'
    | 'profile'
    | 'npo_activities'
    | 'npo_volunteers'
    | 'xp_badges'
    | 'notifications'
    | 'calendar'
    | 'community'
    | 'recommendation'
    | 'guide'
    | 'capabilities'
    | 'faq';

type IntentScore = {
    name: IntentName;
    score: number;
    reasons: string[];
};

type ConversationMemory = {
    lastIntent: IntentName | null;
    lastEntityType: 'activity' | 'npo' | 'profile' | 'volunteer' | 'faq' | null;
};

export function normalizeText(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function formatDateLabel(date?: string | null) {
    if (!date) return null;
    try {
        return new Date(date).toLocaleDateString('it-IT', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
        });
    } catch {
        return null;
    }
}

export function formatList(items: string[]) {
    if (!items.length) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} e ${items[1]}`;
    return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

export function buildLocalHelpFallback(question: string, role?: string | null) {
    const sections = getGuideSectionsForRole(role || undefined);
    const query = normalizeText(question);
    const queryTerms = query.split(' ').filter((term) => term.length > 2);

    let bestFaq: { question: string; answer: string } | null = null;
    let bestScore = 0;

    for (const section of sections) {
        for (const faq of section.faqs) {
            const haystack = normalizeText(`${faq.question} ${faq.answer} ${section.title}`);
            let score = 0;
            for (const term of queryTerms) {
                if (haystack.includes(term)) score += term.length > 5 ? 3 : 2;
            }
            if (query && normalizeText(faq.question).includes(query)) score += 6;
            if (score > bestScore) {
                bestScore = score;
                bestFaq = faq;
            }
        }
    }

    if (bestFaq && bestScore >= 3) {
        return `${bestFaq.answer}\n\nSe vuoi, puoi chiedermi anche altro su attività, candidature, profilo o notifiche.`;
    }

    return 'Posso aiutarti sulle guide di AiutarSì e sul tuo contesto in app. Prova a chiedermi di attività, candidature, profilo, NPO, calendario, badge o notifiche.';
}

function hasAny(text: string, patterns: RegExp[]) {
    return patterns.some((pattern) => pattern.test(text));
}

function addScore(target: Record<IntentName, IntentScore>, name: IntentName, amount: number, reason: string) {
    target[name].score += amount;
    target[name].reasons.push(reason);
}

function readConversationMemory(question: string, recentUserQuestions: string[] = []): ConversationMemory {
    const normalizedQuestion = normalizeText(question);
    const lastQuestion = normalizeText(recentUserQuestions[recentUserQuestions.length - 1] || '');
    const isFollowUp = /^(e |ed |oppure|invece|quali|quale|quelle|quelli|quello|come|chi|dove)/.test(normalizedQuestion);

    if (!isFollowUp) {
        return { lastIntent: null, lastEntityType: null };
    }

    if (hasAny(lastQuestion, [/(attivit|iscritt|registrat|impegn|weekend|prossim|calend)/])) {
        return { lastIntent: 'activities', lastEntityType: 'activity' };
    }
    if (hasAny(lastQuestion, [/(segu|follower|enti segu|npo segu)/])) {
        return { lastIntent: 'followed_npos', lastEntityType: 'npo' };
    }
    if (hasAny(lastQuestion, [/(candidat|domand|richiest|approvat|accettat)/])) {
        return { lastIntent: 'applications', lastEntityType: 'npo' };
    }
    if (hasAny(lastQuestion, [/(profil|bio|competenz|skill|interess)/])) {
        return { lastIntent: 'profile', lastEntityType: 'profile' };
    }
    if (hasAny(lastQuestion, [/(volontar|approvazione|approvat)/])) {
        return { lastIntent: 'npo_volunteers', lastEntityType: 'volunteer' };
    }
    if (hasAny(lastQuestion, [/(livell|xp|badge)/])) {
        return { lastIntent: 'xp_badges', lastEntityType: 'faq' };
    }

    return { lastIntent: null, lastEntityType: null };
}

function hasPersonalContextMarkers(normalizedQuestion: string) {
    return hasAny(normalizedQuestion, [
        /\b(io|mio|mia|miei|mie|mi|sono|ho)\b/,
        /(iscritt|registrat|candidat|seguo|profilo|mie attivit|miei enti|mio calendario)/,
    ]);
}

function isContextLookupQuestion(normalizedQuestion: string, role?: string | null) {
    if (role === 'NPO') {
        return hasAny(normalizedQuestion, [
            /(ho pubblicat|quali attivit ho|chi e in attesa|chi e gia approvato|volontari approvati|volontari in attesa)/,
        ]);
    }

    return hasAny(normalizedQuestion, [
        /(a quali attivit sono iscritt|dove vedo le attivit a cui sono registrat|quali enti seguo|come stanno le mie candidature|cosa ho in calendario|cosa c e nel mio profilo|faccio parte di)/,
    ]);
}

function isGuideQuestion(normalizedQuestion: string) {
    return hasAny(normalizedQuestion, [
        /(come trovo|come cerco|dove cerco|come funziona|come faccio a trovare|dove trovo)/,
        /(esplora|mappa|home|consigliati|smart match)/,
        /(come cambio password|come elimino|chi vede|come creo|come pubblico|come mi iscrivo|posso usare)/,
    ]);
}

function isCapabilityQuestion(normalizedQuestion: string) {
    return hasAny(normalizedQuestion, [
        /(cosa puoi fare|come puoi aiutarmi|in cosa mi puoi aiutare|cosa sai fare)/,
    ]);
}

function scoreIntent(question: string, role: string | null | undefined, recentUserQuestions: string[] = []): IntentScore[] {
    const normalizedQuestion = normalizeText(question);
    const memory = readConversationMemory(question, recentUserQuestions);
    const intents: Record<IntentName, IntentScore> = {
        activities: { name: 'activities', score: 0, reasons: [] },
        applications: { name: 'applications', score: 0, reasons: [] },
        followed_npos: { name: 'followed_npos', score: 0, reasons: [] },
        profile: { name: 'profile', score: 0, reasons: [] },
        npo_activities: { name: 'npo_activities', score: 0, reasons: [] },
        npo_volunteers: { name: 'npo_volunteers', score: 0, reasons: [] },
        xp_badges: { name: 'xp_badges', score: 0, reasons: [] },
        notifications: { name: 'notifications', score: 0, reasons: [] },
        calendar: { name: 'calendar', score: 0, reasons: [] },
        community: { name: 'community', score: 0, reasons: [] },
        recommendation: { name: 'recommendation', score: 0, reasons: [] },
        guide: { name: 'guide', score: 0, reasons: [] },
        capabilities: { name: 'capabilities', score: 0, reasons: [] },
        faq: { name: 'faq', score: 0, reasons: [] },
    };

    const personalContext = hasPersonalContextMarkers(normalizedQuestion);
    const contextLookup = isContextLookupQuestion(normalizedQuestion, role);

    if (hasAny(normalizedQuestion, [/(attivit|iscritt|registrat|impegn|weekend|prossim|disponibil)/])) {
        addScore(intents, 'activities', 8, 'activity keywords');
    }
    if (hasAny(normalizedQuestion, [/(calend|oggi|domani|settiman)/])) {
        addScore(intents, 'calendar', 6, 'calendar keywords');
        addScore(intents, 'activities', 3, 'calendar implies activities');
    }
    if (hasAny(normalizedQuestion, [/(candidat|domand|richiest|approvat|accettat|rifiutat|pending)/])) {
        addScore(intents, 'applications', 8, 'application keywords');
    }
    if (hasAny(normalizedQuestion, [/(di quale ente faccio gia parte|di quale ente faccio parte|faccio gia parte|faccio parte di|mia candidatura)/])) {
        addScore(intents, 'applications', 10, 'membership/application phrasing');
    }
    if (hasAny(normalizedQuestion, [/(segu|seguo|follower|enti segu|npo segu|associazioni segu|quali enti|quali npo|associazioni seguite)/])) {
        addScore(intents, 'followed_npos', 10, 'follow keywords');
    }
    if (hasAny(normalizedQuestion, [/(profil|bio|competenz|skill|interess|chi sono|su di me)/])) {
        addScore(intents, 'profile', 8, 'profile keywords');
    }
    if (hasAny(normalizedQuestion, [/(livell|xp|badge|esperienz)/])) {
        addScore(intents, 'xp_badges', 8, 'gamification keywords');
        addScore(intents, 'faq', 3, 'faq overlap');
    }
    if (hasAny(normalizedQuestion, [/(notifich|avvis|promemori)/])) {
        addScore(intents, 'notifications', 8, 'notification keywords');
    }
    if (hasAny(normalizedQuestion, [/(community|post|storie|story|feed)/])) {
        addScore(intents, 'community', 7, 'community keywords');
    }
    if (hasAny(normalizedQuestion, [/(consigli|da dove parto|cosa posso fare|cosa mi consigli)/])) {
        addScore(intents, 'recommendation', 9, 'recommendation keywords');
    }
    if (isGuideQuestion(normalizedQuestion)) {
        addScore(intents, 'guide', 11, 'guide keywords');
        addScore(intents, 'faq', 4, 'guide faq overlap');
    }
    if (isCapabilityQuestion(normalizedQuestion)) {
        addScore(intents, 'capabilities', 14, 'capabilities keywords');
        addScore(intents, 'faq', 4, 'capabilities faq overlap');
    }

    if (role === 'NPO' && hasAny(normalizedQuestion, [/(attivit|pubblicat|opportunit|progett)/])) {
        addScore(intents, 'npo_activities', 9, 'npo activities keywords');
    }
    if (role === 'NPO' && hasAny(normalizedQuestion, [/(volontar|approvazione|candidature ricevute|chi e in attesa|chi e gia approvato|gia approvat|in attesa)/])) {
        addScore(intents, 'npo_volunteers', 11, 'npo volunteers keywords');
    }

    if (memory.lastIntent) {
        addScore(intents, memory.lastIntent, 4, 'follow-up memory');
        if (memory.lastIntent === 'activities' && hasAny(normalizedQuestion, [/(quali|quelle|quelli|questo weekend|domani|oggi)/])) {
            addScore(intents, 'activities', 4, 'follow-up refinement');
        }
        if (memory.lastIntent === 'followed_npos' && hasAny(normalizedQuestion, [/(quali|enti|npo|associazioni)/])) {
            addScore(intents, 'followed_npos', 4, 'follow-up refinement');
        }
        if (memory.lastIntent === 'npo_volunteers' && hasAny(normalizedQuestion, [/(chi|approvat|attesa|volontar)/])) {
            addScore(intents, 'npo_volunteers', 5, 'npo volunteer follow-up refinement');
        }
    }

    if (topLevelFollowQuestion(normalizedQuestion)) {
        addScore(intents, 'followed_npos', 4, 'direct follow phrasing');
    }

    if (role === 'NPO' && hasAny(normalizedQuestion, [/(chi)/]) && hasAny(normalizedQuestion, [/(approvat|attesa)/])) {
        addScore(intents, 'npo_volunteers', 4, 'npo who-is-approved phrasing');
    }
    if (!contextLookup && (intents.guide.score > 0 || intents.capabilities.score > 0 || !personalContext)) {
        addScore(intents, 'faq', 2, 'generic question prefers guides');
        if (intents.guide.score > 0) addScore(intents, 'guide', 4, 'generic guide preference');
        if (intents.capabilities.score > 0) addScore(intents, 'capabilities', 4, 'generic capability preference');
        if (intents.activities.score > 0) addScore(intents, 'activities', -5, 'avoid personal activity branch for generic how-to');
        if (intents.applications.score > 0) addScore(intents, 'applications', -4, 'avoid personal applications branch for generic how-to');
        if (intents.followed_npos.score > 0) addScore(intents, 'followed_npos', -3, 'avoid personal follows branch for generic how-to');
        if (intents.profile.score > 0) addScore(intents, 'profile', -6, 'avoid personal profile branch for product guidance');
        if (intents.npo_activities.score > 0) addScore(intents, 'npo_activities', -6, 'avoid npo activity state branch for product guidance');
    }

    return Object.values(intents).sort((a, b) => b.score - a.score);
}

function topLevelFollowQuestion(normalizedQuestion: string) {
    return /(quali enti|quali npo|chi seguo|enti seguo|npo seguo)/.test(normalizedQuestion);
}

function renderBulletList(lines: string[], emptyMessage: string, intro: string, nextStep?: string) {
    if (!lines.length) {
        return emptyMessage;
    }
    const body = `${intro}\n\n• ${lines.join('\n• ')}`;
    return nextStep ? `${body}\n\n${nextStep}` : body;
}

function buildActionLine(intent: IntentName, role?: string | null) {
    switch (intent) {
        case 'activities':
        case 'calendar':
            return 'Se vuoi, puoi aprire il calendario o tornare in Esplora per vedere altro.';
        case 'followed_npos':
            return 'Se vuoi, puoi aprire la Community per vedere gli ultimi aggiornamenti di questi enti.';
        case 'applications':
            return 'Se vuoi, posso anche riassumerti le attività legate a queste candidature.';
        case 'profile':
            return 'Se vuoi, posso anche dirti cosa conviene completare o aggiornare nel profilo.';
        case 'npo_activities':
            return 'Se vuoi, posso anche dirti quali attività meritano più attenzione adesso.';
        case 'npo_volunteers':
            return 'Se vuoi, posso anche riassumerti chi è già approvato e chi è ancora in attesa.';
        case 'xp_badges':
            return role === 'NPO'
                ? 'Se vuoi, posso spiegarti meglio livelli, badge e progressi dell’ente.'
                : 'Se vuoi, posso spiegarti meglio livelli, badge e progressi del profilo.';
        case 'community':
            return 'Se vuoi, posso anche aiutarti a capire cosa pubblicare o dove guardare in Community.';
        default:
            return undefined;
    }
}

function scoreTextMatch(query: string, text: string) {
    const queryTerms = normalizeText(query).split(' ').filter((term) => term.length > 2);
    if (!queryTerms.length) return 0;
    const haystack = normalizeText(text);
    let score = 0;
    for (const term of queryTerms) {
        if (haystack.includes(term)) score += term.length >= 6 ? 4 : 2;
    }
    if (haystack.includes(normalizeText(query))) score += 8;
    return score;
}

function buildSearchDocs(context: LocalHelpContext, role?: string | null): SearchDoc[] {
    const docs: SearchDoc[] = [];
    const sections = getGuideSectionsForRole(role || undefined);

    for (const section of sections) {
        for (const faq of section.faqs) {
            docs.push({
                id: `faq:${faq.id}`,
                title: faq.question,
                body: `${section.title}. ${faq.question}. ${faq.answer}`,
                answer: faq.answer,
            });
        }
    }

    const profileLines = [
        context.profile.displayName ? `Profilo: ${context.profile.displayName}.` : '',
        context.profile.npoName ? `Nome NPO: ${context.profile.npoName}.` : '',
        context.profile.bio ? `Bio: ${context.profile.bio}.` : '',
        context.profile.location ? `Posizione: ${context.profile.location}.` : '',
        context.profile.skills.length ? `Competenze: ${context.profile.skills.join(', ')}.` : '',
        context.profile.interests.length ? `Interessi: ${context.profile.interests.join(', ')}.` : '',
    ].filter(Boolean);

    if (profileLines.length) {
        docs.push({
            id: 'profile:summary',
            title: 'Profilo utente',
            body: profileLines.join(' '),
            answer: profileLines.join(' '),
        });
    }

    for (const activity of context.registeredActivities) {
        const dateLabel = formatDateLabel(activity.dateStart);
        docs.push({
            id: `activity:${activity.id}`,
            title: activity.title,
            body: `Attività registrata ${activity.title}. ${activity.npoName ? `NPO ${activity.npoName}. ` : ''}${dateLabel ? `Data ${dateLabel}. ` : ''}${activity.status ? `Stato ${activity.status}.` : ''}`,
            answer: `${activity.title}${activity.npoName ? ` con ${activity.npoName}` : ''}${dateLabel ? `, ${dateLabel}` : ''}.`,
        });
    }

    for (const npo of context.followedNpos) {
        docs.push({
            id: `follow:${npo.id}`,
            title: npo.name,
            body: `NPO seguita ${npo.name}.`,
            answer: `Segui ${npo.name}.`,
        });
    }

    for (const npo of context.pendingNpos) {
        docs.push({
            id: `pending_npo:${npo.id}`,
            title: npo.name,
            body: `Candidatura in attesa con ${npo.name}.`,
            answer: `Hai una candidatura in attesa con ${npo.name}.`,
        });
    }

    for (const npo of context.approvedNpos) {
        docs.push({
            id: `approved_npo:${npo.id}`,
            title: npo.name,
            body: `NPO di cui fai parte ${npo.name}.`,
            answer: `Fai già parte di ${npo.name}.`,
        });
    }

    for (const activity of context.npoActivities) {
        docs.push({
            id: `npo_activity:${activity.id}`,
            title: activity.title,
            body: `Attività della tua NPO ${activity.title}. Stato ${activity.status || 'non specificato'}.`,
            answer: `${activity.title}${activity.status ? ` (${activity.status})` : ''}.`,
        });
    }

    for (const volunteer of context.pendingVolunteers) {
        docs.push({
            id: `pending_volunteer:${volunteer.id}`,
            title: volunteer.name,
            body: `Volontario in attesa di approvazione ${volunteer.name}.`,
            answer: `${volunteer.name} è in attesa di approvazione.`,
        });
    }

    for (const volunteer of context.approvedVolunteers) {
        docs.push({
            id: `approved_volunteer:${volunteer.id}`,
            title: volunteer.name,
            body: `Volontario approvato ${volunteer.name}.`,
            answer: `${volunteer.name} è già approvato.`,
        });
    }

    return docs;
}

export function buildContextAwareHelpAnswer(
    question: string,
    context: LocalHelpContext,
    role?: string | null,
    recentUserQuestions: string[] = []
) {
    const compositeQuestion = [...recentUserQuestions.slice(-3), question].join(' ');
    const rankedIntents = scoreIntent(question, role, recentUserQuestions);
    const topIntent = rankedIntents[0]?.name || 'faq';
    const normalizedQuestion = normalizeText(question);
    const registeredLabels = context.registeredActivities.map((activity) => {
        const dateLabel = formatDateLabel(activity.dateStart);
        return dateLabel
            ? `${activity.title}${activity.npoName ? ` con ${activity.npoName}` : ''} (${dateLabel})`
            : `${activity.title}${activity.npoName ? ` con ${activity.npoName}` : ''}`;
    });
    const followedNames = context.followedNpos.map((npo) => npo.name);
    const pendingNames = context.pendingNpos.map((npo) => npo.name);
    const approvedNames = context.approvedNpos.map((npo) => npo.name);
    const npoActivityTitles = context.npoActivities.map((activity) => activity.title);
    const pendingVolunteerNames = context.pendingVolunteers.map((volunteer) => volunteer.name);
    const approvedVolunteerNames = context.approvedVolunteers.map((volunteer) => volunteer.name);

    if (topIntent === 'capabilities') {
        return "Posso aiutarti in due modi: spiegarti come usare AiutarSì e leggere il tuo contesto reale nell'app. Per esempio posso dirti come trovare attività, leggere candidature, NPO seguite, profilo, calendario, notifiche, community, XP e badge. Se vuoi, puoi chiedermi anche \"Come trovo un'attività?\" oppure \"Che cosa c'è nel mio profilo?\".";
    }

    if (topIntent === 'guide') {
        if (role !== 'NPO' && /(come trovo|come cerco|dove cerco|attivit|esplora|mappa)/.test(normalizedQuestion)) {
            return 'Puoi cercare attività dalla Home con i consigliati, da Esplora usando ricerca e filtri, oppure dalla Mappa per vedere quelle vicine. Quando ne trovi una interessante, apri il dettaglio e tocca "Iscriviti".';
        }
        const docs = buildSearchDocs(context, role);
        const guideMatch = docs
            .map((doc) => ({ doc, score: scoreTextMatch(question, `${doc.title}. ${doc.body}`) }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score)[0];

        if (guideMatch) {
            return `${guideMatch.doc.answer}\n\nSe vuoi, posso anche dirti cosa vedi adesso nel tuo profilo o nelle tue attività.`;
        }

    }

    if (role === 'NPO' && topIntent === 'npo_activities') {
        if (!npoActivityTitles.length) {
            return "Al momento la tua NPO non ha attività pubblicate. Se vuoi, posso spiegarti come crearne una nuova.";
        }
        return renderBulletList(
            npoActivityTitles.slice(0, 5),
            "Al momento la tua NPO non ha attività pubblicate.",
            `La tua NPO ha ${npoActivityTitles.length} ${npoActivityTitles.length === 1 ? 'attività pubblicata' : 'attività pubblicate'}.`,
            buildActionLine('npo_activities', role)
        );
    }

    if (role === 'NPO' && topIntent === 'npo_volunteers') {
        const parts: string[] = [];
        if (approvedVolunteerNames.length) {
            parts.push(`volontari approvati: ${formatList(approvedVolunteerNames.slice(0, 5))}`);
        }
        if (pendingVolunteerNames.length) {
            parts.push(`volontari in attesa: ${formatList(pendingVolunteerNames.slice(0, 5))}`);
        }
        if (!parts.length) {
            return "Al momento non risultano volontari o candidature collegate alla tua NPO.";
        }
        return `Situazione volontari della tua NPO:\n\n• ${parts.join('\n• ')}`;
    }

    if (topIntent === 'profile') {
        const lines = [
            context.profile.bio ? `Bio: ${context.profile.bio}` : '',
            context.profile.skills.length ? `Competenze: ${formatList(context.profile.skills.slice(0, 6))}` : '',
            context.profile.interests.length ? `Interessi: ${formatList(context.profile.interests.slice(0, 6))}` : '',
            context.profile.location ? `Posizione: ${context.profile.location}` : '',
        ].filter(Boolean);

        if (lines.length) {
            return `${context.profile.displayName ? `${context.profile.displayName}, ` : ''}ecco cosa risulta nel tuo profilo.\n\n${lines.map((line) => `• ${line}`).join('\n')}\n\n${buildActionLine('profile', role)}`;
        }
    }

    if (topIntent === 'activities' || topIntent === 'calendar') {
        if (!registeredLabels.length) {
            return "In questo momento non risulti iscritta a nessuna attività. Se vuoi, posso aiutarti a capire dove cercarle in Esplora o come leggere i consigliati di Gemma.";
        }
        const extra = registeredLabels.length > 4 ? [...registeredLabels.slice(0, 4), '...e altre nel tuo calendario personale.'] : registeredLabels.slice(0, 4);
        return renderBulletList(
            extra,
            "In questo momento non risulti iscritta a nessuna attività.",
            `Al momento hai ${registeredLabels.length} ${registeredLabels.length === 1 ? 'attività registrata' : 'attività registrate'}.`,
            buildActionLine(topIntent, role)
        );
    }

    if (topIntent === 'followed_npos') {
        if (!followedNames.length) {
            return "In questo momento non segui nessuna NPO. Puoi aprire il profilo di un ente e toccare Segui per ricevere i suoi aggiornamenti in Community e nelle storie.";
        }
        const items = followedNames.length > 5 ? [...followedNames.slice(0, 5), '...e altre.'] : followedNames.slice(0, 5);
        return renderBulletList(
            items,
            "In questo momento non segui nessuna NPO.",
            `Segui ${followedNames.length} ${followedNames.length === 1 ? 'NPO' : 'NPO'}.`,
            buildActionLine('followed_npos', role)
        );
    }

    if (topIntent === 'applications') {
        const parts: string[] = [];
        if (approvedNames.length) {
            parts.push(`fai già parte di ${formatList(approvedNames.slice(0, 4))}`);
        }
        if (pendingNames.length) {
            parts.push(`hai candidature in attesa con ${formatList(pendingNames.slice(0, 4))}`);
        }
        if (!parts.length) {
            return "In questo momento non risultano candidature attive verso NPO. Se vuoi, posso spiegarti come candidarti o come seguire un ente.";
        }
        return `Ecco la tua situazione attuale: ${parts.join(' e ')}.`;
    }

    if (topIntent === 'recommendation') {
        if (registeredLabels.length) {
            return `Ti conviene partire da ciò che hai già in corso, per esempio ${registeredLabels[0]}. Se vuoi, posso anche aiutarti a leggere meglio i consigliati di Gemma o a capire quali NPO stai già seguendo.`;
        }
        if (pendingNames.length) {
            return `Hai già candidature aperte con ${formatList(pendingNames.slice(0, 3))}. Nel frattempo ti conviene controllare Esplora e le novità delle NPO che segui.`;
        }
    }

    if (topIntent === 'xp_badges') {
        return buildLocalHelpFallback(question, role);
    }

    if (topIntent === 'notifications') {
        return `Le notifiche ti avvisano su attività, candidature, messaggi e novità importanti delle NPO che segui. Se vuoi, posso anche dirti quali promemoria possono arrivarti prima o dopo un’attività.`;
    }

    if (topIntent === 'community') {
        return `In Community puoi seguire aggiornamenti, post e storie degli enti che segui o di cui fai parte. Se vuoi, posso anche aiutarti a capire cosa guardare prima o cosa pubblicare.`;
    }

    const docs = buildSearchDocs(context, role);
    const matches = docs
        .map((doc) => ({ doc, score: scoreTextMatch(compositeQuestion, `${doc.title}. ${doc.body}`) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    if (matches.length) {
        const top = matches[0].doc.answer;
        if (matches.length === 1) {
            return buildActionLine('faq', role) ? `${top}\n\n${buildActionLine('faq', role)}` : top;
        }
        const related = matches
            .slice(1)
            .map((item) => item.doc.title)
            .filter(Boolean);
        if (matches[1].score >= matches[0].score - 2 && related.length) {
            return `${top}\n\nSe stavi chiedendo di qualcosa di più specifico, potrei anche aiutarti su: ${formatList(related)}.`;
        }
        return top;
    }

    return buildLocalHelpFallback(question, role);
}
