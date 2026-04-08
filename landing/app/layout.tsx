import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AiutarSì | Volontariato che torna umano",
  description:
    "AiutarSì connette volontari ed enti in modo più chiaro, locale e utile. Attività, community e supporto AI in un unico spazio.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
