import type { Metadata } from "next";
import { LegalDocument } from "../../components/LegalDocument";
import { TERMS_LAST_UPDATE, TERMS_SECTIONS, TERMS_SUMMARY } from "../../../shared/termsContent";

export const metadata: Metadata = {
  title: "Termini e Condizioni | AiutarSì",
  description: "Le regole di uso di AiutarSì per volontari, enti non profit e aziende partner.",
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="Termini e Condizioni d'Uso"
      lastUpdate={TERMS_LAST_UPDATE}
      intro="Questi Termini sono il patto tra te e AiutarSì. Usando l'app o creando un account li accetti."
      summary={{ title: "In breve", lines: TERMS_SUMMARY }}
      sections={TERMS_SECTIONS}
    />
  );
}
