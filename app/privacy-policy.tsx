import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StandardLayout } from '../components/StandardLayout';
import { SoftCard } from '../components/SoftCard';

// A26 P8: informativa scritta dai fatti verificati nel codice e sul database (27/10/2026).
// Fonte unica del testo. Se cambia cosa l'app raccoglie, a chi visibilita' o a quali fornitori
// manda dati, va aggiornata qui e va rialzata PRIVACY_POLICY_LAST_UPDATE.
const PRIVACY_POLICY_LAST_UPDATE = '27 Ottobre 2026';
const PRIVACY_CONTACT_EMAIL = 'aiutarsi.it@gmail.com';

type PolicySection = { title: string; paragraphs: string[] };

const SECTIONS: PolicySection[] = [
    {
        title: '1. Chi tratta i tuoi dati',
        paragraphs: [
            `Il titolare del trattamento è il gestore di AiutarSì. Per qualsiasi domanda sui tuoi dati puoi scrivere a ${PRIVACY_CONTACT_EMAIL}.`,
        ],
    },
    {
        title: '2. Quali dati raccogliamo',
        paragraphs: [
            'Account: nome e cognome, email e password (la password è conservata in forma cifrata).',
            'Profilo del volontario: foto, presentazione, interessi, competenze, genere e data di nascita (ci servono per verificare che tu sia maggiorenne), città preferita (facoltativa), livello, punti e badge.',
            'Profilo di un ente o di un\'azienda: nome, indirizzo e posizione, sito, email e telefono pubblici, referente. Per la verifica dell\'ente raccogliamo anche un documento, che vedono solo gli amministratori.',
            'Telefono: facoltativo. Se ti iscrivi a un\'attività puoi condividerlo con l\'ente che la organizza.',
            'Quello che fai nell\'app: candidature, iscrizioni e presenze alle attività, enti che segui, messaggi nelle chat, segnalazioni e blocchi.',
            'Dati tecnici: il codice per inviarti le notifiche, la data dell\'ultimo accesso e i rapporti sugli errori dell\'app.',
        ],
    },
    {
        title: '3. Perché li usiamo',
        paragraphs: [
            'Per far funzionare il servizio che ci chiedi: creare il tuo account, farti trovare dagli enti, gestire candidature, iscrizioni e chat. La base è il contratto che accetti usando AiutarSì.',
            'Per suggerirti attività compatibili (Smart Match), inviarti notifiche e tenere sicura la comunità con segnalazioni e controlli automatici dei contenuti. La base è il nostro interesse legittimo a offrire un servizio sicuro e utile; le notifiche push le attivi tu dal telefono.',
            'Per verificare che tu abbia almeno 18 anni, come previsto dalle regole del servizio.',
        ],
    },
    {
        title: '4. Chi vede i tuoi dati',
        paragraphs: [
            'Profilo pubblico (è l\'impostazione di partenza, la cambi quando vuoi): gli enti verificati e gli altri volontari vedono nome, foto, presentazione, livello, badge, interessi e competenze.',
            'Profilo non pubblico: gli altri vedono solo nome e iniziale del cognome (per esempio «Marta B.») e il livello. Un ente vede il profilo completo solo dopo che agisci verso di lui: ti candidi, ti iscrivi a una sua attività o rispondi a un suo messaggio. Seguire un ente non mostra il tuo profilo. Altri volontari lo vedono completo solo se siete stati approvati dallo stesso ente.',
            'Email: non è mai mostrata agli altri volontari. Se attivi «mostra la mia email», la vede solo l\'ente a cui appartieni (candidatura approvata).',
            'Telefono: non compare mai nel profilo. Lo vede solo l\'ente dell\'attività a cui lo hai condiviso iscrivendoti.',
            'Chat: un ente può scriverti solo se c\'è un legame (una tua candidatura, l\'iscrizione a una sua attività o se lo segui). Tu puoi scrivere agli enti. Puoi bloccare una persona, e se è stata bannita non puoi più scriverle.',
            'Gli enti non ancora verificati non vedono i profili dei volontari.',
        ],
    },
    {
        title: '5. Servizi esterni che ricevono dati',
        paragraphs: [
            'Supabase gestisce database, accesso e file. I server di produzione sono nell\'Unione Europea (Irlanda).',
            'Google (Gemini) riceve: la tua presentazione, i tuoi interessi e le tue competenze per calcolare i suggerimenti; il testo di post e di alcuni messaggi di chat per il controllo automatico dei contenuti; i testi delle attività per migliorarne la descrizione; le domande che scrivi nel Centro Assistenza. Non inviamo a Google la tua email né il tuo telefono. Il trattamento da parte di Google può avvenire anche fuori dall\'Unione Europea.',
            'Expo recapita le notifiche push e gli aggiornamenti dell\'app.',
            'Sentry riceve i rapporti sugli errori dell\'app, che includono il tuo identificativo, la tua email e il tuo nome.',
            'Non vendiamo i tuoi dati e non li usiamo per pubblicità.',
        ],
    },
    {
        title: '6. Per quanto tempo li conserviamo',
        paragraphs: [
            'Finché hai l\'account. Le notifiche si cancellano da sole dopo 20 giorni.',
            'Se chiedi la cancellazione dell\'account dalle impostazioni, hai 30 giorni per ripensarci. Passati i 30 giorni il tuo account viene eliminato insieme ai dati collegati: profilo, candidature, iscrizioni, messaggi che hai inviato, segnalazioni, follow e blocchi. Possono restare per un tempo limitato nelle copie di sicurezza del database.',
        ],
    },
    {
        title: '7. I tuoi diritti',
        paragraphs: [
            `Puoi chiederci di sapere quali dati abbiamo su di te, correggerli, cancellarli o limitarne l'uso scrivendo a ${PRIVACY_CONTACT_EMAIL}. Molti dati li correggi da solo dal profilo, e l'account si cancella dalle impostazioni.`,
            'Puoi opporti ai trattamenti basati sul nostro interesse legittimo. Se ritieni che i tuoi dati siano trattati male puoi presentare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).',
        ],
    },
    {
        title: '8. Età minima',
        paragraphs: [
            'AiutarSì è per persone con almeno 18 anni. Non registriamo minorenni e il controllo viene fatto anche dai nostri server, non solo dall\'app.',
        ],
    },
    {
        title: '9. Modifiche',
        paragraphs: [
            'Se cambiamo questa informativa aggiorniamo la data qui sotto e, se la modifica è importante, ti avvisiamo nell\'app.',
        ],
    },
];

export default function PrivacyPolicyScreen() {
    const router = useRouter();

    return (
        <StandardLayout
            title="Privacy Policy"
            label="Legale"
            onBack={() => router.back()}
        >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <SoftCard className="p-6">
                    <Text className="text-primary font-black text-xl mb-4">Informativa sulla Privacy</Text>
                    <Text className="text-secondary text-sm leading-6 mb-4">
                        Ultimo aggiornamento: {PRIVACY_POLICY_LAST_UPDATE}
                    </Text>
                    <Text className="text-secondary text-sm leading-6 mb-6">
                        Questa informativa spiega quali dati personali tratta AiutarSì, perché, chi li vede e per quanto tempo li conserviamo.
                    </Text>

                    {SECTIONS.map((section) => (
                        <View key={section.title} className="mb-4">
                            <Text className="text-primary font-bold text-lg mb-2">{section.title}</Text>
                            {section.paragraphs.map((paragraph) => (
                                <Text key={paragraph} className="text-secondary text-sm leading-6 mb-3">
                                    {paragraph}
                                </Text>
                            ))}
                        </View>
                    ))}
                </SoftCard>
            </ScrollView>
        </StandardLayout>
    );
}
