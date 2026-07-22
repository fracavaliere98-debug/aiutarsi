import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Calendar, Users, ArrowRight, Clock, CheckCircle2, AlertCircle, RefreshCw, Trash2, ChevronDown, Check, Camera, Sparkles } from "lucide-react-native";
import { StandardLayout } from "../StandardLayout";
import { AddressAutocomplete } from "../AddressAutocomplete";
import { CalendarPicker } from "../CalendarPicker";
import { SKILLS } from "../../constants/Skills";
import { ACTIVITY_CATEGORIES } from "../../constants/Interests";
import { gemmaService } from "../../services/GemmaService";
import { requestMediaLibraryPermission } from "../../utils/permissions";
import { useToast } from "../../context/ToastContext";
import { colors } from "@/theme";
import { getInitialCoordsConfirmed, shouldAutoCurateDraft, validateActivityFormSubmit } from "./activityFormLogic";

export type ActivityFormValues = {
    title: string;
    category: string;
    address: string;
    lat: number;
    lng: number;
    date: string;
    slots: string;
    description: string;
    startTime: string;
    endTime: string;
    isUrgent: boolean;
    skills: string[];
    imageUrl?: string;
    recurrence: "NONE" | "WEEKLY" | "MONTHLY";
};

const RECURRENCE_LABELS: Record<ActivityFormValues["recurrence"], string> = {
    NONE: "Nessuna ricorrenza",
    WEEKLY: "Ogni settimana",
    MONTHLY: "Ogni mese",
};

const RECURRENCE_OPTIONS: { value: ActivityFormValues["recurrence"]; label: string; description: string }[] = [
    { value: "NONE", label: "Nessuna ricorrenza", description: "L'attività si svolge una volta sola." },
    { value: "WEEKLY", label: "Ogni settimana", description: "Si ripete automaticamente ogni settimana." },
    { value: "MONTHLY", label: "Ogni mese", description: "Si ripete automaticamente ogni mese." },
];

type Props = {
    mode: "create" | "edit";
    headerLabel: string;
    headerTitle: string;
    onBack: () => void;
    initialValues: ActivityFormValues;
    /** Cambia quando initialValues arriva/si aggiorna in modo asincrono (attività caricata, bozza AI, duplicazione) — il form si ri-sincronizza. */
    resetKey: string | number;
    onSubmit: (values: ActivityFormValues) => Promise<void> | void;
    submitLabel: string;
    isSubmitting?: boolean;
    isLoading?: boolean;
    /** Ritorna false se l'ente ha già 3 attività urgenti attive (escludendo quella corrente in edit). */
    canEnableUrgent: () => boolean;
    onDelete?: () => void;
    /**
     * Se true, appena il titolo è valorizzato dopo un reset (tipicamente arrivando da "Rilancia con AI"),
     * lancia in automatico una rifinitura AI della descrizione, una sola volta.
     * Replica il comportamento storico di create-activity.tsx per params.ai_draft === 'true'.
     */
    autoCurateOnLoad?: boolean;
};

export function ActivityForm({
    mode,
    headerLabel,
    headerTitle,
    onBack,
    initialValues,
    resetKey,
    onSubmit,
    submitLabel,
    isSubmitting = false,
    isLoading = false,
    canEnableUrgent,
    onDelete,
    autoCurateOnLoad = false,
}: Props) {
    const { showToast } = useToast();
    const [formDataState, setFormData] = useState<ActivityFormValues>(initialValues);
    // L'indirizzo arriva già confermato quando il form si popola con dati esistenti (edit, duplicazione,
    // bozza AI riuscita); parte da confermare solo quando il campo indirizzo è davvero vuoto (creazione da zero,
    // o fallback generico della bozza AI che non porta un indirizzo). Vedi nota sotto per il gating in submit.
    const [coordsConfirmedState, setCoordsConfirmed] = useState(getInitialCoordsConfirmed(initialValues.address));
    const [showCalendar, setShowCalendar] = useState(false);
    const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
    const [isCuratingDraft, setIsCuratingDraft] = useState(false);
    const [hasAutoCuratedDraft, setHasAutoCuratedDraft] = useState(false);

    // Re-seed form when the async source of truth changes (activity loaded, AI draft applied, duplicate source
    // picked). Aggiornato durante il render (pattern React "adjusting state when a prop changes"), non in un
    // useEffect: un useEffect scatta dopo il commit, quindi per un render intero "isLoading" sarebbe già false
    // (l'attività è arrivata) ma "formData" conterrebbe ancora il valore vuoto iniziale — crash su
    // formData.skills.includes(...) più sotto. Le variabili locali "formData"/"coordsConfirmed" (non lo state
    // grezzo) vengono usate nel resto del render proprio per riflettere subito il nuovo valore in questo stesso
    // giro, invece di aspettare il render successivo innescato dalle setFormData/setCoordsConfirmed qui sotto.
    const [prevResetKey, setPrevResetKey] = useState(resetKey);
    let formData = formDataState;
    let coordsConfirmed = coordsConfirmedState;
    if (resetKey !== prevResetKey) {
        setPrevResetKey(resetKey);
        setFormData(initialValues);
        setCoordsConfirmed(getInitialCoordsConfirmed(initialValues.address));
        formData = initialValues;
        coordsConfirmed = getInitialCoordsConfirmed(initialValues.address);
    }

    const pickImage = async () => {
        const granted = await requestMediaLibraryPermission({
            title: "Accesso alla galleria",
            message: "AiutarSi ti chiede l'accesso alla galleria per gestire l'immagine dell'attività.",
            settingsLabel: "la galleria",
        });
        if (!granted) {
            showToast("error", "Permesso galleria necessario per aggiungere una foto.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });
        if (!result.canceled) {
            setFormData((prev) => ({ ...prev, imageUrl: result.assets[0].uri }));
        }
    };

    const applyCuratedDraft = async (source: "button" | "auto" = "button") => {
        if (!formData.title.trim()) {
            showToast("error", "Inserisci almeno un titolo prima di usare l'AI.");
            return;
        }
        setIsCuratingDraft(true);
        try {
            const curated = await gemmaService.curateActivityDraft({
                title: formData.title.trim(),
                description: formData.description.trim(),
                category: formData.category,
            });
            const suggestedSkills = SKILLS
                .filter((skill) => curated.suggestedSkills.includes(skill.id) || curated.suggestedSkills.includes(skill.label))
                .map((skill) => skill.id);
            setFormData((prev) => ({
                ...prev,
                description: curated.expandedDescription || prev.description,
                category: curated.suggestedCategory || prev.category,
                skills: suggestedSkills.length > 0 ? suggestedSkills : prev.skills,
            }));
            if (source === "auto") {
                setHasAutoCuratedDraft(true);
            }
            showToast("success", source === "auto" ? "Bozza AI aggiornata." : "Descrizione migliorata con AI.");
        } catch (error) {
            console.error("[ActivityForm] activity-curator-ai failed", error);
            if (source === "auto") {
                setHasAutoCuratedDraft(true);
            }
            showToast("error", "Non sono riuscita a generare una bozza AI. Riprova tra poco.");
        } finally {
            setIsCuratingDraft(false);
        }
    };

    // Replica il comportamento storico di create-activity.tsx: quando si arriva da "Rilancia con AI"
    // (ai_draft=true), appena il titolo precompilato è disponibile lancia una rifinitura AI automatica, una sola volta.
    useEffect(() => {
        if (!shouldAutoCurateDraft({ autoCurateOnLoad, title: formData.title, isCuratingDraft, hasAutoCuratedDraft })) {
            return;
        }
        applyCuratedDraft("auto");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoCurateOnLoad, formData.title, hasAutoCuratedDraft, isCuratingDraft]);

    const handleSubmit = () => {
        const result = validateActivityFormSubmit(mode, formData, coordsConfirmed);
        if (!result.ok) {
            showToast("error", result.message);
            return;
        }
        onSubmit(formData);
    };

    if (isLoading) {
        return (
            <StandardLayout title={headerTitle} label="Caricamento...">
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </StandardLayout>
        );
    }

    return (
        <>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={0}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: 140 }}>
                    <StandardLayout label={headerLabel} title={headerTitle} bg="bg-background-light" onBack={onBack} noScroll>
                        <View className="gap-5">
                            {/* Foto — opzionale, in cima come da mockup. In modifica con foto già presente: banner
                                a piena larghezza con overlay "Cambia foto" (handoff design ActivityForm.tsx §3.1). */}
                            {mode === "edit" && formData.imageUrl ? (
                                <TouchableOpacity onPress={pickImage} activeOpacity={0.85} className="rounded-2xl overflow-hidden" style={{ height: 76 }}>
                                    <Image source={{ uri: formData.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                                    <View
                                        className="absolute inset-0 flex-row items-center justify-center gap-2"
                                        style={{ backgroundColor: "rgba(0,0,0,0.32)" }}
                                    >
                                        <RefreshCw size={16} color="white" />
                                        <Text className="text-white font-extrabold text-xs">Cambia foto</Text>
                                    </View>
                                </TouchableOpacity>
                            ) : mode === "edit" ? (
                                <TouchableOpacity onPress={pickImage} activeOpacity={0.85} className="rounded-2xl overflow-hidden" style={{ height: 76 }}>
                                    <LinearGradient colors={[colors.accent, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
                                        <View className="flex-1 flex-row items-center justify-center gap-2" style={{ backgroundColor: "rgba(0,0,0,0.32)" }}>
                                            <Camera size={16} color="white" />
                                            <Text className="text-white font-extrabold text-xs">Aggiungi una foto</Text>
                                        </View>
                                    </LinearGradient>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    onPress={pickImage}
                                    activeOpacity={0.8}
                                    className="flex-row items-center gap-3 bg-white p-3 rounded-2xl border border-primary/5 shadow-sm"
                                >
                                    <View className="w-11 h-11 rounded-xl overflow-hidden bg-primary/5 items-center justify-center">
                                        {formData.imageUrl ? (
                                            <Image source={{ uri: formData.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                                        ) : (
                                            <Camera size={18} color={colors.primary} />
                                        )}
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-primary font-bold text-sm">{formData.imageUrl ? "Cambia foto" : "Aggiungi una foto"}</Text>
                                        <Text className="text-secondary text-[11px] mt-0.5">Facoltativo, consigliato.</Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {/* Sezione 1: identità dell'attività — massima priorità */}
                            <View className="gap-3">
                                <Text className="text-primary font-black text-base">Cosa organizzi</Text>
                                <View>
                                    <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Titolo attività</Text>
                                    <View className="bg-white p-4 rounded-2xl shadow-sm border border-primary/5">
                                        <TextInput
                                            placeholder="es. Distribuzione Pasti"
                                            placeholderTextColor="#94a3b8"
                                            value={formData.title}
                                            onChangeText={(t) => setFormData({ ...formData, title: t })}
                                            className="text-primary font-bold text-lg"
                                        />
                                    </View>
                                </View>
                                <View>
                                    <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Categoria</Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {ACTIVITY_CATEGORIES.map((cat) => (
                                            <TouchableOpacity
                                                key={cat}
                                                onPress={() => setFormData({ ...formData, category: cat })}
                                                className={`px-4 py-2 rounded-xl border ${formData.category === cat ? "bg-primary border-primary" : "bg-white border-primary/10"}`}
                                            >
                                                <Text className={`font-bold text-xs ${formData.category === cat ? "text-white" : "text-primary"}`}>{cat}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            {/* Sezione 2: logistica */}
                            <View className="gap-3">
                                <Text className="text-primary font-black text-base">Quando e dove</Text>

                                <View style={{ flexDirection: "row", gap: 8 }}>
                                    <View style={{ flex: 1.7 }}>
                                        <Text className="text-secondary/60 text-[10px] font-semibold mb-1 ml-1">Data</Text>
                                        <TouchableOpacity
                                            onPress={() => setShowCalendar(true)}
                                            activeOpacity={0.8}
                                            style={{
                                                backgroundColor: "white", padding: 14, borderRadius: 16,
                                                flexDirection: "row", alignItems: "center", gap: 10,
                                                borderWidth: 1, borderColor: formData.date ? colors.primary + "40" : "#ede9fe",
                                                shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
                                            }}
                                        >
                                            <Calendar size={18} color={formData.date ? colors.primary : colors.textSecondary} />
                                            <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: formData.date ? colors.primary : "#94a3b8" }}>
                                                {formData.date
                                                    ? new Date(formData.date).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "long" })
                                                    : "Scegli data"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text className="text-secondary/60 text-[10px] font-semibold mb-1 ml-1">Volontari</Text>
                                        <View
                                            style={{
                                                backgroundColor: "white", paddingHorizontal: 12, height: 48, borderRadius: 16,
                                                flexDirection: "row", alignItems: "center", gap: 8,
                                                borderWidth: 1, borderColor: "#ede9fe",
                                                shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
                                            }}
                                        >
                                            <Users size={16} color={colors.textSecondary} />
                                            <TextInput
                                                placeholder="10"
                                                placeholderTextColor="#94a3b8"
                                                keyboardType="number-pad"
                                                maxLength={3}
                                                value={formData.slots}
                                                onChangeText={(t) => setFormData({ ...formData, slots: t })}
                                                style={{ flex: 1, color: colors.primary, fontWeight: "700", fontSize: 14 }}
                                            />
                                        </View>
                                    </View>
                                </View>

                                <View style={{ flexDirection: "row", gap: 12 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text className="text-secondary/60 text-[10px] font-semibold mb-1 ml-1">Inizio</Text>
                                        <View className="bg-white p-3.5 rounded-2xl shadow-sm border border-primary/5 flex-row items-center">
                                            <Clock size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                                            <TextInput
                                                placeholder="10:00"
                                                placeholderTextColor="#94a3b8"
                                                value={formData.startTime}
                                                onChangeText={(t) => setFormData({ ...formData, startTime: t })}
                                                style={{ flex: 1, color: colors.primary, fontWeight: "600", fontSize: 14 }}
                                            />
                                        </View>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text className="text-secondary/60 text-[10px] font-semibold mb-1 ml-1">Fine</Text>
                                        <View className="bg-white p-3.5 rounded-2xl shadow-sm border border-primary/5 flex-row items-center">
                                            <Clock size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                                            <TextInput
                                                placeholder="12:00"
                                                placeholderTextColor="#94a3b8"
                                                value={formData.endTime}
                                                onChangeText={(t) => setFormData({ ...formData, endTime: t })}
                                                style={{ flex: 1, color: colors.primary, fontWeight: "600", fontSize: 14 }}
                                            />
                                        </View>
                                    </View>
                                </View>

                                <View>
                                    <Text className="text-secondary/60 text-[10px] font-semibold mb-1 ml-1">Indirizzo</Text>
                                    <AddressAutocomplete
                                        initialValue={formData.address}
                                        onSelect={(addr, lat, lng) => {
                                            setFormData({ ...formData, address: addr, lat, lng });
                                            setCoordsConfirmed(true);
                                        }}
                                        onChangeText={() => setCoordsConfirmed(false)}
                                        placeholder="Scrivi qui l'indirizzo..."
                                    />
                                    {formData.address !== "" && (
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 4 }}>
                                            {coordsConfirmed ? (
                                                <>
                                                    <CheckCircle2 size={14} color="#22c55e" />
                                                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#22c55e" }}>Posizione confermata</Text>
                                                </>
                                            ) : (
                                                <>
                                                    <AlertCircle size={14} color="#f59e0b" />
                                                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#f59e0b" }}>
                                                        {mode === "edit"
                                                            ? "Da confermare — non blocca il salvataggio in modifica"
                                                            : "Seleziona un suggerimento per confermare le coordinate"}
                                                    </Text>
                                                </>
                                            )}
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Sezione 3: contenuto — descrizione (con AI) + posti disponibili */}
                            <View className="gap-3">
                                <View className="flex-row items-center justify-between">
                                    <Text className="text-primary font-black text-base">Descrizione</Text>
                                    <TouchableOpacity
                                        onPress={() => applyCuratedDraft("button")}
                                        disabled={isCuratingDraft}
                                        className={`px-3 py-1.5 rounded-full border flex-row items-center gap-1.5 ${isCuratingDraft ? "bg-slate-100 border-slate-200" : "bg-white border-primary/10"}`}
                                    >
                                        <Sparkles size={13} color={isCuratingDraft ? "#94a3b8" : colors.primary} />
                                        <Text className={`font-bold text-[11px] ${isCuratingDraft ? "text-slate-400" : "text-primary"}`}>
                                            {isCuratingDraft ? "Gemma al lavoro..." : "Migliora con AI"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <View className="bg-white p-4 rounded-2xl shadow-sm border border-primary/5">
                                    <TextInput
                                        placeholder="Descrivi l'attività, i requisiti e l'impatto..."
                                        multiline
                                        numberOfLines={4}
                                        textAlignVertical="top"
                                        value={formData.description}
                                        onChangeText={(t) => setFormData({ ...formData, description: t })}
                                        className="text-primary font-medium text-base min-h-[90px]"
                                    />
                                </View>
                            </View>

                            {/* Sezione 4: competenze, opzionale — chip più piccole, peso visivo minore della categoria */}
                            <View className="gap-3">
                                <Text className="text-secondary/70 font-bold uppercase tracking-widest text-[10px]">Competenze richieste (opzionale)</Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {SKILLS.map((skill) => {
                                        const isSelected = formData.skills.includes(skill.id);
                                        const SkillIcon = skill.icon;
                                        return (
                                            <TouchableOpacity
                                                key={skill.id}
                                                onPress={() =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        skills: isSelected ? prev.skills.filter((id) => id !== skill.id) : [...prev.skills, skill.id],
                                                    }))
                                                }
                                                className={`flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-xl border ${isSelected ? "bg-primary border-primary" : "bg-white border-primary/10"}`}
                                            >
                                                <SkillIcon size={12} color={isSelected ? "white" : colors.primary} />
                                                <Text className={`font-bold text-[11px] ${isSelected ? "text-white" : "text-primary"}`}>{skill.label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Sezione 5: altre opzioni — ricorrenza + urgente, raggruppate in un unico blocco a bassa priorità visiva */}
                            <View className="bg-white/60 p-4 rounded-2xl border border-primary/5 gap-4">
                                <Text className="text-secondary/70 font-bold uppercase tracking-widest text-[10px]">Altre opzioni</Text>

                                <View className="gap-1.5">
                                    <Text className="text-secondary text-xs font-semibold">Questa attività si ripete?</Text>
                                    <TouchableOpacity
                                        onPress={() => setShowRecurrencePicker(true)}
                                        activeOpacity={0.8}
                                        className="bg-white p-3.5 rounded-2xl border border-primary/10 flex-row items-center justify-between"
                                    >
                                        <Text className="text-primary font-bold text-sm">{RECURRENCE_LABELS[formData.recurrence]}</Text>
                                        <ChevronDown size={18} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>

                                <View className="flex-row items-center justify-between pt-3 border-t border-primary/5">
                                    <View className="flex-1 pr-3">
                                        <Text className="text-secondary text-xs font-semibold">Segnala come urgente</Text>
                                        <Text className="text-secondary/70 text-[10px] mt-0.5">Priorità nel match, max 3 attive.</Text>
                                    </View>
                                    <Switch
                                        value={formData.isUrgent}
                                        onValueChange={(v) => {
                                            if (v && !canEnableUrgent()) {
                                                showToast("error", "Puoi avere al massimo 3 attività urgenti contemporaneamente.");
                                                return;
                                            }
                                            setFormData({ ...formData, isUrgent: v });
                                        }}
                                        trackColor={{ false: "#e2e8f0", true: colors.accent }}
                                    />
                                </View>
                            </View>

                            {mode === "edit" && onDelete && (
                                <TouchableOpacity onPress={onDelete} disabled={isSubmitting} className="mt-2 items-center active:opacity-50">
                                    <View className="flex-row items-center gap-2">
                                        <Trash2 size={14} color="#EF4444" />
                                        <Text className="text-red-500 font-bold text-sm underline">Elimina questa attività</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    </StandardLayout>
                </ScrollView>

                {/* Footer CTA sticky — identico per create ed edit. Dimensioni esatte da handoff design
                    ActivityForm.tsx §4: contenitore 14/20/28px, bottone altezza fissa 56px, radius 20px. */}
                <View
                    style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        backgroundColor: "rgba(248,249,251,0.97)",
                        borderTopWidth: 1, borderTopColor: "rgba(70,34,130,0.06)",
                        paddingTop: 14, paddingHorizontal: 20, paddingBottom: 28,
                    }}
                >
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                        activeOpacity={0.9}
                        style={{
                            height: 56, borderRadius: 20, alignSelf: "stretch",
                            backgroundColor: colors.accent,
                            shadowColor: colors.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
                            alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
                        }}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <View className="flex-row items-center gap-3">
                                <Text className="text-white font-black text-lg">{submitLabel}</Text>
                                <ArrowRight size={20} color="white" />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            <CalendarPicker
                visible={showCalendar}
                value={formData.date}
                onSelect={(d) => setFormData((prev) => ({ ...prev, date: d }))}
                onClose={() => setShowCalendar(false)}
            />

            <Modal visible={showRecurrencePicker} animationType="slide" transparent onRequestClose={() => setShowRecurrencePicker(false)}>
                <TouchableOpacity
                    style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}
                    activeOpacity={1}
                    onPress={() => setShowRecurrencePicker(false)}
                >
                    <View style={{ backgroundColor: "white", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Platform.OS === "ios" ? 40 : 28 }}>
                        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
                            <Text style={{ fontSize: 18, fontWeight: "900", color: colors.primary }}>Ricorrenza</Text>
                            <Text style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Scegli se e con che frequenza si ripete l&apos;attività.</Text>
                        </View>
                        {RECURRENCE_OPTIONS.map((opt) => {
                            const selected = formData.recurrence === opt.value;
                            return (
                                <TouchableOpacity
                                    key={opt.value}
                                    onPress={() => {
                                        setFormData((prev) => ({ ...prev, recurrence: opt.value }));
                                        setShowRecurrencePicker(false);
                                    }}
                                    style={{
                                        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                                        paddingHorizontal: 20, paddingVertical: 16,
                                        borderBottomWidth: 1, borderBottomColor: "#f8fafc",
                                    }}
                                >
                                    <View>
                                        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.primary }}>{opt.label}</Text>
                                        <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{opt.description}</Text>
                                    </View>
                                    {selected && <Check size={20} color={colors.primary} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
}
