"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getBrowserSupabase, hasBrowserSupabaseConfig } from "../../../lib/supabase-browser";

type ConfirmState = "loading" | "success" | "error";

export default function ConfirmEmailPage() {
  const [status, setStatus] = useState<ConfirmState>("loading");
  const [message, setMessage] = useState("Stiamo verificando il link di conferma...");

  const hasConfig = useMemo(() => hasBrowserSupabaseConfig(), []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        if (!hasConfig) {
          throw new Error("Configurazione Supabase non disponibile sul sito.");
        }
        const supabase = getBrowserSupabase();
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const tokenHash = params.get("token_hash");
        const type = params.get("type") as EmailOtpType | null;

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (error) throw error;
        } else {
          throw new Error("Link di conferma non valido o incompleto.");
        }

        if (!active) return;
        setStatus("success");
        setMessage("Email confermata correttamente. Ora puoi aprire l'app ed effettuare l'accesso.");
      } catch (error: any) {
        if (!active) return;
        setStatus("error");
        setMessage(error?.message || "Non siamo riusciti a confermare la tua email.");
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [hasConfig]);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-eyebrow">Conferma email</p>
        <h1>{status === "success" ? "Conferma completata" : status === "error" ? "Qualcosa non ha funzionato" : "Stiamo verificando il tuo account"}</h1>
        <p className="auth-body">{message}</p>

        <div className="auth-actions">
          <a href="aiutarsiapp://login" className="primary-cta">
            Apri l&apos;app
          </a>
          <Link href="/" className="secondary-cta">
            Torna al sito
          </Link>
        </div>
      </section>
    </main>
  );
}
