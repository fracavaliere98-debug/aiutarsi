"use client";

import { useEffect, useState } from "react";

/**
 * Fallback per i link condivisi dall'app (https://aiutarsi.app/activity/<id>, /npo-profile/<id>,
 * /volunteer-profile/<id>). Il sito è un export statico: le pagine dinamiche non esistono, quindi
 * l'host serve questa 404 (`404.html`) e qui riconosciamo il percorso per proporre l'apertura nell'app.
 * Se l'app è installata con i Universal/App Links attivi, il sistema apre direttamente l'app
 * senza passare da qui.
 */
const SHARE_ROUTES = ["activity", "npo-profile", "volunteer-profile"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function NotFound() {
  const [deepLink, setDeepLink] = useState<string | null>(null);

  useEffect(() => {
    const [route, id] = window.location.pathname.split("/").filter(Boolean);
    if ((SHARE_ROUTES as readonly string[]).includes(route) && id && UUID_RE.test(id)) {
      setDeepLink(`aiutarsiapp://${route}/${id}`);
    }
  }, []);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 420 }}>
        {deepLink ? (
          <>
            <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Apri questo contenuto in AiutarSì</h1>
            <p style={{ color: "var(--muted)", margin: "0 0 24px" }}>
              Il contenuto condiviso si visualizza nell&apos;app. Se non l&apos;hai ancora installata, scaricala e poi riapri il link.
            </p>
            <a
              href={deepLink}
              style={{
                display: "inline-block",
                padding: "14px 28px",
                borderRadius: 999,
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Apri nell&apos;app
            </a>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Pagina non trovata</h1>
            <a href="/" style={{ color: "var(--accent)", fontWeight: 700 }}>
              Torna alla home
            </a>
          </>
        )}
      </div>
    </main>
  );
}
