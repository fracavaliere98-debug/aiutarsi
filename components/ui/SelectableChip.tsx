import { TouchableOpacity, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors } from "@/theme";

type SelectableChipProps = {
    label: string;
    selected: boolean;
    onPress: () => void;
    /** Opzionale: se presente, il chip mostra l'icona a sinistra del testo (es. competenze vs categoria). */
    icon?: LucideIcon;
    testID?: string;
};

/**
 * Chip di selezione condiviso (bordo + sfondo pieno quando selezionato). Usato per Categoria e
 * Competenze in ActivityForm: un solo componente evita che le due sezioni tornino a divergere
 * su padding/font-size come già successo due volte con className duplicate a mano.
 */
export function SelectableChip({ label, selected, onPress, icon: Icon, testID }: SelectableChipProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            testID={testID}
            // px-4 py-2/rounded-xl/border/colori sono identici con o senza icona: quello è "il box".
            // flex-row/items-center/gap si aggiungono SOLO se c'è un'icona da affiancare al testo —
            // altrimenti (Categoria) il TouchableOpacity non li aveva mai avuti, e items-center
            // (che sovrascrive lo stretch di default di RN sull'asse trasversale) cambiava la resa
            // del box anche nel caso senza icona.
            className={`px-4 py-2 rounded-xl border ${Icon ? "flex-row items-center gap-1.5" : ""} ${selected ? "bg-primary border-primary" : "bg-white border-primary/10"}`}
        >
            {Icon && <Icon size={12} color={selected ? "white" : colors.primary} />}
            <Text className={`font-bold text-xs ${selected ? "text-white" : "text-primary"}`}>{label}</Text>
        </TouchableOpacity>
    );
}
