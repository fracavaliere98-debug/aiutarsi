import type { Metadata } from "next";
import { LegalDocument } from "../../components/LegalDocument";
import { PRIVACY_POLICY_LAST_UPDATE, PRIVACY_POLICY_SECTIONS } from "../../../shared/privacyPolicyContent";

export const metadata: Metadata = {
  title: "Privacy Policy | AiutarSì",
  description: "Quali dati personali tratta AiutarSì, perché, chi li vede e per quanto tempo li conserviamo.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Informativa sulla Privacy"
      lastUpdate={PRIVACY_POLICY_LAST_UPDATE}
      intro="Questa informativa spiega quali dati personali tratta AiutarSì, perché, chi li vede e per quanto tempo li conserviamo."
      sections={PRIVACY_POLICY_SECTIONS}
    />
  );
}
