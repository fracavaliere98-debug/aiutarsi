import Link from "next/link";

type Section = { title: string; paragraphs: string[] };

// Pagina legale della landing. Il testo NON sta qui: arriva da ../shared (fonte unica, la stessa
// dell'app). Se serve cambiare le parole, si cambia shared/privacyPolicyContent.ts o shared/termsContent.ts.
export function LegalDocument({
  title,
  lastUpdate,
  intro,
  summary,
  sections,
}: {
  title: string;
  lastUpdate: string;
  intro: string;
  summary?: { title: string; lines: string[] };
  sections: Section[];
}) {
  return (
    <main className="legal-page">
      <Link href="/" className="legal-back">
        ← AiutarSì
      </Link>
      <h1>{title}</h1>
      <p className="legal-meta">Ultimo aggiornamento: {lastUpdate}</p>
      <p>{intro}</p>
      {summary ? (
        <section>
          <h2>{summary.title}</h2>
          <ul>
            {summary.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
      <nav className="legal-links">
        <Link href="/privacy-policy">Privacy Policy</Link>
        <Link href="/terms">Termini e Condizioni</Link>
      </nav>
    </main>
  );
}
