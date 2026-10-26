import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    SectionList,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Check, ChevronDown, MapPin, X } from "lucide-react-native";
import { colors } from "@/theme";
import { useProvincialCapitalsQuery } from "../hooks/preferred-city/queries";
import type { ProvincialCapital } from "../services/PreferredCityService";

interface PreferredCityPickerProps {
    cityCode: string | null;
    isPublic: boolean;
    onChange: (cityCode: string | null, isPublic: boolean) => void;
    disabled?: boolean;
}

const normalize = (value: string) =>
    value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * P11 — scelta della "Posizione preferita" tra i capoluoghi di provincia (tap, niente testo libero).
 * Non e' la posizione del telefono: e' una preferenza dichiarata, visibile agli altri solo con l'interruttore acceso.
 */
export function PreferredCityPicker({ cityCode, isPublic, onChange, disabled }: PreferredCityPickerProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const { data: capitals = [], isLoading, isError, refetch } = useProvincialCapitalsQuery();

    const selected = useMemo(() => capitals.find((c) => c.code === cityCode) || null, [capitals, cityCode]);

    const sections = useMemo(() => {
        const term = normalize(search.trim());
        const filtered = term ? capitals.filter((c) => normalize(c.name).includes(term)) : capitals;
        const byRegion = new Map<string, ProvincialCapital[]>();
        filtered.forEach((c) => {
            byRegion.set(c.region, [...(byRegion.get(c.region) || []), c]);
        });
        return Array.from(byRegion.entries())
            .sort(([a], [b]) => a.localeCompare(b, "it"))
            .map(([region, data]) => ({ title: region, data }));
    }, [capitals, search]);

    const listHeight = Math.round(Dimensions.get("window").height * 0.55);

    const close = () => {
        setOpen(false);
        setSearch("");
    };

    return (
        <View>
            <TouchableOpacity
                onPress={() => setOpen(true)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel="Scegli la posizione preferita"
                className="bg-background-light px-4 py-4 rounded-2xl border border-primary/10 flex-row items-center justify-between"
            >
                <View className="flex-row items-center gap-2 flex-1">
                    <MapPin size={18} color={colors.primary} />
                    <Text className={`${selected ? "text-primary" : "text-secondary/60"} font-medium`}>
                        {selected ? `${selected.name} (${selected.provinceCode})` : "Scegli una città"}
                    </Text>
                </View>
                <ChevronDown size={18} color={colors.primary} />
            </TouchableOpacity>

            {selected ? (
                <View className="flex-row items-center justify-between mt-3 bg-background-light px-4 py-3 rounded-2xl border border-primary/10">
                    <View className="flex-1 pr-3">
                        <Text className="text-primary font-medium">Mostra sul mio profilo</Text>
                        <Text className="text-[11px] text-secondary/70 mt-0.5 leading-relaxed">
                            {isPublic ? "Gli altri la vedono sul tuo profilo." : "Per ora la vedi solo tu."}
                        </Text>
                    </View>
                    <Switch
                        value={isPublic}
                        onValueChange={(value) => onChange(selected.code, value)}
                        disabled={disabled}
                        accessibilityLabel="Mostra la posizione preferita sul mio profilo"
                    />
                </View>
            ) : null}

            <Text className="text-[11px] text-secondary/70 mt-2 leading-relaxed">
                Opzionale. Non è la tua posizione: non la rileviamo e nessuno vede dove sei. Se la mostri, sul profilo compare solo questa città.
            </Text>

            <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
                <View className="flex-1 justify-end bg-black/40">
                    <View className="bg-white rounded-t-[28px] p-4 pb-8">
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-lg font-bold text-primary">Posizione preferita</Text>
                            <TouchableOpacity onPress={close} accessibilityLabel="Chiudi" className="p-2">
                                <X size={20} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            className="bg-background-light p-4 rounded-2xl border border-primary/10 text-primary mb-3"
                            placeholder="Cerca una città"
                            placeholderTextColor="#9ca3af"
                            value={search}
                            onChangeText={setSearch}
                            autoCorrect={false}
                        />
                        {cityCode ? (
                            <TouchableOpacity
                                onPress={() => {
                                    onChange(null, false);
                                    close();
                                }}
                                className="py-3 mb-1"
                            >
                                <Text className="text-secondary font-medium">Nessuna preferenza</Text>
                            </TouchableOpacity>
                        ) : null}
                        <View style={{ height: listHeight }}>
                            {isLoading ? (
                                <ActivityIndicator color={colors.primary} />
                            ) : isError ? (
                                <TouchableOpacity onPress={() => refetch()} className="py-4">
                                    <Text className="text-secondary">Non riesco a caricare l&apos;elenco. Tocca per riprovare.</Text>
                                </TouchableOpacity>
                            ) : (
                                <SectionList
                                    sections={sections}
                                    keyExtractor={(item) => item.code}
                                    keyboardShouldPersistTaps="handled"
                                    stickySectionHeadersEnabled={false}
                                    ListEmptyComponent={
                                        <Text className="text-secondary py-4">Nessuna città trovata.</Text>
                                    }
                                    renderSectionHeader={({ section }) => (
                                        <Text className="text-[11px] font-bold text-secondary uppercase tracking-wide pt-4 pb-1 bg-white">
                                            {section.title}
                                        </Text>
                                    )}
                                    renderItem={({ item }) => {
                                        const isSelected = item.code === cityCode;
                                        return (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    onChange(item.code, isPublic);
                                                    close();
                                                }}
                                                className="py-4 flex-row items-center justify-between border-b border-primary/5"
                                            >
                                                <Text className={`${isSelected ? "text-primary font-bold" : "text-secondary"} text-base`}>
                                                    {item.name} ({item.provinceCode})
                                                </Text>
                                                {isSelected ? <Check size={16} color={colors.primary} /> : null}
                                            </TouchableOpacity>
                                        );
                                    }}
                                />
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
