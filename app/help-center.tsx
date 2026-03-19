import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    LayoutAnimation,
    Platform,
    UIManager,
    Image,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, LifeBuoy } from 'lucide-react-native';
import { StandardLayout } from '../components/StandardLayout';
import { SoftCard } from '../components/SoftCard';
import { Colors } from '../constants/Colors';
import { GemmaAIChat } from '../components/GemmaAIChat';
import { supabase } from '../utils/supabase';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQ {
    id: string;
    question: string;
    answer: string;
}

interface GuideSection {
    id: string;
    emoji: string;
    title: string;
    faqs: FAQ[];
}

const GUIDE_SECTIONS: GuideSection[] = [
    {
        id: 'start',
        emoji: '🏠',
        title: 'Iniziare con AiutarSi',
        faqs: [
            {
                id: 'reg',
                question: 'Come mi registro su AiutarSi?',
                answer: 'Scarica l\'app dal tuo store, apri l\'app e scegli "Registrati". Puoi registrarti come Volontario (per partecipare alle attività) o come NPO (ente non-profit, per pubblicare opportunità). Segui l\'onboarding passo per passo per completare il tuo profilo.',
            },
            {
                id: 'pwd',
                question: 'Ho dimenticato la password, come la recupero?',
                answer: 'Nella schermata di accesso, tocca "Password dimenticata?" e inserisci la tua email. Riceverai un link per reimpostare la password entro pochi minuti. Controlla anche la cartella spam.',
            },
            {
                id: 'loc',
                question: 'Posso usare AiutarSi senza condividere la mia posizione?',
                answer: 'Sì. La posizione è opzionale e serve solo per trovare attività vicine a te. Puoi impostarla manualmente nelle Impostazioni oppure negarla e cercare per città nella sezione Esplora.',
            },
        ],
    },
    {
        id: 'xp',
        emoji: '🌟',
        title: 'Punti e Badge (XP)',
        faqs: [
            {
                id: 'levels',
                question: 'Come funziona il sistema di livelli?',
                answer: 'Guadagni XP (Punti Esperienza) completando azioni nella piattaforma. All\'aumentare degli XP sali di livello:\n\n' +
                    '• Livello 1 → 0 XP\n' +
                    '• Livello 2 → 110 XP\n' +
                    '• Livello 3 → 450 XP\n' +
                    '• Livello 4 → 1.000 XP\n' +
                    '• Livello 5 → 2.000 XP\n' +
                    '• Livello 6 → 3.500 XP\n' +
                    '• Livello 7 → 5.500 XP\n' +
                    '• Livello 8 → 8.000 XP\n' +
                    '• Livello 9 → 11.000 XP\n' +
                    '• Livello 10+ → ogni +5.000 XP',
            },
            {
                id: 'earn',
                question: 'Come guadagno XP?',
                answer: 'Ecco come guadagnare XP:\n\n' +
                    '• Approvazione NPO → +200 XP\n' +
                    '• Attività completata (<3h) → +100 XP\n' +
                    '• Attività completata (3–6h) → +150 XP\n' +
                    '• Attività completata (>6h) → +200 XP\n' +
                    '• Ogni 10 attività completate → +1.000 XP bonus\n' +
                    '• Condivisione attività → +10 XP (1x per attività)\n' +
                    '• Seguire un NPO → +10 XP\n' +
                    '• 5 recensioni scritte → +150 XP\n' +
                    '• Raggiungere 100 ore totali → +1.000 XP una tantum',
            },
            {
                id: 'badges',
                question: 'Cosa sono i badge?',
                answer: 'I badge sono distintivi speciali sbloccabili:\n\n' +
                    '🌱 Debuttante – prima attività completata\n' +
                    '🏛️ Pilastro – 10 attività completate\n' +
                    '🏎️ Stacanovista – attività superiore a 6 ore\n' +
                    '🛠️ Tuttofare – attività in 3 categorie differenti\n' +
                    '🗓️ Fedelissimo – attività per 4 settimane consecutive\n' +
                    '🏅 Veterano – 100 ore totali di volontariato\n' +
                    '🦉 Gufo Notturno – attività tra le 20:00 e le 07:00\n' +
                    '📢 Voce del Popolo – 10 attività condivise\n' +
                    '🤝 Networker – segui 5 NPO diverse\n' +
                    '🎂 Anniversario – attivo per 1 anno\n' +
                    '🌟 Recensore d\'Oro – 5 recensioni scritte',
            },
            {
                id: 'seexp',
                question: 'Dove vedo i miei XP e badge?',
                answer: 'Nella sezione "Profilo" trovi il tuo livello attuale, la barra di avanzamento XP e tutti i badge sbloccati con la data di ottenimento.',
            },
            {
                id: 'lose',
                question: 'Posso perdere XP o livelli?',
                answer: 'No. Gli XP accumulati non si perdono mai. Puoi solo salire di livello, mai scendere. Continua a partecipare per sbloccare tutti i badge!',
            },
        ],
    },
    {
        id: 'activities',
        emoji: '📋',
        title: 'Registrarsi a un\'attività',
        faqs: [
            {
                id: 'applyact',
                question: 'Come mi iscrivo a un\'attività?',
                answer: 'Cerca un\'attività che ti interessa (tramite Home, Esplora o Mappa), apri il dettaglio e tocca "Iscriviti". Sarai confermato automaticamente per il turno.',
            },
            {
                id: 'statusact',
                question: 'Dove trovo le attività a cui sono registrato?',
                answer: 'Puoi verificare lo stato in "Le tue attività" dal tuo profilo. Li troverai le attività imminenti e quelle passate.',
            },
            {
                id: 'withdrawact',
                question: 'Posso ritirarmi da un\'attività?',
                answer: 'Sì. Finché l\'attività non è completata, puoi ritirarla dalla sezione "Le tue attività" nel profilo.',
            },
        ],
    },
    {
        id: 'npoauth',
        emoji: '🏢',
        title: 'Diventare membro di un NPO',
        faqs: [
            {
                id: 'applynpo',
                question: 'Come mi candido a un NPO?',
                answer: 'Visita il profilo di un\'organizzazione (NPO) che ti interessa e tocca "Candidati". Invia una breve presentazione. Il NPO valuterà la tua richiesta e potrà accettarla o rifiutarla.',
            },
            {
                id: 'statusnpo',
                question: 'Come faccio a sapere se la mia candidatura è stata accettata?',
                answer: 'Riceverai una notifica push quando il NPO prenderà una decisione. Puoi anche controllare nella sezione "I tuoi NPO" per vedere a quali organizzazioni sei attualmente affiliato.',
            },
            {
                id: 'multinpo',
                question: 'Posso far parte di più NPO contemporaneamente?',
                answer: 'Sì, non c\'è limite al numero di collaborazioni che puoi avere. Puoi candidarti ed essere membro di più NPO simultaneamente.',
            },
        ],
    },
    {
        id: 'notif',
        emoji: '🔔',
        title: 'Notifiche',
        faqs: [
            {
                id: 'nonotif',
                question: 'Non ricevo notifiche, cosa faccio?',
                answer: 'Verifica che le notifiche siano abilitate nelle impostazioni del dispositivo per AiutarSi. Puoi ricontrollarle anche in Impostazioni > Notifiche nell\'app.',
            },
            {
                id: 'whatnotif',
                question: 'Quali notifiche ricevo?',
                answer: 'Ricevi notifiche per: candidatura a NPO accettata/rifiutata, aggiornamento stato attività, nuovo messaggio in chat, salita di livello, nuovo badge sbloccato.',
            },
        ],
    },
    {
        id: 'privacy',
        emoji: '🔒',
        title: 'Account e Privacy',
        faqs: [
            {
                id: 'creds',
                question: 'Come cambio la mia email o password?',
                answer: 'Vai su Impostazioni > Sicurezza e credenziali. Puoi modificare email e password da lì. Per l\'email è richiesta conferma via link.',
            },
            {
                id: 'whocan',
                question: 'Chi può vedere il mio profilo?',
                answer: 'I tuoi dati (nome, foto, bio) sono visibili agli NPO a cui ti candidi e agli altri volontari nella Community. Puoi gestire la visibilità in Impostazioni > Privacy e Visibilità.',
            },
            {
                id: 'delete',
                question: 'Come elimino il mio account?',
                answer: 'Vai in Impostazioni, scorri fino in fondo e tocca "Elimina Account". Avrai 30 giorni per cambiare idea prima che i dati vengano cancellati definitivamente.',
            },
        ],
    },
    {
        id: 'aiassistant',
        emoji: '🤖',
        title: 'Assistente AI (Gemma)',
        faqs: [
            {
                id: 'whoisgemma',
                question: 'Chi è Gemma?',
                answer: 'Gemma è l\'assistente virtuale ufficiale di AiutarSì. È qui per aiutarti a navigare nell\'app, spiegarti le regole del volontariato e suggerirti attività interessanti basate sui tuoi gusti.',
            },
            {
                id: 'smartmatch',
                question: 'Come funziona lo "Smart Match"?',
                answer: 'Lo Smart Match è un sistema intelligente che analizza le tue preferenze e le attività disponibili per trovare l\'abbinamento perfetto. Prova a chiedere a Gemma "Cosa posso fare oggi?" per ricevere suggerimenti personalizzati.',
            },
            {
                id: 'accuracy',
                question: 'Le risposte di Gemma sono sempre corrette?',
                answer: 'Gemma risponde basandosi esclusivamente sulle informazioni ufficiali di AiutarSì e sulle attività presenti nel database. Se non conosce una risposta, ti inviterà a consultare le guide o a contattare il supporto, senza mai inventare informazioni.',
            },
        ],
    },
];

// Accordion FAQ item
const FAQItem = ({ faq, isOpen, onToggle, onFeedback }: {
    faq: FAQ;
    isOpen: boolean;
    onToggle: () => void;
    onFeedback: (id: string, val: 'up' | 'down') => void;
}) => {
    const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);

    const handleFeedback = (val: 'up' | 'down') => {
        setFeedbackGiven(val);
        onFeedback(faq.id, val);
    };

    return (
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
            <TouchableOpacity
                onPress={onToggle}
                activeOpacity={0.7}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    gap: 12,
                }}
            >
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: Colors.primary, lineHeight: 21 }}>
                    {faq.question}
                </Text>
                {isOpen ? (
                    <ChevronUp size={18} color={Colors.accent} />
                ) : (
                    <ChevronDown size={18} color={Colors.secondary} />
                )}
            </TouchableOpacity>

            {isOpen && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: Colors.secondary, lineHeight: 22 }}>{faq.answer}</Text>

                    {/* Thumbs feedback */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: 12,
                        gap: 8,
                    }}>
                        <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '600' }}>
                            Questa guida ti ha aiutato?
                        </Text>
                        <TouchableOpacity
                            onPress={() => handleFeedback('up')}
                            style={{
                                padding: 6,
                                borderRadius: 20,
                                backgroundColor: feedbackGiven === 'up' ? '#dcfce7' : '#f1f5f9',
                            }}
                            disabled={feedbackGiven !== null}
                        >
                            <ThumbsUp size={14} color={feedbackGiven === 'up' ? '#16a34a' : '#9ca3af'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleFeedback('down')}
                            style={{
                                padding: 6,
                                borderRadius: 20,
                                backgroundColor: feedbackGiven === 'down' ? '#fee2e2' : '#f1f5f9',
                            }}
                            disabled={feedbackGiven !== null}
                        >
                            <ThumbsDown size={14} color={feedbackGiven === 'down' ? '#dc2626' : '#9ca3af'} />
                        </TouchableOpacity>
                        {feedbackGiven && (
                            <Text style={{ fontSize: 11, color: feedbackGiven === 'up' ? '#16a34a' : '#dc2626', fontWeight: '700' }}>
                                {feedbackGiven === 'up' ? 'Grazie! 🎉' : 'Grazie, miglioreremo!'}
                            </Text>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
};

// Accordion section
const GuideSectionCard = ({ section }: { section: GuideSection }) => {
    const [openFaqs, setOpenFaqs] = useState<Set<string>>(new Set());

    const toggleFaq = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpenFaqs(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleFeedback = async (faqId: string, val: 'up' | 'down') => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('faq_feedback').insert({
                faq_id: faqId,
                section_id: section.id,
                faq_question: section.faqs.find(f => f.id === faqId)?.question || faqId,
                vote: val,
                user_id: user?.id || null,
            });
            console.log(`Feedback [${val}] saved for FAQ: ${section.id}/${faqId}`);
        } catch (error) {
            console.error('Error saving FAQ feedback:', error);
        }
    };

    return (
        <SoftCard style={{ marginBottom: 16, overflow: 'hidden' }}>
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#f1f5f9',
                gap: 10,
            }}>
                <Text style={{ fontSize: 22 }}>{section.emoji}</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: Colors.primary }}>{section.title}</Text>
            </View>
            {section.faqs.map((faq) => (
                <FAQItem
                    key={faq.id}
                    faq={faq}
                    isOpen={openFaqs.has(faq.id)}
                    onToggle={() => toggleFaq(faq.id)}
                    onFeedback={handleFeedback}
                />
            ))}
        </SoftCard>
    );
};

// Floating Gemma Button with breathing animation
const GemmaFloatingButton = ({ onPress }: { onPress: () => void }) => {
    const scale = useSharedValue(1);

    useEffect(() => {
        scale.value = withRepeat(
            withSequence(
                withTiming(1.06, { duration: 900 }),
                withTiming(1, { duration: 900 }),
            ),
            -1,
            false
        );
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={[
            {
                position: 'absolute',
                bottom: 24,
                right: 20,
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 10,
                borderRadius: 40,
            },
            animStyle,
        ]}>
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.85}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: Colors.primary,
                    borderRadius: 40,
                    paddingVertical: 10,
                    paddingLeft: 10,
                    paddingRight: 16,
                    gap: 8,
                }}
            >
                <Image
                    source={require('../assets/images/gemma_avatar.png')}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#7c3aed20' }}
                    resizeMode="contain"
                />
                <View>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: 'white' }}>Chiedi a Gemma</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>Assistente AI</Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function HelpCenterScreen() {
    const router = useRouter();
    const [chatVisible, setChatVisible] = useState(false);

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <StandardLayout
                label="Supporto"
                title="Centro Assistenza"
                onBack={() => router.back()}
            >
                {/* Intro Banner */}
                <View style={{
                    backgroundColor: Colors.primary + '0d',
                    borderRadius: 20,
                    padding: 16,
                    marginBottom: 24,
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'center',
                }}>
                    <View style={{
                        backgroundColor: Colors.primary + '15',
                        borderRadius: 24,
                        padding: 10,
                    }}>
                        <LifeBuoy size={28} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '900', color: Colors.primary, marginBottom: 2 }}>
                            Come possiamo aiutarti?
                        </Text>
                        <Text style={{ fontSize: 12, color: Colors.secondary, lineHeight: 17 }}>
                            Sfoglia le guide qui sotto o chiedi direttamente a Gemma, il nostro assistente AI.
                        </Text>
                    </View>
                </View>

                {/* Guide Sections */}
                {GUIDE_SECTIONS.map((section) => (
                    <GuideSectionCard key={section.id} section={section} />
                ))}

                {/* Bottom spacer for floating button */}
                <View style={{ height: 90 }} />
            </StandardLayout>

            {/* Floating Gemma Button */}
            <GemmaFloatingButton onPress={() => setChatVisible(true)} />

            {/* Gemma AI Chat Modal */}
            <GemmaAIChat visible={chatVisible} onClose={() => setChatVisible(false)} />
        </View>
    );
}
