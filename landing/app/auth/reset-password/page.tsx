"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getBrowserSupabase, hasBrowserSupabaseConfig } from "../../../lib/supabase-browser";

type RecoveryState = "loading" | "ready" | "success" | "error";

export default function ResetPasswordPage() {
  const hasConfig = useMemo(() => hasBrowserSupabaseConfig(), []);
  const [status, setStatus] = useState<RecoveryState>("loading");
  const [message, setMessage] = useState("Stiamo verificando il link di recupero...");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session?.user) {
          throw new Error("Link di recupero non valido o scaduto.");
        }

        if (!active) return;
        setStatus("ready");
        setMessage("Scegli una nuova password e confermala per completare il recupero.");
      } catch (error: any) {
        if (!active) return;
        setStatus("error");
        setMessage(error?.message || "Non siamo riusciti a verificare il link di recupero.");
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [hasConfig]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (!password || !confirmPassword) {
      setStatus("error");
      setMessage("Inserisci e conferma la nuova password.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Le due password non coincidono.");
      return;
    }

    if (password.length < 8) {
      setStatus("error");
      setMessage("La nuova password deve avere almeno 8 caratteri.");
      return;
    }

    try {
      if (!hasConfig) {
        throw new Error("Configurazione Supabase non disponibile sul sito.");
      }
      const supabase = getBrowserSupabase();
      setSubmitting(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      setStatus("success");
      setMessage("Password aggiornata correttamente. Ora puoi aprire l'app ed effettuare l'accesso con la nuova password.");
    } catch (error: any) {
      setStatus("error");
      setMessage(error?.message || "Non siamo riusciti ad aggiornare la password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-eyebrow">Recupero password</p>
        <h1>
          {status === "ready"
            ? "Imposta una nuova password"
            : status === "success"
              ? "Password aggiornata"
              : status === "error"
                ? "Link non valido"
                : "Stiamo verificando il link"}
        </h1>
        <p className="auth-body">{message}</p>

        {status === "ready" ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <input
              type="password"
              className="auth-input"
              placeholder="Nuova password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <input
              type="password"
              className="auth-input"
              placeholder="Conferma password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <button type="submit" className="primary-cta auth-submit" disabled={submitting}>
              {submitting ? "Aggiornamento..." : "Aggiorna password"}
            </button>
          </form>
        ) : (
          <div className="auth-actions">
            <a href="aiutarsiapp://login" className="primary-cta">
              Apri l&apos;app
            </a>
            <Link href="/" className="secondary-cta">
              Torna al sito
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
