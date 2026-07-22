import { TouchableOpacity, Text } from "react-native";
import { colors } from "@/theme";

type SelectableChipProps = {
    label: string;
    selected: boolean;
    onPress: () => void;
    /** "category" = solo testo, centrato (Categoria). "skill" = emoji + testo, allineati in alto a sinistra (Competenze). */
    variant: "category" | "skill";
    /** Solo per variant="skill": emoji piena (stile mockup approvato), non un'icona Lucide. */
    emoji?: string;
    testID?: string;
};

const BORDER_INACTIVE = "rgba(70, 34, 130, 0.1)"; // border-primary/10

/**
 * Chip di selezione condiviso (bordo + sfondo pieno quando selezionato), usato per Categoria e
 * Competenze in ActivityForm. Dimensioni esatte da spec approvata (px, non scala Tailwind) per
 * evitare che le due sezioni divergano di nuovo come già successo più volte con className a mano.
 */
export function SelectableChip({ label, selected, onPress, variant, emoji, testID }: SelectableChipProps) {
    const borderColor = selected ? colors.primary : BORDER_INACTIVE;
    const backgroundColor = selected ? colors.primary : "white";
    const textColor = selected ? "white" : colors.primary;
    const fontWeight = selected ? "800" : "700";

    if (variant === "skill") {
        return (
            <TouchableOpacity
                onPress={onPress}
                testID={testID}
                style={{
                    borderRadius: 12,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor,
                    backgroundColor,
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 6,
                }}
            >
                {!!emoji && <Text style={{ fontSize: 10, marginTop: 1 }}>{emoji}</Text>}
                {/* flex:1 qui collasserebbe il testo a larghezza zero: il chip si dimensiona sul
                    contenuto (nessuna larghezza fissa nel flex-wrap), quindi niente flex-basis:0. */}
                <Text style={{ fontSize: 10.5, fontWeight, color: textColor, flexShrink: 1 }}>{label}</Text>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            testID={testID}
            style={{
                borderRadius: 12,
                paddingVertical: 8,
                paddingHorizontal: 13,
                borderWidth: 1,
                borderColor,
                backgroundColor,
            }}
        >
            <Text style={{ fontSize: 11, fontWeight, color: textColor, textAlign: "center" }}>{label}</Text>
        </TouchableOpacity>
    );
}
