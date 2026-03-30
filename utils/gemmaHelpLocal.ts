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
    const normalizedQuestion = normalizeText(question);
    const compositeQuestion = [...recentUserQuestions.slice(-2), question].join(' ');
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

    if (role === 'NPO' && /(attivit|pubblicat|turn|opportunit)/.test(normalizedQuestion)) {
        if (!npoActivityTitles.length) {
            return "Al momento la tua NPO non ha attività pubblicate. Se vuoi, posso spiegarti come crearne una nuova.";
        }
        return `La tua NPO ha ${npoActivityTitles.length} ${npoActivityTitles.length === 1 ? 'attività pubblicata' : 'attività pubblicate'}.\n\n• ${npoActivityTitles.slice(0, 5).join('\n• ')}`;
    }

    if (role === 'NPO' && /(volontar|candidat|domand|approv)/.test(normalizedQuestion)) {
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

    if (/(profil|chi sono|bio|competenz|skill|interess)/.test(normalizedQuestion)) {
        const lines = [
            context.profile.bio ? `Bio: ${context.profile.bio}` : '',
            context.profile.skills.length ? `Competenze: ${formatList(context.profile.skills.slice(0, 6))}` : '',
            context.profile.interests.length ? `Interessi: ${formatList(context.profile.interests.slice(0, 6))}` : '',
            context.profile.location ? `Posizione: ${context.profile.location}` : '',
        ].filter(Boolean);

        if (lines.length) {
            return `Ecco cosa risulta nel tuo profilo.\n\n${lines.map((line) => `• ${line}`).join('\n')}`;
        }
    }

    if (/(attivit|iscritt|registrat|calend|impegn|prossim)/.test(normalizedQuestion)) {
        if (!registeredLabels.length) {
            return "In questo momento non risulti iscritta a nessuna attività. Se vuoi, posso aiutarti a capire dove cercarle in Esplora o come leggere i consigliati di Gemma.";
        }
        return `Al momento hai ${registeredLabels.length} ${registeredLabels.length === 1 ? 'attività registrata' : 'attività registrate'}.\n\n• ${registeredLabels.slice(0, 4).join('\n• ')}${registeredLabels.length > 4 ? '\n• ...e altre nel tuo calendario personale.' : ''}`;
    }

    if (/(segu|follower|npo segu|enti segu)/.test(normalizedQuestion)) {
        if (!followedNames.length) {
            return "In questo momento non segui nessuna NPO. Puoi aprire il profilo di un ente e toccare Segui per ricevere i suoi aggiornamenti in Community e nelle storie.";
        }
        return `Segui ${followedNames.length} ${followedNames.length === 1 ? 'NPO' : 'NPO'}.\n\n• ${followedNames.slice(0, 5).join('\n• ')}${followedNames.length > 5 ? '\n• ...e altre.' : ''}`;
    }

    if (/(candidat|domand|richiest|approvat|accettat|npo faccio parte|enti faccio parte)/.test(normalizedQuestion)) {
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

    if (/(cosa posso fare|cosa mi consigli|da dove parto|consigliami)/.test(normalizedQuestion)) {
        if (registeredLabels.length) {
            return `Ti conviene partire da ciò che hai già in corso, per esempio ${registeredLabels[0]}. Se vuoi, posso anche aiutarti a leggere meglio i consigliati di Gemma o a capire quali NPO stai già seguendo.`;
        }
        if (pendingNames.length) {
            return `Hai già candidature aperte con ${formatList(pendingNames.slice(0, 3))}. Nel frattempo ti conviene controllare Esplora e le novità delle NPO che segui.`;
        }
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
            return top;
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
