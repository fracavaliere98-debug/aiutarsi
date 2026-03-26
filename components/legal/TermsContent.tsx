import React from "react";
import { Text, View } from "react-native";
import { SoftCard } from "../SoftCard";

type SectionProps = {
  title: string;
  paragraphs: string[];
};

function TermsSection({ title, paragraphs }: SectionProps) {
  return (
    <View className="mb-6">
      <Text className="text-primary font-bold text-lg mb-2">{title}</Text>
      {paragraphs.map((paragraph) => (
        <Text key={paragraph} className="text-secondary text-sm leading-6 mb-3">
          {paragraph}
        </Text>
      ))}
    </View>
  );
}

export function TermsContent() {
  const sections: SectionProps[] = [
    {
      title: "1. Identita del prestatore del servizio",
      paragraphs: [
        "Ai sensi del D.Lgs. 9 aprile 2003, n. 70, il prestatore del servizio deve essere identificato in modo diretto e permanente. Prima della pubblicazione questi campi devono essere completati con dati reali: ragione sociale o nome del titolare [DA COMPLETARE], sede legale [DA COMPLETARE], codice fiscale e/o partita IVA [DA COMPLETARE], iscrizione REA o Registro delle Imprese se applicabile [DA COMPLETARE], PEC [DA COMPLETARE], indirizzo email di contatto diretto [DA COMPLETARE].",
        "Se l'attivita e soggetta a licenze, autorizzazioni o vigilanza settoriale, devono essere indicati anche gli estremi dell'autorita competente. In assenza di tali dati, la pagina non puo considerarsi completa sotto il profilo informativo.",
      ],
    },
    {
      title: "2. Oggetto del servizio",
      paragraphs: [
        "AiutarSi e un servizio digitale che consente a volontari, enti del Terzo Settore, organizzazioni non profit e, ove previsti, partner aziendali, di creare un account, pubblicare o consultare opportunita di volontariato, candidarsi alle attivita, interagire tramite messaggistica e utilizzare funzionalita di supporto, raccomandazione e assistenza.",
        "Il servizio ha natura di piattaforma di intermediazione informativa e organizzativa. Salvo ove espressamente indicato diversamente, AiutarSi non assume il ruolo di datore di lavoro, agenzia di collocamento, organizzatore esclusivo dell'evento, assicuratore, ente certificatore o sostituto degli obblighi di legge gravanti sugli enti promotori.",
      ],
    },
    {
      title: "3. Accettazione dei termini e capacita di agire",
      paragraphs: [
        "Creando un account, accedendo all'app o utilizzando il servizio, l'utente dichiara di avere la capacita giuridica necessaria per accettare i presenti termini oppure di agire con il consenso del soggetto che esercita la responsabilita genitoriale o la rappresentanza legale, se richiesto dalla legge applicabile.",
        "Se l'utente utilizza il servizio per conto di un ente o di una societa, dichiara di essere autorizzato a vincolare tale organizzazione ai presenti termini.",
      ],
    },
    {
      title: "4. Caratteristiche del servizio digitale",
      paragraphs: [
        "Il servizio e fornito tramite applicazione mobile e, dove disponibile, tramite interfacce web o strumenti collegati. Per il corretto utilizzo sono normalmente necessari: dispositivo compatibile, connessione Internet, software aggiornato, accesso alle notifiche push se richieste dalle funzionalita e, per alcune funzioni, consenso facoltativo all'uso di posizione, fotocamera, galleria o documenti.",
        "Le funzionalita disponibili possono variare per ruolo utente, area geografica, sistema operativo, disponibilita di servizi terzi e stato dell'account. Funzioni sperimentali, di ranking, matching o assistenza AI possono fornire risultati probabilistici e devono essere sempre verificati dall'utente.",
      ],
    },
    {
      title: "5. Registrazione, account e sicurezza",
      paragraphs: [
        "L'utente si impegna a fornire dati accurati, aggiornati, completi e non fuorvianti. E vietato creare account con identita false, impersonare terzi, aggirare sospensioni, condividere credenziali in modo non autorizzato o utilizzare l'account per scopi illeciti o lesivi della sicurezza della piattaforma.",
        "L'utente e responsabile della custodia delle proprie credenziali e di tutte le attivita compiute tramite il proprio account, salvo prova di accesso non autorizzato non imputabile all'utente. In caso di sospetto abuso o compromissione delle credenziali, l'utente deve avvisare senza ritardo il gestore del servizio.",
      ],
    },
    {
      title: "6. Regole di condotta",
      paragraphs: [
        "E vietato pubblicare, trasmettere o utilizzare contenuti falsi, diffamatori, discriminatori, minacciosi, violenti, offensivi, pornografici, lesivi di diritti di terzi, contrari alla normativa sul volontariato, alla tutela dei minori, alla sicurezza pubblica, alla proprieta intellettuale o alla protezione dei dati personali.",
        "Gli utenti devono usare la piattaforma in modo corretto e diligente, evitare candidature abusive, recensioni manipolate, spam, scraping, reverse engineering non consentito, tentativi di accesso non autorizzato o uso del servizio per reclutamento illecito, fundraising non autorizzato o attivita estranee alle finalita dichiarate della piattaforma.",
      ],
    },
    {
      title: "7. Regole specifiche per enti, organizzazioni e partner",
      paragraphs: [
        "Gli enti e le organizzazioni che pubblicano attivita, raccolgono candidature o interagiscono con volontari restano gli unici responsabili della legittimita delle opportunita pubblicate, dell'accuratezza delle informazioni, dell'eventuale copertura assicurativa, della sicurezza operativa, delle autorizzazioni necessarie, della gestione dei partecipanti e del rispetto delle norme applicabili al Terzo Settore, al lavoro volontario e alla sicurezza.",
        "Gli enti si impegnano a non pubblicare opportunita ingannevoli o discriminatorie, a non richiedere compensi non dichiarati, a non raccogliere dati eccedenti rispetto alle finalita dichiarate e a trattare i dati degli utenti nel rispetto della normativa privacy applicabile.",
      ],
    },
    {
      title: "8. Candidature, adesioni e rapporti tra utenti",
      paragraphs: [
        "La pubblicazione di un'attivita o la candidatura di un volontario non garantiscono automaticamente ammissione, conferma, esecuzione o continuita dell'attivita. La decisione di approvare, rifiutare, rinviare o annullare una partecipazione spetta al soggetto che gestisce l'attivita, salvo diversi obblighi inderogabili di legge.",
        "I rapporti organizzativi, logistici e operativi che si instaurano tra volontari, enti e altri utenti restano in capo ai soggetti direttamente coinvolti. AiutarSi non e parte del rapporto operativo tra gli utenti e non garantisce l'effettiva esecuzione delle attivita pubblicate.",
      ],
    },
    {
      title: "9. Contenuti degli utenti e licenza d'uso",
      paragraphs: [
        "I contenuti caricati o trasmessi dagli utenti restano, ove applicabile, nella titolarita dei rispettivi aventi diritto. L'utente concede tuttavia al gestore del servizio una licenza non esclusiva, mondiale, gratuita, limitata alla durata necessaria e finalizzata a ospitare, riprodurre, adattare tecnicamente, organizzare, visualizzare e comunicare tali contenuti nei limiti necessari all'erogazione, sicurezza, moderazione e promozione interna del servizio.",
        "L'utente garantisce di avere tutti i diritti, consensi e basi giuridiche necessari per pubblicare contenuti, immagini, documenti e dati di terzi. Il gestore puo rimuovere o disabilitare contenuti in caso di sospetta illiceita, violazione dei presenti termini o ordine dell'autorita competente.",
      ],
    },
    {
      title: "10. Moderazione, restrizioni e segnalazioni",
      paragraphs: [
        "Il gestore puo adottare misure ragionevoli e proporzionate per contrastare contenuti illeciti, abusi della piattaforma, violazioni dei presenti termini, comportamenti rischiosi per la comunita o per adempiere a obblighi normativi, inclusi avvisi, limitazioni di visibilita, rimozione di contenuti, sospensione temporanea o chiusura dell'account.",
        "Gli utenti possono inviare segnalazioni relative a contenuti o condotte potenzialmente illeciti o contrari ai presenti termini tramite il Centro assistenza o scrivendo a support@aiutarsi.it, fermo restando che l'indirizzo legale o dedicato alle segnalazioni DSA deve essere indicato in modo espresso se diverso [DA COMPLETARE]. Quando richiesto dalla normativa applicabile, il gestore fornisce una motivazione della decisione adottata e consente i rimedi previsti dalla legge.",
      ],
    },
    {
      title: "11. Servizi AI, ranking e suggerimenti automatici",
      paragraphs: [
        "La piattaforma puo utilizzare sistemi automatici, inclusi strumenti di raccomandazione, classificazione, assistenza conversazionale o generazione di testo, per suggerire attivita, organizzare i contenuti o supportare gli utenti. Tali sistemi possono produrre risultati incompleti, inaccurati o non aggiornati e non sostituiscono valutazioni umane, legali, mediche, di sicurezza o professionali.",
        "L'utente si impegna a verificare autonomamente le informazioni rilevanti prima di prendere decisioni operative sulla base di output automatici.",
      ],
    },
    {
      title: "12. Corrispettivi, prezzi e modifiche economiche",
      paragraphs: [
        "Alla data del 26 marzo 2026, salvo ove diversamente indicato in specifiche schermate o offerte, l'uso ordinario dell'app AiutarSi e presentato come gratuito per gli utenti finali. Se saranno introdotti servizi a pagamento, abbonamenti o funzionalita premium, il prezzo totale, le imposte applicabili, le condizioni economiche, la durata e le modalita di rinnovo o cessazione dovranno essere mostrate chiaramente prima della conclusione del contratto.",
        "Nessuna clausola dei presenti termini limita i diritti inderogabili riconosciuti ai consumatori dal Codice del Consumo e dalla normativa europea applicabile ai servizi digitali.",
      ],
    },
    {
      title: "13. Recesso, cancellazione e cessazione",
      paragraphs: [
        "L'utente puo smettere di usare il servizio in qualsiasi momento e, se disponibile nell'app o richiesto per legge, chiedere la cancellazione del proprio account. La cancellazione dell'account non elimina automaticamente obblighi, consensi, segnalazioni, registrazioni o dati la cui conservazione sia necessaria per obblighi di legge, sicurezza, prevenzione abusi o difesa in giudizio.",
        "Se in futuro saranno offerti servizi digitali a pagamento o contratti a distanza con consumatori, le eventuali informazioni sul diritto di recesso, sulle eccezioni applicabili e sulle modalita di esercizio dovranno essere mostrate in modo specifico prima dell'acquisto, ove richiesto dalla legge.",
      ],
    },
    {
      title: "14. Proprieta intellettuale",
      paragraphs: [
        "Salvo ove diversamente indicato, software, marchi, loghi, interfacce, banche dati non generate dagli utenti, testi editoriali, design e ogni altro elemento del servizio sono protetti dalle norme sulla proprieta intellettuale e restano di titolarita del gestore o dei rispettivi licenzianti.",
        "E vietato copiare, distribuire, estrarre, decompilare, rivendere, utilizzare per attivita concorrenti o sfruttare in modo non autorizzato parti sostanziali del servizio, salvo nei limiti consentiti dalla legge.",
      ],
    },
    {
      title: "15. Privacy e protezione dei dati",
      paragraphs: [
        "Il trattamento dei dati personali avviene secondo l'informativa privacy applicabile, che deve essere coerente con il Regolamento (UE) 2016/679 e con la normativa nazionale vigente. I presenti termini non sostituiscono l'informativa privacy, che deve indicare almeno titolare del trattamento, finalita, basi giuridiche, tempi di conservazione, destinatari, trasferimenti, diritti degli interessati e canali di contatto.",
        "Se specifiche organizzazioni trattano dati ricevuti attraverso la piattaforma come titolari autonomi, esse ne rispondono direttamente verso gli interessati per i trattamenti di rispettiva competenza.",
      ],
    },
    {
      title: "16. Limitazioni di responsabilita",
      paragraphs: [
        "Nei limiti consentiti dalla legge, il servizio e fornito senza garanzia di disponibilita continua, assenza di errori o idoneita per finalita particolari. Il gestore non risponde per interruzioni, ritardi, perdite di opportunita, danni indiretti o conseguenze derivanti da condotte di terzi, indisponibilita di reti o servizi esterni, dati inesatti inseriti dagli utenti o cancellazioni imposte da obblighi normativi o di sicurezza.",
        "Resta fermo che non e esclusa o limitata la responsabilita nei casi in cui tale esclusione o limitazione sia vietata dalla legge, inclusi dolo, colpa grave, lesioni a diritti inderogabili del consumatore o altre ipotesi di responsabilita non derogabile.",
      ],
    },
    {
      title: "17. Manleva",
      paragraphs: [
        "L'utente si impegna a tenere indenne il gestore del servizio da reclami, contestazioni, danni, costi o richieste derivanti da uso illecito della piattaforma, violazione dei presenti termini, violazione di diritti di terzi, caricamento di contenuti non autorizzati o inosservanza di obblighi normativi imputabili all'utente o all'organizzazione da lui rappresentata, nei limiti consentiti dalla legge.",
      ],
    },
    {
      title: "18. Modifiche del servizio e dei termini",
      paragraphs: [
        "Il gestore puo aggiornare, sospendere, modificare o dismettere in tutto o in parte il servizio per ragioni tecniche, organizzative, normative o di sicurezza. I presenti termini possono essere modificati per adeguamenti legislativi, evoluzione del prodotto o cambiamenti del modello di servizio.",
        "Le modifiche sostanziali devono essere comunicate con congruo preavviso quando richiesto dalla legge o quando incidono in modo rilevante sui diritti e sugli obblighi degli utenti. L'uso continuato del servizio dopo l'entrata in vigore delle modifiche costituisce accettazione dei termini aggiornati, salvo diritti di recesso o cessazione previsti dalla legge.",
      ],
    },
    {
      title: "19. Legge applicabile e foro competente",
      paragraphs: [
        "I presenti termini sono regolati dalla legge italiana, salva l'applicazione delle norme imperative di tutela eventualmente previste a favore dei consumatori dalla legge del paese di residenza abituale del consumatore.",
        "Per gli utenti qualificabili come consumatori, il foro competente inderogabile e quello del luogo di residenza o domicilio del consumatore, ove previsto dalla legge. Per gli utenti che non agiscono in qualita di consumatori, salvo diversa previsione inderogabile, il foro esclusivo e [DA COMPLETARE].",
      ],
    },
    {
      title: "20. Clausole finali",
      paragraphs: [
        "L'eventuale nullita o inefficacia di una clausola non comporta la nullita delle restanti disposizioni, che restano efficaci nei limiti consentiti dalla legge. Il mancato esercizio di un diritto da parte del gestore non costituisce rinuncia.",
        "I presenti termini devono essere resi scaricabili, memorizzabili e riproducibili dall'utente prima dell'accettazione. Prima della messa in produzione si raccomanda una revisione da parte di un avvocato abilitato in Italia, per verificare coerenza con identita del titolare, flussi reali dell'app, base contrattuale, ruoli privacy e obblighi di settore.",
      ],
    },
  ];

  return (
    <SoftCard className="p-6">
      <Text className="text-primary font-black text-xl mb-4">
        Termini e Condizioni d&apos;Uso
      </Text>
      <Text className="text-secondary text-sm leading-6 mb-4">
        Ultimo aggiornamento: 26 Marzo 2026
      </Text>
      <Text className="text-secondary text-sm leading-6 mb-6">
        I presenti termini disciplinano l&apos;accesso e l&apos;uso dell&apos;app AiutarSi e dei
        servizi digitali collegati. Alcuni dati obbligatori per legge non risultano
        presenti nel repository e sono quindi indicati come [DA COMPLETARE]. Devono
        essere sostituiti con informazioni reali prima della pubblicazione.
      </Text>

      {sections.map((section) => (
        <TermsSection key={section.title} title={section.title} paragraphs={section.paragraphs} />
      ))}
    </SoftCard>
  );
}
