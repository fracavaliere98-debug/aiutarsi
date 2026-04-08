"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

const solutionColumns = [
  {
    eyebrow: "Per i volontari",
    title: "Trova opportunità vicine e affidabili.",
    text: "Scopri attività locali, enti da seguire e occasioni utili senza perdere tempo.",
  },
  {
    eyebrow: "Per gli enti",
    title: "Organizza attività e partecipazione.",
    text: "Pubblica iniziative, raccogli interesse e mantieni tutto più ordinato in un solo flusso.",
  },
  {
    eyebrow: "Per il territorio",
    title: "Rendi il volontariato più visibile.",
    text: "Persone, realtà sociali e opportunità locali smettono di restare sparse e difficili da trovare.",
  },
];

const steps = [
  {
    step: "01",
    title: "Crea il tuo profilo",
    text: "Pochi dati per iniziare e rendere l’esperienza più utile fin da subito.",
  },
  {
    step: "02",
    title: "Esplora attività e opportunità vicine",
    text: "Scopri cosa succede vicino a te e trova realtà affidabili da seguire.",
  },
  {
    step: "03",
    title: "Partecipa, resta aggiornato, crea connessioni utili",
    text: "Candidature, aggiornamenti e relazioni restano dentro un unico flusso.",
  },
];

export default function LandingPage() {
  const [email, setEmail] = useState("");

  const handleContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    const subject = encodeURIComponent("AiutarSì - Contatto landing");
    const body = encodeURIComponent(
      cleanEmail
        ? `Ciao,\n\nvorrei avere maggiori informazioni su AiutarSì.\n\nEmail di contatto: ${cleanEmail}\n`
        : "Ciao,\n\nvorrei avere maggiori informazioni su AiutarSì.\n"
    );
    window.location.href = `mailto:aiutarsi.it@gmail.com?subject=${subject}&body=${body}`;
  };

  return (
    <main className="page-shell">
      <div className="atmosphere atmosphere-one" />
      <div className="atmosphere atmosphere-two" />

      <header className="topbar">
        <div className="brand-lockup">
          <Image src="/logo-lungo.jpeg" alt="AiutarSì" width={300} height={110} className="brand-full" priority />
        </div>

        <nav className="topbar-links" aria-label="Navigazione">
          <a href="#download" className="pill-link">
            Scarica l&apos;app
          </a>
        </nav>
      </header>

      <section className="hero-grid">
        <div className="hero-copy">
          <h1>Il modo più semplice per trovare, organizzare e vivere il volontariato locale.</h1>
          <p className="hero-text">
            AiutarSì connette volontari, enti e comunità locali in un’unica esperienza semplice,
            umana e accessibile.
          </p>

          <div className="hero-actions">
            <a href="#download" className="primary-cta">
              Scarica l&apos;app
            </a>
            <a href="#contatto" className="secondary-cta">
              Entra in waitlist
            </a>
          </div>
        </div>

        <div className="hero-visual">
          <div className="phone-cluster">
            <article className="phone-card phone-card-left">
              <div className="phone-topline">Profilo volontario</div>
              <h3>Apri il tuo profilo e inizia subito.</h3>
              <div className="field-stack">
                <span>Nome</span>
                <span>Email</span>
                <span>Password</span>
              </div>
              <div className="cta-bar">Crea account</div>
            </article>

            <article className="phone-card phone-card-right">
              <div className="phone-topline">Referral Program</div>
              <div className="referral-box">10C182EB</div>
              <ul className="mini-steps">
                <li>Condividi il codice</li>
                <li>Invita un amico</li>
                <li>Attiva una nuova partecipazione</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="solution-section" id="soluzione">
        <div className="section-heading">
          <p className="eyebrow">La soluzione</p>
          <h2>Una piattaforma unica per volontari, enti e comunità.</h2>
          <p className="section-subtitle">
            Più semplice da usare, più chiara da capire, più utile nella vita reale.
          </p>
        </div>

        <div className="section-grid">
          {solutionColumns.map((section) => (
            <article key={section.title} className="panel-card">
              <p className="panel-eyebrow">{section.eyebrow}</p>
              <h3>{section.title}</h3>
              <p>{section.text}</p>
              <div className="mini-graphic" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section">
        <div className="section-heading">
          <p className="eyebrow">Come funziona</p>
          <h2>Come funziona</h2>
          <p className="section-subtitle">Tre passaggi chiari, pensati per rendere l’esperienza più naturale fin dal primo accesso.</p>
        </div>

        <div className="steps-grid">
          {steps.map((item) => (
            <article key={item.step} className="step-card">
              <span className="step-number">{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cta-band" id="download">
        <div className="cta-copy">
          <h2>Vuoi far parte di AiutarSì fin dall’inizio?</h2>
        </div>

        <div className="cta-actions">
          <a className="primary-cta" href="https://apps.apple.com" target="_blank" rel="noreferrer">
            Download iOS
          </a>
          <a className="secondary-cta" href="https://play.google.com/store" target="_blank" rel="noreferrer">
            Download Android
          </a>
        </div>
      </section>

      <section className="contact-band" id="contatto">
        <div className="contact-copy">
          <p className="eyebrow">Entra in waitlist</p>
          <h2>Vuoi sapere quando AiutarSì sarà disponibile?</h2>
          <p>
            Lasciaci la tua email. Ti scriveremo quando l&apos;app sarà disponibile o quando ci saranno novità importanti.
          </p>
        </div>

        <form className="contact-form" onSubmit={handleContact}>
          <label className="contact-label" htmlFor="contact-email">
            Il tuo indirizzo email
          </label>
          <input
            id="contact-email"
            type="email"
            placeholder="esempio@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="contact-input"
          />
          <button type="submit" className="primary-cta contact-submit">
            Entra in waitlist
          </button>
          <p className="contact-helper">
            Si aprirà la tua app email con un messaggio già pronto da inviare a `aiutarsi.it@gmail.com`.
          </p>
        </form>
      </section>

      <footer className="site-footer">
        <a href="https://aiutarsi.app/privacy-policy" target="_blank" rel="noreferrer">
          Privacy
        </a>
        <a href="mailto:aiutarsi.it@gmail.com?subject=AiutarSì%20-%20Contatti">
          Contatti
        </a>
      </footer>
    </main>
  );
}
