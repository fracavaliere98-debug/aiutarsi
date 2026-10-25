import { ActivityIndicator, Text, View } from "react-native";
import { SoftCard } from "../SoftCard";
import { SharedContactBlock } from "./SharedContactBlock";
import { SectionHeader } from "../ui";
import type { SharedContact } from "../../types";
import { colors, typography } from "@/theme";

type SharedContactsSectionProps = {
  /** Solo i contatti di questo volontario, gia' filtrati. */
  contacts: SharedContact[];
  /** Titolo dell'attivita' per id, per dire a quale iscrizione appartiene il contatto. */
  activityTitleById: Record<string, string>;
  isLoading?: boolean;
  isError?: boolean;
  onOpenError?: () => void;
};

/** Profilo volontario visto dall'ente: email e telefono che il volontario ha scelto di condividere con QUESTO ente. */
export function SharedContactsSection({ contacts, activityTitleById, isLoading, isError, onOpenError }: SharedContactsSectionProps) {
  const withContacts = contacts.filter((c) => c.email || c.phone);

  return (
    <View className="px-6 mb-6">
      <SectionHeader
        title="Contatti condivisi con te"
        description="Li ha scelti il volontario per la candidatura o l'iscrizione. Spariscono se annulla o se la candidatura è rifiutata."
      />
      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : isError ? (
        <Text style={{ ...typography.body, color: colors.dangerStrong }}>
          Non riesco a caricare i contatti. Riprova più tardi.
        </Text>
      ) : withContacts.length === 0 ? (
        <Text style={{ ...typography.body, color: colors.textMuted }}>
          Questo volontario non ha condiviso contatti con te.
        </Text>
      ) : (
        <View className="gap-3">
          {withContacts.map((c) => (
            <SoftCard key={`${c.source}-${c.refId}`} className="p-4">
              <Text style={{ ...typography.label, color: colors.textSecondary, marginBottom: 8 }}>
                {c.source === "APPLICATION"
                  ? "Candidatura all'ente"
                  : `Iscrizione: ${(c.activityId && activityTitleById[c.activityId]) || "attività"}`}
              </Text>
              <SharedContactBlock email={c.email} phone={c.phone} onOpenError={onOpenError} />
            </SoftCard>
          ))}
        </View>
      )}
    </View>
  );
}
