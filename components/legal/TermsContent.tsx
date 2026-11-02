import React from "react";
import { Text, View } from "react-native";
import { SoftCard } from "../SoftCard";
import { TERMS_LAST_UPDATE, TERMS_SECTIONS, TERMS_SUMMARY, type TermsSectionData } from "../../shared/termsContent";

// Il testo sta in shared/termsContent.ts (fonte unica, letta anche dalla landing).
function TermsSection({ title, paragraphs }: TermsSectionData) {
  return (
    <View className="mb-6">
      <Text className="text-primary font-bold text-lg mb-2">{title}</Text>
      {paragraphs.map((paragraph) => (
        <Text key={paragraph} className="text-secondary text-sm leading-6 mb-3">
          {paragraph}
        </Text>
      ))}
    </View>
  );
}

export function TermsContent() {
  return (
    <SoftCard className="p-6">
      <Text className="text-primary font-black text-xl mb-4">
        Termini e Condizioni d&apos;Uso
      </Text>
      <Text className="text-secondary text-sm leading-6 mb-4">
        Ultimo aggiornamento: {TERMS_LAST_UPDATE}
      </Text>
      <Text className="text-secondary text-sm leading-6 mb-4">
        Questi Termini sono il patto tra te e AiutarSì. Usando l&apos;app o creando un account li accetti.
      </Text>

      <View className="mb-6">
        <Text className="text-primary font-bold text-lg mb-2">In breve</Text>
        {TERMS_SUMMARY.map((line) => (
          <Text key={line} className="text-secondary text-sm leading-6 mb-2">
            {"•  "}{line}
          </Text>
        ))}
        <Text className="text-secondary text-xs leading-5 mt-1">
          Questo riassunto aiuta a capire, ma valgono le sezioni qui sotto.
        </Text>
      </View>

      {TERMS_SECTIONS.map((section) => (
        <TermsSection key={section.title} title={section.title} paragraphs={section.paragraphs} />
      ))}
    </SoftCard>
  );
}
