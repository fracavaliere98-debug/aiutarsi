import React from "react";
import { useRouter } from "expo-router";
import { NPOVerificationFlow } from "../../components/npo/NPOVerificationFlow";

export default function NPOVerificationScreen() {
  const router = useRouter();

  return (
    <NPOVerificationFlow
      title="Verifica del tuo ente"
      subtitle="Carica i documenti dell'organizzazione per richiedere il Bollino Viola anche dopo la registrazione."
      onBack={() => router.back()}
      onSkip={() => router.back()}
      onSubmitted={() => router.replace("/(npo)/(tabs)/profile" as any)}
    />
  );
}
