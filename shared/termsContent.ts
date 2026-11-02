// Fonte unica del testo dei Termini e Condizioni (riscritti il 02/11/2026). La usano l'app
// (components/legal/TermsContent.tsx) e la landing (landing/app/terms). Qui stanno anche le regole e i
// consensi sul modo in cui l'app tratta i dati (visibilita' del profilo, chat, controlli automatici).
// I fatti devono restare uguali a quelli dell'informativa privacy (shared/privacyPolicyContent.ts):
// scripts/test_privacy_policy_contract.ts controlla che i due testi non si disallineino.
// Se cambi il significato di una regola: alza TERMS_VERSION e TERMS_LAST_UPDATE (gli utenti che
// si registrano salvano la versione accettata). Unici campi aperti: titolare (sezione 1) e foro per i
// non consumatori (sezione 18), da chiudere con la task A45.
// Niente import di React Native: il file e' letto anche dalla landing (Next.js).
export const TERMS_VERSION = "2026-11-02";
export const TERMS_LAST_UPDATE = "2 Novembre 2026";
export const TERMS_CONTACT_EMAIL = "aiutarsi.it@gmail.com";
const CONTACT_EMAIL = TERMS_CONTACT_EMAIL;

export type TermsSectionData = {
  title: string;
  paragraphs: string[];
};


export const TERMS_SUMMARY: string[] = [
  "Questi Termini valgono per tutti: volontari, enti non profit e aziende partner. Dove le regole sono diverse lo diciamo.",
  "AiutarSì mette in contatto volontari ed enti non profit. Non organizziamo noi le attività e non siamo parte del rapporto tra te e l'ente.",
  "Serve avere almeno 18 anni.",
  "Quando ti iscrivi accetti le regole su come vengono mostrati il tuo nome e il tuo profilo, su chat e segnalazioni e sui controlli automatici dei contenuti (sezione 5).",
  "Il servizio è gratuito. Puoi cancellare l'account quando vuoi dalle impostazioni.",
];

export const TERMS_SECTIONS: TermsSectionData[] = [
  {
    title: "1. Chi siamo e come contattarci",
    paragraphs: [
      "AiutarSì è gestita da: ragione sociale o nome del titolare [DA COMPLETARE], sede [DA COMPLETARE], codice fiscale o partita IVA [DA COMPLETARE].",
      `Per qualsiasi domanda, segnalazione o richiesta sui tuoi dati scrivi a ${CONTACT_EMAIL}.`,
    ],
  },
  {
    title: "2. Cosa fa AiutarSì e cosa non fa",
    paragraphs: [
      "Questi Termini si applicano a ogni utente: volontari, enti del Terzo Settore, organizzazioni non profit e aziende partner. Ogni sezione vale per tutti, salvo quelle che indicano espressamente a chi si rivolgono (per esempio la 7, per enti e aziende).",
      "AiutarSì è un'app che permette a volontari, enti del Terzo Settore e aziende partner di creare un profilo, pubblicare e trovare attività di volontariato, candidarsi, iscriversi e scriversi in chat.",
      "Siamo una piattaforma di incontro. Non siamo il datore di lavoro dei volontari, non siamo un'agenzia di collocamento, non organizziamo le attività al posto degli enti e non diamo assicurazioni. Le attività sono degli enti che le pubblicano.",
    ],
  },
  {
    title: "3. Chi può usare AiutarSì",
    paragraphs: [
      "Puoi registrarti solo se hai almeno 18 anni. Ti chiediamo la data di nascita per verificarlo e il controllo viene fatto anche dai nostri server. Non registriamo minorenni.",
      "Se ti registri per conto di un ente o di un'azienda dichiari di poterla rappresentare e di poterla vincolare a questi Termini.",
    ],
  },
  {
    title: "4. Il tuo account",
    paragraphs: [
      "Inserisci dati veri e aggiornali se cambiano. Non puoi usare l'identità di un'altra persona, creare più account per aggirare una sospensione o cedere il tuo account.",
      "Custodisci la tua password: sei responsabile di ciò che succede con il tuo account, salvo accessi non autorizzati che non dipendono da te. Se pensi che qualcuno sia entrato nel tuo account, scrivici subito.",
    ],
  },
  {
    title: "5. Cosa accetti usando AiutarSì",
    paragraphs: [
      "Nome e profilo. Il nome e cognome che inserisci è visibile agli altri utenti secondo la tua impostazione «Profilo pubblico» (attiva di partenza, la cambi quando vuoi). Con il profilo pubblico gli enti verificati e gli altri volontari vedono nome, foto, presentazione, livello, badge, interessi e competenze. Con il profilo non pubblico gli altri vedono solo nome e iniziale del cognome (per esempio «Marta B.») e il livello; un ente vede il profilo completo solo dopo che agisci verso di lui (ti candidi, ti iscrivi a una sua attività o rispondi a un suo messaggio). Seguire un ente non mostra il tuo profilo.",
      "Se sei un ente o un'azienda. Il profilo dell'ente o dell'azienda (nome, indirizzo e posizione, sito, email e telefono pubblici, referente) è visibile agli altri utenti. Il documento che carichi per la verifica lo vedono solo i nostri amministratori. Finché l'ente non è verificato non può vedere i profili dei volontari. Dopo la verifica un ente vede il profilo completo di un volontario solo alle condizioni descritte qui sopra, e le regole su chat e segnalazioni valgono anche per te.",
      "Email e telefono. L'email e il telefono del tuo account non sono mai mostrati né agli altri volontari né agli enti. Quando ti candidi a un ente o ti iscrivi a una sua attività scegli tu quale email e quale telefono condividere con lui: li vede solo quell'ente, finché la candidatura o l'iscrizione è valida.",
      "Chat. Un ente può scriverti solo se c'è un legame (una tua candidatura, l'iscrizione a una sua attività o se lo segui). Tu puoi scrivere agli enti. Puoi bloccare chi non vuoi più sentire.",
      "Controlli automatici e suggerimenti. Per tenere sicura la comunità controlliamo in modo automatico i testi dei post e di alcuni messaggi di chat, e usiamo la tua presentazione, i tuoi interessi e le tue competenze per suggerirti attività. Questi testi sono elaborati da Google (Gemini), come spiegato nell'informativa privacy.",
      "Segnalazioni. Se segnali un contenuto o una persona, o se sei segnalato, i nostri amministratori possono vedere ciò che serve per valutare il caso.",
      "Notifiche e permessi. Le notifiche push, la posizione, la fotocamera, la galleria e il calendario sono facoltativi: li attivi o li togli tu dalle impostazioni del telefono.",
      "Come trattiamo i dati personali è spiegato nell'informativa privacy, che è un documento separato. Leggerla non sostituisce questi Termini e viceversa.",
    ],
  },
  {
    title: "6. Regole di comportamento",
    paragraphs: [
      "Usa AiutarSì con rispetto. Non puoi pubblicare o inviare contenuti falsi, offensivi, minacciosi, discriminatori, sessualmente espliciti, che violino i diritti di altri o la legge, né dati personali di altre persone senza il loro permesso.",
      "Non puoi fare spam, candidature false o abusive, raccolta fondi non autorizzata, reclutamento per attività estranee al volontariato, accessi non autorizzati, estrazione automatica di dati dell'app o ricostruzione del suo funzionamento.",
    ],
  },
  {
    title: "7. Regole per enti e aziende",
    paragraphs: [
      "Gli enti e le aziende sono gli unici responsabili delle attività che pubblicano: devono essere vere, lecite e non discriminatorie, con informazioni corrette su luogo, orari e compiti. Devono avere le autorizzazioni, la sicurezza e le coperture assicurative richieste dalla legge per il volontariato.",
      "Non possono chiedere compensi ai volontari se non dichiarati, né raccogliere più dati di quelli necessari. I dati dei volontari ricevuti tramite AiutarSì vanno usati solo per gestire la partecipazione alle attività: l'ente ne risponde direttamente verso i volontari. Gli enti vengono verificati dai nostri amministratori prima di vedere i profili dei volontari.",
    ],
  },
  {
    title: "8. Candidature, attività e rapporti tra utenti",
    paragraphs: [
      "Candidarsi o iscriversi non garantisce di essere accettati. La decisione spetta all'ente, che può approvare, rifiutare o annullare una partecipazione.",
      "Quello che succede durante un'attività è un rapporto tra volontario ed ente. AiutarSì non garantisce che un'attività si svolga e non risponde di ciò che avviene durante o dopo, salvo i casi in cui la legge lo prevede.",
    ],
  },
  {
    title: "9. I contenuti che pubblichi",
    paragraphs: [
      "I contenuti che carichi (testi, foto, documenti) restano tuoi. Ci dai solo il permesso, gratuito e non esclusivo, di conservarli, mostrarli agli altri utenti secondo le impostazioni di visibilità, adattarli tecnicamente (per esempio ridimensionare una foto) e usarli per far funzionare, proteggere e moderare il servizio, finché resta il tuo account o il contenuto.",
      "Garantisci di avere il diritto di pubblicare ciò che carichi. Possiamo rimuovere un contenuto se sembra illecito, se viola questi Termini o se lo ordina un'autorità.",
    ],
  },
  {
    title: "10. Segnalazioni, sospensioni e rimozioni",
    paragraphs: [
      "Possiamo avvisarti, limitare la visibilità di un contenuto, rimuoverlo, sospendere o chiudere un account quando serve per far rispettare questi Termini, proteggere la comunità o rispettare la legge. La misura è proporzionata alla gravità.",
      `Quando prendiamo una decisione su un tuo contenuto o account ti spieghiamo il motivo. Se pensi che sia sbagliata scrivi a ${CONTACT_EMAIL}: la riesaminiamo. Questo non limita i tuoi diritti previsti dalla legge.`,
      "Puoi segnalare contenuti o persone dall'app o dal Centro Assistenza.",
    ],
  },
  {
    title: "11. Suggerimenti automatici e assistente",
    paragraphs: [
      "L'app usa sistemi automatici per suggerire attività compatibili, controllare i contenuti e rispondere alle domande nel Centro Assistenza. Possono sbagliare o essere incompleti. Controlla sempre le informazioni importanti con l'ente prima di decidere e non usare le risposte dell'assistente come consulenza legale, medica o professionale.",
    ],
  },
  {
    title: "12. Costi",
    paragraphs: [
      "L'uso di AiutarSì è gratuito per volontari ed enti. Se in futuro introdurremo servizi a pagamento ti mostreremo prima, in modo chiaro, prezzo, durata e condizioni, e li accetterai separatamente. Il gratuito di oggi non ti obbliga a nulla.",
    ],
  },
  {
    title: "13. Cancellare l'account",
    paragraphs: [
      "Puoi chiedere la cancellazione dalle impostazioni. Hai 30 giorni per ripensarci; passati i 30 giorni l'account viene eliminato insieme ai dati collegati, come spiegato nell'informativa privacy.",
      "Possiamo chiudere un account che viola questi Termini. Alcuni dati possono restare più a lungo se la legge ci obbliga a conservarli o ci servono per difenderci in giudizio.",
    ],
  },
  {
    title: "14. Proprietà intellettuale",
    paragraphs: [
      "L'app, il nome AiutarSì, il logo, la grafica e i testi redazionali sono del gestore o di chi ce li ha concessi in licenza. Non puoi copiarli, rivenderli o usarli per attività concorrenti senza permesso, oltre ciò che la legge consente.",
    ],
  },
  {
    title: "15. Dati personali",
    paragraphs: [
      "Quali dati raccogliamo, perché, chi li vede, a quali servizi esterni li mandiamo, per quanto tempo li conserviamo e quali sono i tuoi diritti è spiegato nell'Informativa sulla Privacy, disponibile nell'app.",
    ],
  },
  {
    title: "16. Limiti di responsabilità",
    paragraphs: [
      "L'app è offerta così com'è: facciamo il possibile perché funzioni, ma non possiamo garantire che sia sempre disponibile e senza errori. Nei limiti consentiti dalla legge non rispondiamo di interruzioni dovute a servizi esterni o alla rete, di informazioni sbagliate inserite da altri utenti o di danni indiretti.",
      "Niente in questi Termini esclude o limita la nostra responsabilità per dolo o colpa grave, né i diritti che la legge riconosce ai consumatori e che non si possono escludere.",
    ],
  },
  {
    title: "17. Modifiche ai Termini e al servizio",
    paragraphs: [
      "Possiamo cambiare l'app o questi Termini per motivi tecnici, di sicurezza, di legge o perché il servizio evolve. Per le modifiche importanti ti avvisiamo nell'app almeno 30 giorni prima, salvo urgenze di sicurezza o obblighi di legge.",
      "Se non sei d'accordo con la modifica puoi smettere di usare AiutarSì e cancellare l'account prima che entri in vigore. Se continui a usarla dopo quella data, vale la nuova versione.",
    ],
  },
  {
    title: "18. Legge applicabile e controversie",
    paragraphs: [
      "Questi Termini sono regolati dalla legge italiana. Se sei un consumatore restano validi i diritti inderogabili del tuo paese di residenza e puoi rivolgerti al giudice del luogo in cui risiedi o hai il domicilio.",
      "Prima di qualsiasi azione ti chiediamo di scriverci: cerchiamo sempre di risolvere il problema in via amichevole. Per chi non è consumatore il foro competente è [DA COMPLETARE].",
    ],
  },
  {
    title: "19. Clausole finali",
    paragraphs: [
      "Se una parte di questi Termini non fosse valida, le altre restano in vigore. Se non facciamo valere subito un nostro diritto, non vuol dire che vi rinunciamo.",
    ],
  },
];
