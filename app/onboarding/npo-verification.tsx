import React from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { NPOVerificationFlow } from "../../components/npo/NPOVerificationFlow";

export default function NPOVerificationScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <NPOVerificationFlow
      title="Verifica dell'ente"
      subtitle="La verifica aumenta fiducia e visibilita. Puoi completarla ora oppure tornare piu tardi."
      onBack={() => router.back()}
      onClose={() => logout()}
      onSkip={() => router.push("/onboarding/npo-preview")}
      onSubmitted={() => router.push("/onboarding/npo-preview")}
    />
  );
}
