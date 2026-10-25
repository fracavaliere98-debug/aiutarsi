import { View } from "react-native";

import { ContactRow } from "../ui";
import { colors, radius, spacing } from "@/theme";

type SharedContactBlockProps = {
  email?: string | null;
  phone?: string | null;
  onOpenError?: () => void;
};

/** Contatti che il volontario ha scelto di condividere con l'ente. Non mostra nulla se non c'e' niente da mostrare. */
export function SharedContactBlock({ email, phone, onOpenError }: SharedContactBlockProps) {
  if (!email && !phone) return null;

  return (
    <View
      style={{
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.xl,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
    >
      {email ? <ContactRow kind="email" value={email} onOpenError={onOpenError} /> : null}
      {phone ? <ContactRow kind="phone" value={phone} onOpenError={onOpenError} /> : null}
    </View>
  );
}
