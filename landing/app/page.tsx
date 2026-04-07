"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

const painPoints = [
  "I volontari non sanno dove trovare opportunità affidabili vicino a loro",
  "Gli enti fanno fatica a raggiungere persone davvero interessate",
  "Le attività locali e sociali sono sparse, poco visibili e difficili da coordinare",
];

const solutionColumns = [
  {
    eyebrow: "Per i volontari",
    title: "Trova opportunità più vicine e più adatte a te.",
    text: "Scopri attività locali, segui gli enti che ti interessano e resta aggiornato in modo semplice.",
  },
  {
    eyebrow: "Per gli enti",
    title: "Organizza meglio attività, visibilità e partecipazione.",
    text: "Pubblica iniziative, coinvolgi persone interessate e mantieni una relazione viva con la tua comunità.",
  },
  {
    eyebrow: "Per il territorio",
    title: "Rendi il volontariato locale più visibile e coordinato.",
    text: "AiutarSi mette in connessione persone, realtà sociali e opportunità che oggi restano troppo disperse.",
  },
];

const steps = [
  {
    step: "01",
    title: "Crea il tuo profilo",
    text: "Pochi dati per iniziare e rendere l’esperienza più utile fin da subito.",
    icon: "●",
  },
  {
    step: "02",
    title: "Esplora attività e opportunità vicine",
    text: "Scopri cosa succede vicino a te e trova realtà affidabili da seguire.",
    icon: "◐",
  },
  {
    step: "03",
    title: "Partecipa, resta aggiornato, crea connessioni utili",
    text: "Candidature, aggiornamenti e relazioni restano dentro un unico flusso.",
    icon: "◆",
  },
];

export default function LandingPage() {
  const [email, setEmail] = useState("");

  const handleContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    const subject = encodeURIComponent("AiutarSi - Contatto landing");
    const body = encodeURIComponent(
      cleanEmail
        ? `Ciao,\n\nvorrei avere maggiori informazioni su AiutarSi.\n\nEmail di contatto: ${cleanEmail}\n`
        : "Ciao,\n\nvorrei avere maggiori informazioni su AiutarSi.\n"
    );
    window.location.href = `mailto:aiutarsi.it@gmail.com?subject=${subject}&body=${body}`;
  };

  return (
    <main className="page-shell">
      <div className="atmosphere atmosphere-one" />
      <div className="atmosphere atmosphere-two" />

      <header className="topbar">
        <div className="brand-lockup">
          <Image
            src="/logo-transparent.png"
            alt="AiutarSi"
            width={44}
            height={44}
            className="brand-icon"
            priority
          />
          <div className="wordmark-crop" aria-label="AiutarSi">
            <img src="/logo-lungo.jpeg" alt="AiutarSi" className="wordmark-image" />
          </div>
        </div>

        <nav className="topbar-links" aria-label="Navigazione">
          <a href="#download" className="pill-link">
            Scarica l&apos;app
          </a>
        </nav>
      </header>

      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">AiutarSi</p>
          <h1>Il modo più semplice per trovare, organizzare e vivere il volontariato locale.</h1>
          <p className="hero-text">
            AiutarSi connette volontari, enti e comunità locali in un’unica esperienza semplice,
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

          <div className="micro-copy">
            Una sola app per attività, enti, aggiornamenti e relazioni utili sul territorio.
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

      <section className="problem-section" id="problema">
        <div className="section-heading">
          <p className="eyebrow">Il problema</p>
          <h2>Oggi fare volontariato è più difficile di quanto dovrebbe essere.</h2>
        </div>

        <div className="problem-grid">
          {painPoints.map((item, index) => (
            <article key={item} className="problem-card">
              <span>{`0${index + 1}`}</span>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="solution-section" id="soluzione">
        <div className="section-heading">
          <p className="eyebrow">La soluzione</p>
          <h2>Una piattaforma unica per volontari, enti e comunità.</h2>
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
        </div>

        <div className="steps-grid">
          {steps.map((item) => (
            <article key={item.step} className="step-card">
              <div className="step-icon" aria-hidden="true">
                {item.icon}
              </div>
              <span className="step-number">{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cta-band" id="download">
        <div>
          <p className="eyebrow">CTA finale</p>
          <h2>Vuoi far parte di AiutarSi fin dall’inizio?</h2>
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
          <p className="eyebrow">Contatti</p>
          <h2>Lasciaci la tua email e ti ricontattiamo.</h2>
          <p>
            Se vuoi ricevere aggiornamenti, disponibilità o informazioni sul progetto, scrivici qui.
          </p>
        </div>

        <form className="contact-form" onSubmit={handleContact}>
          <label className="contact-label" htmlFor="contact-email">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            placeholder="nome@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="contact-input"
          />
          <button type="submit" className="primary-cta contact-submit">
            Contattaci
          </button>
          <p className="contact-helper">Il form apre il tuo client mail verso aiutarsi.it@gmail.com.</p>
        </form>
      </section>
    </main>
  );
}
