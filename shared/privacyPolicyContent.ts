// Fonte unica del testo dell'informativa privacy (A26 P8, 27/10/2026; spostata in shared/ il 02/11/2026).
// La usano l'app (app/privacy-policy.tsx) e la landing (landing/app/privacy-policy). Descrive quello
// che l'app fa davvero: se cambia cosa raccoglie, chi vede i dati o a quali fornitori li manda,
// va aggiornata qui e vanno rialzate PRIVACY_POLICY_LAST_UPDATE e PRIVACY_POLICY_VERSION.
// scripts/test_privacy_policy_contract.ts controlla che il testo non si disallinei dal codice.
// Niente import di React Native: il file e' letto anche dalla landing (Next.js).
export const PRIVACY_POLICY_LAST_UPDATE = '2 Novembre 2026';
export const PRIVACY_POLICY_VERSION = '2026-11-02';
export const PRIVACY_CONTACT_EMAIL = 'aiutarsi.it@gmail.com';

export type PolicySection = { title: string; paragraphs: string[] };

export const PRIVACY_POLICY_SECTIONS: PolicySection[] = [
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
            'Telefono: facoltativo. Se ti candidi a un ente o ti iscrivi a una sua attività puoi scegliere di condividere con lui un telefono e un\'email di contatto (anche diversi da quelli dell\'account).',
            'Quello che fai nell\'app: candidature, iscrizioni e presenze alle attività, enti che segui, messaggi nelle chat, segnalazioni e blocchi.',
            'Registro delle accettazioni: quando ti registri salviamo la data e la versione dei Termini e Condizioni e dell\'Informativa privacy che hai accettato.',
            'Dati tecnici: il codice per inviarti le notifiche, la data dell\'ultimo accesso e i rapporti sugli errori dell\'app.',
            'Permessi del telefono (sono tutti facoltativi e li gestisci dalle impostazioni del telefono): posizione, per mostrarti le attività vicine (la usiamo per quella ricerca e non la salviamo); fotocamera e galleria, per la foto profilo; calendario, per aggiungere le attività a cui ti iscrivi; notifiche. Le mappe dell\'app usano i servizi di mappe di Apple o di Google.',
        ],
    },
    {
        title: '3. Perché li usiamo',
        paragraphs: [
            'Per far funzionare il servizio che ci chiedi: creare il tuo account, farti trovare dagli enti, gestire candidature, iscrizioni e chat. La base è il contratto che accetti usando AiutarSì.',
            'Per suggerirti attività compatibili (Smart Match), inviarti notifiche e tenere sicura la comunità con segnalazioni e controlli automatici dei contenuti. La base è il nostro interesse legittimo a offrire un servizio sicuro e utile; le notifiche push le attivi tu dal telefono.',
            'Per verificare che tu abbia almeno 18 anni, come previsto dalle regole del servizio.',
            'Le regole d\'uso del servizio, comprese quelle su visibilità del profilo, chat e moderazione, sono nei Termini e Condizioni.',
        ],
    },
    {
        title: '4. Chi vede i tuoi dati',
        paragraphs: [
            'Profilo pubblico (è l\'impostazione di partenza, la cambi quando vuoi): gli enti verificati e gli altri volontari vedono nome, foto, presentazione, livello, badge, interessi e competenze.',
            'Profilo non pubblico: gli altri vedono solo nome e iniziale del cognome (per esempio «Marta B.») e il livello. Un ente vede il profilo completo solo dopo che agisci verso di lui: ti candidi, ti iscrivi a una sua attività o rispondi a un suo messaggio. Seguire un ente non mostra il tuo profilo. Altri volontari lo vedono completo solo se siete stati approvati dallo stesso ente.',
            'Email e telefono del tuo account: non sono mai mostrati né agli altri volontari né agli enti.',
            'Contatti che condividi: quando ti candidi a un ente o ti iscrivi a una sua attività scegli tu quale email e quale telefono dargli. Li vede solo quell\'ente, finché la candidatura o l\'iscrizione è valida: spariscono se annulli o se la candidatura viene rifiutata.',
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
            'Sentry riceve i rapporti sugli errori dell\'app, che includono solo il tuo identificativo tecnico e il tuo ruolo: non la tua email né il tuo nome.',
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
