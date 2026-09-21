/**
 * TimePicker.tsx
 * Bottom-sheet time picker (colonne Ore / Minuti, step 5 minuti), stesso linguaggio visivo di
 * CalendarPicker (modal a comparsa dal basso, stessi radius/overlay). Introdotto per sostituire i
 * TextInput a testo libero di Inizio/Fine in ActivityForm — vedi
 * docs/design/activity-form-design-critique.md, raccomandazione #2: un utente non deve poter
 * digitare un orario non valido, e l'interazione "temporale" deve essere coerente con quella già
 * usata per Data e Ricorrenza (tap su un campo → bottom sheet → scelta da lista, mai testo libero).
 *
 * Formato in ingresso/uscita: stringa "HH:mm" (24h), invariato rispetto al TextInput che sostituisce
 * — nessuna modifica richiesta ad activityFormLogic.ts o ai test di validazione.
 */
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Modal, Platform, ScrollView } from "react-native";
import { X, Clock } from "lucide-react-native";
import { colors } from "@/theme";

export interface TimePickerProps {
    visible: boolean;
    /** Valore iniziale "HH:mm", oppure stringa vuota/non valida (fallback 10:00). */
    value?: string;
    /** Titolo del bottom sheet, es. "Orario di inizio". */
    label?: string;
    onSelect: (time: string) => void;
    onClose: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function parseTime(value?: string): { h: string; m: string } {
    const match = /^(\d{1,2}):(\d{1,2})$/.exec((value || "").trim());
    if (!match) return { h: "10", m: "00" };
    const hNum = Math.min(Math.max(Number(match[1]), 0), 23);
    const h = String(hNum).padStart(2, "0");
    // I minuti arbitrari (es. un valore storico "10:07") vengono agganciati al multiplo di 5 più
    // vicino: la lista mostra solo step da 5 minuti, ma non deve mai risultare "nessuna selezione".
    const mRounded = Math.round(Number(match[2]) / 5) * 5;
    const m = String(mRounded >= 60 ? 55 : mRounded).padStart(2, "0");
    return { h, m };
}

export function TimePicker({ visible, value, label = "Scegli l'orario", onSelect, onClose }: TimePickerProps) {
    const [hour, setHour] = useState("10");
    const [minute, setMinute] = useState("00");

    useEffect(() => {
        if (!visible) return;
        const parsed = parseTime(value);
        setHour(parsed.h);
        setMinute(parsed.m);
    }, [visible, value]);

    function confirm() {
        onSelect(`${hour}:${minute}`);
        onClose();
    }

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}>
                <View style={{ backgroundColor: "white", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Platform.OS === "ios" ? 40 : 28 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Clock size={18} color={colors.primary} />
                            <Text style={{ fontSize: 18, fontWeight: "900", color: colors.primary }}>{label}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} accessibilityLabel="Chiudi">
                            <X size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingTop: 16, gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", marginBottom: 8, textAlign: "center" }}>
                                Ore
                            </Text>
                            <ScrollView style={{ height: 220 }} showsVerticalScrollIndicator={false}>
                                <View style={{ gap: 6, paddingBottom: 4 }}>
                                    {HOURS.map((h) => {
                                        const selected = h === hour;
                                        return (
                                            <TouchableOpacity
                                                key={h}
                                                onPress={() => setHour(h)}
                                                style={{
                                                    paddingVertical: 12,
                                                    borderRadius: 14,
                                                    alignItems: "center",
                                                    minHeight: 44,
                                                    justifyContent: "center",
                                                    backgroundColor: selected ? colors.primary : "white",
                                                    borderWidth: 1,
                                                    borderColor: selected ? colors.primary : "#e2e8f0",
                                                }}
                                            >
                                                <Text style={{ fontSize: 15, fontWeight: "800", color: selected ? "white" : "#1e1b4b" }}>{h}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", marginBottom: 8, textAlign: "center" }}>
                                Minuti
                            </Text>
                            <ScrollView style={{ height: 220 }} showsVerticalScrollIndicator={false}>
                                <View style={{ gap: 6, paddingBottom: 4 }}>
                                    {MINUTES.map((m) => {
                                        const selected = m === minute;
                                        return (
                                            <TouchableOpacity
                                                key={m}
                                                onPress={() => setMinute(m)}
                                                style={{
                                                    paddingVertical: 12,
                                                    borderRadius: 14,
                                                    alignItems: "center",
                                                    minHeight: 44,
                                                    justifyContent: "center",
                                                    backgroundColor: selected ? colors.primary : "white",
                                                    borderWidth: 1,
                                                    borderColor: selected ? colors.primary : "#e2e8f0",
                                                }}
                                            >
                                                <Text style={{ fontSize: 15, fontWeight: "800", color: selected ? "white" : "#1e1b4b" }}>{m}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        </View>
                    </View>

                    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                        <TouchableOpacity
                            onPress={confirm}
                            activeOpacity={0.9}
                            style={{ height: 52, borderRadius: 16, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}
                        >
                            <Text style={{ color: "white", fontWeight: "900", fontSize: 15 }}>Conferma {hour}:{minute}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
