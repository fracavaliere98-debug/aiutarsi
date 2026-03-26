import React from "react";
import { useRouter } from "expo-router";
import { StandardLayout } from "../components/StandardLayout";
import { TermsContent } from "../components/legal/TermsContent";

export default function TermsScreen() {
  const router = useRouter();

  return (
    <StandardLayout
      title="Termini e Condizioni"
      label="Legale"
      onBack={() => router.back()}
    >
      <TermsContent />
    </StandardLayout>
  );
}
