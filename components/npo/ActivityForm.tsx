import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Calendar, Users, ArrowRight, Clock, CheckCircle2, AlertCircle, RefreshCw, Trash2, ChevronDown, Check, Camera, Sparkles, Zap, ChevronUp } from "lucide-react-native";
import { StandardLayout } from "../StandardLayout";
import { AddressAutocomplete } from "../AddressAutocomplete";
import { CalendarPicker } from "../CalendarPicker";
import { TimePicker } from "../TimePicker";
import { SelectableChip } from "../ui/SelectableChip";
import { SKILLS } from "../../constants/Skills";
import { ACTIVITY_CATEGORIES } from "../../constants/Interests";
import { gemmaService } from "../../services/GemmaService";
import { requestMediaLibraryPermission } from "../../utils/permissions";
import { useToast } from "../../context/ToastContext";
import { colors } from "@/theme";
import { getInitialCoordsConfirmed, isEndBeforeOrEqualStart, shouldAutoCurateDraft, validateActivityFormSubmit } from "./activityFormLogic";

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

// Unica convenzione tipografica per le etichette di campo (Titolo/Categoria/Data/Volontari/
// Inizio/Fine/Indirizzo) — prima coesistevano due stili diversi per lo stesso livello gerarchico
// (uppercase+tracking vs minuscolo) con colore a opacità ridotta (/60, /70) su testo 10px, a rischio
// di contrasto WCAG AA. Vedi docs/design/activity-form-design-critique.md, raccomandazione #1.
const FIELD_LABEL_CLASS = "text-secondary font-bold uppercase tracking-wide text-[11px] mb-2 ml-1";
// Variante per intestazioni di gruppo (Competenze, Altre opzioni) già dentro un contenitore con gap:
// stesso colore/peso/dimensione del token sopra, senza margine proprio per non raddoppiare lo spazio.
const GROUP_LABEL_CLASS = "text-secondary font-bold uppercase tracking-wide text-[11px]";
// Bordo/ombra card campo unificati: prima Data/Volontari usavano uno style inline con bordo
// letterale (#ede9fe) e ombra manuale, diverso da tutte le altre card che usano la classe NativeWind
// "shadow-sm border border-primary/5". Raccomandazione #4 (consistency) del critique.
const FIELD_CARD_BORDER_INACTIVE = "rgba(70, 34, 130, 0.05)"; // equivalente a border-primary/5
const SKILLS_COLLAPSED_COUNT = 6;

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
    onCancelActivity?: () => void;
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
    onCancelActivity,
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
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);
    const [isCuratingDraft, setIsCuratingDraft] = useState(false);
    const [hasAutoCuratedDraft, setHasAutoCuratedDraft] = useState(false);
    // Trasparenza verso l'utente quando la descrizione è stata scritta/riscritta dall'AI (pulsante
    // "Migliora con AI" o rifinitura automatica silenziosa da "Rilancia con AI") — si azzera appena
    // l'utente modifica il testo a mano, perché a quel punto non è più "solo" testo generato.
    // Vedi docs/design/activity-form-design-critique.md, raccomandazione (Usability, AI feedback).
    const [aiGeneratedDescription, setAiGeneratedDescription] = useState(false);
    const [skillsExpanded, setSkillsExpanded] = useState(false);

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
        setAiGeneratedDescription(false);
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
            if (curated.expandedDescription) {
                setAiGeneratedDescription(true);
            }
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
                {/* paddingBottom qui è solo il margine oltre a quanto StandardLayout aggiunge già di suo
                    (bottomInset, safe-area + spacing) sulla View interna: la somma deve bastare per liberare
                    il footer CTA sticky (~98px), non sommarsi a un altro valore già capiente da solo. */}
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: 48 }}>
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
                                    <Text className={FIELD_LABEL_CLASS}>Titolo attività</Text>
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
                                    <Text className={FIELD_LABEL_CLASS}>Categoria</Text>
                                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                                        {ACTIVITY_CATEGORIES.map((cat) => (
                                            <SelectableChip
                                                key={cat}
                                                variant="category"
                                                label={cat}
                                                selected={formData.category === cat}
                                                onPress={() => setFormData({ ...formData, category: cat })}
                                            />
                                        ))}
                                    </View>
                                </View>
                            </View>

                            {/* Sezione 2: logistica */}
                            <View className="gap-3">
                                <Text className="text-primary font-black text-base">Quando e dove</Text>

                                <View style={{ flexDirection: "row", gap: 8 }}>
                                    <View style={{ flex: 1.7 }}>
                                        <Text className={FIELD_LABEL_CLASS}>Data</Text>
                                        <TouchableOpacity
                                            onPress={() => setShowCalendar(true)}
                                            activeOpacity={0.8}
                                            className="bg-white rounded-2xl shadow-sm"
                                            style={{
                                                padding: 14,
                                                flexDirection: "row", alignItems: "center", gap: 10,
                                                borderWidth: 1, borderColor: formData.date ? colors.primary + "40" : FIELD_CARD_BORDER_INACTIVE,
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
                                        <Text className={FIELD_LABEL_CLASS}>Volontari</Text>
                                        <View
                                            className="bg-white rounded-2xl shadow-sm border border-primary/5"
                                            style={{
                                                paddingHorizontal: 12, height: 48,
                                                flexDirection: "row", alignItems: "center", gap: 8,
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
                                        <Text className={FIELD_LABEL_CLASS}>Inizio</Text>
                                        <TouchableOpacity
                                            onPress={() => setShowStartTimePicker(true)}
                                            activeOpacity={0.8}
                                            className="bg-white p-3.5 rounded-2xl shadow-sm border border-primary/5 flex-row items-center"
                                        >
                                            <Clock size={16} color={formData.startTime ? colors.primary : colors.textSecondary} style={{ marginRight: 8 }} />
                                            <Text style={{ flex: 1, color: formData.startTime ? colors.primary : "#94a3b8", fontWeight: "600", fontSize: 14 }}>
                                                {formData.startTime || "10:00"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text className={FIELD_LABEL_CLASS}>Fine</Text>
                                        <TouchableOpacity
                                            onPress={() => setShowEndTimePicker(true)}
                                            activeOpacity={0.8}
                                            className="bg-white p-3.5 rounded-2xl shadow-sm border border-primary/5 flex-row items-center"
                                        >
                                            <Clock size={16} color={formData.endTime ? colors.primary : colors.textSecondary} style={{ marginRight: 8 }} />
                                            <Text style={{ flex: 1, color: formData.endTime ? colors.primary : "#94a3b8", fontWeight: "600", fontSize: 14 }}>
                                                {formData.endTime || "12:00"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                {!!(formData.date && formData.startTime && formData.endTime) &&
                                    isEndBeforeOrEqualStart(formData.date, formData.startTime, formData.endTime) && (
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 }}>
                                            <AlertCircle size={14} color="#f59e0b" />
                                            <Text style={{ fontSize: 12, fontWeight: "600", color: "#f59e0b" }}>
                                                L&apos;orario di fine deve essere successivo a quello di inizio
                                            </Text>
                                        </View>
                                    )}

                                <View>
                                    <Text className={FIELD_LABEL_CLASS}>Indirizzo</Text>
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
                                        onChangeText={(t) => {
                                            // Modificare a mano il testo invalida il badge "generato con AI": non è più
                                            // solo testo dell'AI, quindi non va più presentato come tale.
                                            if (aiGeneratedDescription) setAiGeneratedDescription(false);
                                            setFormData({ ...formData, description: t });
                                        }}
                                        className="text-primary font-medium text-base min-h-[90px]"
                                    />
                                </View>
                                {aiGeneratedDescription && (
                                    <View className="flex-row items-center gap-1.5 ml-1">
                                        <Sparkles size={12} color={colors.primary} />
                                        <Text className="text-primary/70 font-semibold text-[11px]">Testo generato con AI</Text>
                                    </View>
                                )}
                            </View>

                            {/* Sezione 4: competenze, opzionale — chip più piccole, peso visivo minore della categoria.
                                Mostra solo le prime SKILLS_COLLAPSED_COUNT + qualunque competenza già selezionata oltre
                                quella soglia (così aprendo il form in modifica non "sparisce" mai una scelta esistente),
                                con un link per espandere — evita 4-5 righe di chip sempre visibili (critique raccomandazione,
                                Usability: densità competenze). */}
                            <View className="gap-3">
                                <Text className={GROUP_LABEL_CLASS}>Competenze richieste (opzionale)</Text>
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                                    {(skillsExpanded
                                        ? SKILLS
                                        : SKILLS.filter((skill, idx) => idx < SKILLS_COLLAPSED_COUNT || formData.skills.includes(skill.id))
                                    ).map((skill) => {
                                        const isSelected = formData.skills.includes(skill.id);
                                        return (
                                            <SelectableChip
                                                key={skill.id}
                                                variant="skill"
                                                label={skill.label}
                                                emoji={skill.emoji}
                                                selected={isSelected}
                                                onPress={() =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        skills: isSelected ? prev.skills.filter((id) => id !== skill.id) : [...prev.skills, skill.id],
                                                    }))
                                                }
                                            />
                                        );
                                    })}
                                </View>
                                {SKILLS.length > SKILLS_COLLAPSED_COUNT && (
                                    <TouchableOpacity
                                        onPress={() => setSkillsExpanded((v) => !v)}
                                        activeOpacity={0.7}
                                        className="flex-row items-center gap-1 self-start"
                                    >
                                        <Text className="text-primary font-bold text-xs">
                                            {skillsExpanded ? "Mostra meno" : `Mostra altre ${SKILLS.length - SKILLS_COLLAPSED_COUNT} competenze`}
                                        </Text>
                                        {skillsExpanded ? (
                                            <ChevronUp size={14} color={colors.primary} />
                                        ) : (
                                            <ChevronDown size={14} color={colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* "Segnala come urgente" ha impatto diretto sul matching con i volontari — merita una
                                card propria con accento visivo quando attivo, non lo stesso peso di "Ricorrenza"
                                (critique raccomandazione #3, Visual Hierarchy). */}
                            <View
                                className="p-4 rounded-2xl gap-1"
                                style={{
                                    borderWidth: 1.5,
                                    borderColor: formData.isUrgent ? colors.accent : FIELD_CARD_BORDER_INACTIVE,
                                    backgroundColor: formData.isUrgent ? colors.accent + "0D" : "white",
                                }}
                            >
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-1 pr-3">
                                        <View className="flex-row items-center gap-1.5">
                                            <Zap size={14} color={formData.isUrgent ? colors.accent : colors.textSecondary} />
                                            <Text className="text-primary font-black text-sm">Segnala come urgente</Text>
                                        </View>
                                        <Text className="text-secondary text-[11px] mt-1">
                                            Priorità nel match con i volontari. Massimo 3 attività urgenti attive per ente.
                                        </Text>
                                    </View>
                                    {/* Contorno colorato attorno allo switch: senza, il toggle si perdeva contro lo
                                        sfondo chiaro della card (bianco/rosa pallido) in entrambi gli stati — segnalato
                                        dall'utente come "si vede poco". Bordo grigio più deciso da spento, accent da acceso. */}
                                    <View
                                        style={{
                                            borderWidth: 1.5,
                                            borderColor: formData.isUrgent ? colors.accent : colors.textSecondary + "66",
                                            borderRadius: 18,
                                            padding: 2,
                                        }}
                                    >
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
                                            thumbColor="#ffffff"
                                            ios_backgroundColor="#e2e8f0"
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Sezione 5: altre opzioni — solo ricorrenza, priorità visiva bassa (urgente ora ha una
                                card propria sopra, vedi nota) */}
                            <View className="bg-white/60 p-4 rounded-2xl border border-primary/5 gap-1.5">
                                <Text className={GROUP_LABEL_CLASS}>Altre opzioni</Text>
                                <Text className="text-secondary text-xs font-semibold mt-1.5">Questa attività si ripete?</Text>
                                <TouchableOpacity
                                    onPress={() => setShowRecurrencePicker(true)}
                                    activeOpacity={0.8}
                                    className="bg-white p-3.5 rounded-2xl border border-primary/10 flex-row items-center justify-between"
                                >
                                    <Text className="text-primary font-bold text-sm">{RECURRENCE_LABELS[formData.recurrence]}</Text>
                                    <ChevronDown size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            {mode === "edit" && onCancelActivity && (
                                <TouchableOpacity onPress={onCancelActivity} disabled={isSubmitting} className="mt-2 items-center active:opacity-50">
                                    <View className="flex-row items-center gap-2">
                                        <Trash2 size={14} color="#EF4444" />
                                        <Text className="text-red-500 font-bold text-sm underline">Annulla questa attività</Text>
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

            <TimePicker
                visible={showStartTimePicker}
                value={formData.startTime}
                label="Orario di inizio"
                onSelect={(t) => setFormData((prev) => ({ ...prev, startTime: t }))}
                onClose={() => setShowStartTimePicker(false)}
            />

            <TimePicker
                visible={showEndTimePicker}
                value={formData.endTime}
                label="Orario di fine"
                onSelect={(t) => setFormData((prev) => ({ ...prev, endTime: t }))}
                onClose={() => setShowEndTimePicker(false)}
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
