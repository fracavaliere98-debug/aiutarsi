import Image from "next/image";

const proofStats = [
  { value: "Community + Match", label: "Una sola app per scoprire, partecipare e restare attivi." },
  { value: "Gemma integrata", label: "Supporto rapido per dubbi, orientamento e prossimi passi." },
  { value: "Volontari e NPO", label: "Due esperienze coordinate, senza flussi spezzati o dati duplicati." },
];

const sections = [
  {
    eyebrow: "Per i volontari",
    title: "Attività vicine, chiare, con meno rumore.",
    copy:
      "Scopri opportunità rilevanti, salva quelle giuste, partecipa e tieni il filo con messaggi, storie e notifiche utili.",
  },
  {
    eyebrow: "Per gli enti",
    title: "Recruiting e relazione nello stesso posto.",
    copy:
      "Pubblica attività, ricevi candidature, aggiorna la community e mantieni viva la relazione con chi ti segue.",
  },
  {
    eyebrow: "Per l'orientamento",
    title: "Gemma ti aiuta a non restare fermo.",
    copy:
      "Domande, suggerimenti e supporto contestuale per scegliere meglio cosa fare, quando candidarti e come continuare.",
  },
];

const flow = [
  {
    step: "01",
    title: "Entri e capisci subito dove sei utile",
    text: "Il feed non prova a stupirti. Ti porta rapidamente verso attività, enti e storie rilevanti.",
  },
  {
    step: "02",
    title: "Ti candidi e resti nel loop",
    text: "Stato candidatura, messaggi, reminder e community restano sincronizzati nello stesso percorso.",
  },
  {
    step: "03",
    title: "L'ente continua a coinvolgerti",
    text: "Post, stories e notifiche trasformano una singola attività in una relazione più continua.",
  },
];

export default function LandingPage() {
  return (
    <main className="page-shell">
      <div className="atmosphere atmosphere-one" />
      <div className="atmosphere atmosphere-two" />

      <header className="topbar">
        <div className="brand-lockup">
          <Image
            src="/logo-transparent.png"
            alt="AiutarSi"
            width={168}
            height={52}
            className="brand-mark"
            priority
          />
          <span className="brand-tag">volontariato, community, orientamento</span>
        </div>

        <nav className="topbar-links" aria-label="Azioni principali">
          <a href="#esperienza">Esperienza</a>
          <a href="#enti">Per gli enti</a>
          <a href="#cta" className="pill-link">
            Richiedi accesso
          </a>
        </nav>
      </header>

      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">AiutarSi per chi vuole essere utile davvero</p>
          <h1>Volontariato più chiaro, locale e continuo.</h1>
          <p className="hero-text">
            AiutarSi unisce attività, community e supporto AI in un prodotto pensato per persone e
            organizzazioni che vogliono fare bene le cose, non solo “esserci”.
          </p>

          <div className="hero-actions">
            <a href="#cta" className="primary-cta">
              Prenota la demo
            </a>
            <a href="mailto:ciao@aiutarsi.app?subject=AiutarSi%20-%20Richiesta%20info" className="secondary-cta">
              Scrivici
            </a>
          </div>

          <div className="proof-strip">
            {proofStats.map((item) => (
              <article key={item.value} className="proof-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="hero-visual">
          <div className="device-stage">
            <div className="device-card device-card-main">
              <span className="device-label">Esperienza volontario</span>
              <h2>Community, attività e scelte meno dispersive.</h2>
              <p>
                Una superficie unica per capire cosa fare adesso, cosa seguire e come restare attivi
                nel tempo.
              </p>
            </div>
            <div className="device-card device-card-side">
              <span className="device-label">Gemma inside</span>
              <Image
                src="/gemma-intro.png"
                alt="Anteprima Gemma"
                width={320}
                height={320}
                className="gemma-shot"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section-grid" id="esperienza">
        {sections.map((section) => (
          <article key={section.title} className="panel-card">
            <p className="panel-eyebrow">{section.eyebrow}</p>
            <h3>{section.title}</h3>
            <p>{section.copy}</p>
          </article>
        ))}
      </section>

      <section className="narrative-block" id="enti">
        <div className="narrative-copy">
          <p className="eyebrow">Una base pulita per crescere</p>
          <h2>Non una landing generica. Una promessa di prodotto precisa.</h2>
          <p>
            La pagina serve a spiegare tre cose con chiarezza: perché AiutarSi esiste, a chi è utile
            e cosa cambia rispetto ai flussi frammentati che enti e volontari usano oggi.
          </p>
        </div>
        <div className="flow-stack">
          {flow.map((item) => (
            <article key={item.step} className="flow-card">
              <span>{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cta-band" id="cta">
        <div>
          <p className="eyebrow">Prossimo passo</p>
          <h2>Usa questa landing come home pubblica di `aiutarsi.app`.</h2>
          <p>
            Su Vercel va bene così com&apos;è. Supabase non serve per la prima pubblicazione, a meno che
            tu non voglia raccogliere lead o richieste demo con un form persistente.
          </p>
        </div>

        <div className="cta-actions">
          <a className="primary-cta" href="mailto:ciao@aiutarsi.app?subject=AiutarSi%20-%20Prenota%20una%20demo">
            Richiedi una demo
          </a>
          <a className="secondary-cta" href="mailto:ciao@aiutarsi.app?subject=AiutarSi%20-%20Partnership">
            Partnership e media
          </a>
        </div>
      </section>
    </main>
  );
}
