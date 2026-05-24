import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, KeyboardAvoidingView, Platform } from "react-native";
import { useState, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Calendar, Users, Send, Clock, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react-native";
import { StandardLayout } from "../../components/StandardLayout";
import { AddressAutocomplete } from "../../components/AddressAutocomplete";
import { CalendarPicker } from "../../components/CalendarPicker";
import { SKILLS } from "../../constants/Skills";
import { ACTIVITY_CATEGORIES } from "../../constants/Interests";
import { gemmaService } from "../../services/GemmaService";
import { requestMediaLibraryPermission } from "../../utils/permissions";
import { useCreateActivityMutation } from "../../hooks/activities/mutations";
import { useActivitiesListQuery } from "../../hooks/activities/queries";
import { colors } from "@/theme";

export default function CreateActivityScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useAuth();
    const { data: activities = [] } = useActivitiesListQuery(user?.id);
    const createActivityMutation = useCreateActivityMutation();
    const [formData, setFormData] = useState({
        title: "",
        category: "Sociale",
        address: "",
        lat: 45.464,
        lng: 9.190,
        date: "", // Empty by default — user must choose
        slots: "10",
        description: "",
        startTime: "10:00",
        endTime: "12:00",
        isUrgent: false,
        skills: [] as string[],
        imageUrl: undefined as string | undefined,
        recurrence: 'NONE' as 'NONE' | 'WEEKLY' | 'MONTHLY',
    });

    useEffect(() => {
        if (params.duplicate) {
            const original = activities.find(a => a.id === params.duplicate);
            if (original) {
                setFormData(prev => ({
                    ...prev,
                    title: params.recurrence === 'true' ? `${original.title} (Ricorrente)` : original.title,
                    category: original.category,
                    address: original.location.address,
                    lat: original.location.coords.lat,
                    lng: original.location.coords.lng,
                    slots: original.slots.toString(),
                    description: original.description || "",
                    skills: original.skills,
                    imageUrl: original.imageUrl
                }));
                setCoordsConfirmed(true);
            }
        } else if (params.ai_draft === 'true') {
            // AI Draft Logic: Look for successful past activities (similarity > 0.8 simplified as filled/completed)
            const successful = activities
                .filter(a => a.npoId === user?.id && (a.status === 'COMPLETATA' || a.iscritti.length >= a.slots))
                .sort((a, b) => b.iscritti.length - a.iscritti.length);

            if (successful.length > 0) {
                const best = successful[0];
                setFormData(prev => ({
                    ...prev,
                    title: `${best.category} Live: ${best.title}`,
                    category: best.category,
                    description: `Visto il grande successo della nostra ultima attività di ${best.category.toLowerCase()}, torniamo con una nuova data! \n\n${best.description}`,
                    skills: best.skills,
                    slots: best.slots.toString(),
                    address: best.location.address,
                    lat: best.location.coords.lat,
                    lng: best.location.coords.lng,
                }));
                setCoordsConfirmed(true);
            } else {
                // Fallback generic AI suggestion
                setFormData(prev => ({
                    ...prev,
                    title: "Nuova Iniziativa Solidale",
                    description: "Stiamo pianificando la nostra prossima grande attività. Unisciti a noi per fare la differenza!"
                }));
            }
        }
    }, [params.duplicate, params.ai_draft, params.recurrence, activities, user]);

    const urgentCount = activities.filter(a => a.npoId === user?.id && a.isUrgent && (a.status === 'APERTA' || a.status === 'IN_CORSO')).length;
    const [coordsConfirmed, setCoordsConfirmed] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const [isCuratingDraft, setIsCuratingDraft] = useState(false);
    const [hasAutoCuratedDraft, setHasAutoCuratedDraft] = useState(false);
    const { showToast } = useToast();

    const applyCuratedDraft = async (source: "button" | "auto") => {
        if (!formData.title.trim()) {
            showToast('error', 'Inserisci almeno un titolo prima di usare l\'AI.');
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

            if (source === 'auto') {
                setHasAutoCuratedDraft(true);
            }

            showToast('success', source === 'auto' ? 'Bozza AI aggiornata.' : 'Descrizione migliorata con AI.');
        } catch (error) {
            console.error('[CreateActivity] activity-curator-ai failed', error);
            if (source === 'auto') {
                setHasAutoCuratedDraft(true);
            }
            showToast('error', 'Non sono riuscita a generare una bozza AI. Riprova tra poco.');
        } finally {
            setIsCuratingDraft(false);
        }
    };

    useEffect(() => {
        if (params.ai_draft !== 'true' || !formData.title.trim() || isCuratingDraft || hasAutoCuratedDraft) {
            return;
        }

        applyCuratedDraft('auto');
        // We only want one automatic AI refinement after the ai_draft bootstrap.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.ai_draft, formData.title, hasAutoCuratedDraft, isCuratingDraft]);

    const pickImage = async () => {
        const granted = await requestMediaLibraryPermission({
            title: "Accesso alla galleria",
            message: "AiutarSi ti chiede l'accesso alla galleria per aggiungere un'immagine all'attivita.",
            settingsLabel: "la galleria",
        });
        if (!granted) {
            showToast('error', 'Permesso galleria necessario per aggiungere una foto.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.7,
        });

        if (!result.canceled) {
            setFormData(prev => ({ ...prev, imageUrl: result.assets[0].uri }));
        }
    };

    const handleCreate = async () => {
        if (!formData.title || !formData.address || !formData.description || !formData.endTime || !formData.date) {
            showToast('error', 'Compila tutti i campi obbligatori, inclusa la data e l\'orario di fine.');
            return;
        }

        if (!coordsConfirmed) {
            showToast('error', 'Seleziona un indirizzo dalla lista dei suggerimenti.');
            return;
        }

        const start = new Date(`${formData.date}T${formData.startTime}:00`);
        const end = new Date(`${formData.date}T${formData.endTime}:00`);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            showToast('error', 'Data o orario non validi. Controlla i campi.');
            return;
        }

        const startISO = start.toISOString();
        const endISO = end.toISOString();

        const now = new Date();

        if (start < now) {
            showToast('error', 'Non puoi creare un\'attività nel passato. Scegli data e orario futuri.');
            return;
        }

        if (end <= start) {
            showToast('error', 'L\'orario di fine deve essere successivo all\'orario di inizio.');
            return;
        }

        if (!user || user.role !== "NPO") {
            showToast('error', 'Profilo ente non valido per creare attività.');
            return;
        }

        try {
            await createActivityMutation.mutateAsync({
                npoId: user.id,
                npoName: user.npoName || "Ente Solidale",
                title: formData.title,
                category: formData.category,
                location: {
                    coords: { lat: formData.lat, lng: formData.lng },
                    address: formData.address
                },
                slots: parseInt(formData.slots, 10),
                description: formData.description,
                dateTime: startISO,
                endDateTime: endISO,
                skills: formData.skills,
                status: "APERTA",
                iscritti: [],
                isUrgent: formData.isUrgent,
                imageUrl: formData.imageUrl,
                recurrence: formData.recurrence === 'NONE' ? undefined : formData.recurrence,
            });
            router.replace("/(npo)" as any);
        } catch {
            showToast('error', 'Non sono riuscita a creare l’attività. Riprova.');
        }
    };

    return (
        <>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ flexGrow: 1 }}
                >
                    <StandardLayout
                        label="Inizia ora"
                        title="Crea Attività"
                        bg="bg-background-light"
                        onBack={() => router.back()}
                        noScroll
                    >
                        <View className="gap-6 pb-12">
                            {/* OldActivity Image */}
                            <View>
                                <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Foto Attività</Text>
                                <TouchableOpacity
                                    onPress={pickImage}
                                    activeOpacity={0.8}
                                    className="w-full h-48 bg-white rounded-[28px] border border-primary/5 shadow-sm overflow-hidden items-center justify-center"
                                >
                                    {formData.imageUrl ? (
                                        <Image
                                            source={{ uri: formData.imageUrl }}
                                            style={{ width: "100%", height: "100%" }}
                                            contentFit="cover"
                                        />
                                    ) : (
                                        <View className="items-center">
                                            <View className="bg-primary/5 p-4 rounded-3xl mb-2">
                                                <RefreshCw size={32} color={colors.primary} />
                                            </View>
                                            <Text className="text-primary/40 font-bold text-sm">Carica una foto per l&apos;attività</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Title */}
                            <View>
                                <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Titolo Attività</Text>
                                <View className="bg-white p-4 rounded-2xl shadow-sm border border-primary/5 flex-row items-center">
                                    <TextInput
                                        placeholder="es. Distribuzione Pasti"
                                        value={formData.title}
                                        onChangeText={(t) => setFormData({ ...formData, title: t })}
                                        className="flex-1 text-primary font-medium text-base"
                                    />
                                </View>
                            </View>

                            {/* Category */}
                            <View>
                                <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Categoria</Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {ACTIVITY_CATEGORIES.map(cat => (
                                        <TouchableOpacity
                                            key={cat}
                                            onPress={() => setFormData({ ...formData, category: cat })}
                                            className={`px-4 py-2 rounded-full border ${formData.category === cat ? "bg-primary border-primary" : "bg-white border-primary/10"}`}
                                        >
                                            <Text className={`font-bold text-xs ${formData.category === cat ? "text-white" : "text-primary"}`}>{cat}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Skills Selection */}
                            <View>
                                <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Competenze Richieste (Opzionale)</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {SKILLS.map((skill) => {
                                        const isSelected = formData.skills.includes(skill.id);
                                        const SkillIcon = skill.icon;
                                        return (
                                            <TouchableOpacity
                                                key={skill.id}
                                                onPress={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        skills: isSelected
                                                            ? prev.skills.filter(id => id !== skill.id)
                                                            : [...prev.skills, skill.id]
                                                    }));
                                                }}
                                                style={{
                                                    width: '30.5%',
                                                    paddingVertical: 10,
                                                    paddingHorizontal: 4,
                                                    borderRadius: 14,
                                                    borderWidth: 1,
                                                    alignItems: 'center',
                                                    flexDirection: 'row',
                                                    justifyContent: 'center',
                                                    gap: 4,
                                                    backgroundColor: isSelected ? colors.primary : 'white',
                                                    borderColor: isSelected ? colors.primary : '#ede9fe',
                                                }}
                                            >
                                                <SkillIcon size={11} color={isSelected ? 'white' : colors.primary} />
                                                <Text style={{ fontWeight: '800', fontSize: 10, color: isSelected ? 'white' : colors.primary }}>{skill.label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Location */}
                            <View>
                                <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Indirizzo / Luogo</Text>
                                <AddressAutocomplete
                                    onSelect={(addr, lat, lng) => {
                                        setFormData({ ...formData, address: addr, lat, lng });
                                        setCoordsConfirmed(true);
                                    }}
                                    onChangeText={() => setCoordsConfirmed(false)}
                                    placeholder="Scrivi qui l'indirizzo..."
                                />
                                {/* Coordinate status badge */}
                                {formData.address !== '' && (
                                    <View style={{
                                        flexDirection: 'row', alignItems: 'center', gap: 6,
                                        marginTop: 8, paddingHorizontal: 4,
                                    }}>
                                        {coordsConfirmed ? (
                                            <>
                                                <CheckCircle2 size={14} color="#22c55e" />
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#22c55e' }}>Posizione confermata</Text>
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle size={14} color="#f59e0b" />
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#f59e0b' }}>Seleziona un suggerimento per confermare le coordinate</Text>
                                            </>
                                        )}
                                    </View>
                                )}
                            </View>

                            {/* Date + Slots row */}
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                {/* Date – tap to open calendar */}
                                <View style={{ flex: 1.7 }}>
                                    <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Data</Text>
                                    <TouchableOpacity
                                        onPress={() => setShowCalendar(true)}
                                        activeOpacity={0.8}
                                        style={{
                                            backgroundColor: 'white', padding: 16, borderRadius: 16,
                                            flexDirection: 'row', alignItems: 'center', gap: 10,
                                            borderWidth: 1, borderColor: formData.date ? colors.primary + '40' : '#ede9fe',
                                            shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
                                        }}
                                    >
                                        <Calendar size={18} color={formData.date ? colors.primary : colors.textSecondary} />
                                        <Text style={{
                                            flex: 1, fontSize: 14, fontWeight: '600',
                                            color: formData.date ? colors.primary : '#94a3b8',
                                        }}>
                                            {formData.date
                                                ? new Date(formData.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })
                                                : 'Scegli data'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                {/* Slots */}
                                <View style={{ flex: 1 }}>
                                    <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">N. Volontari</Text>
                                    <View className="bg-white p-4 rounded-2xl shadow-sm border border-primary/5 flex-row items-center">
                                        <Users size={18} color={colors.textSecondary} style={{ marginRight: 6 }} />
                                        <TextInput
                                            placeholder="10"
                                            placeholderTextColor="#94a3b8"
                                            keyboardType="number-pad"
                                            maxLength={3}
                                            value={formData.slots}
                                            onChangeText={(t) => setFormData({ ...formData, slots: t })}
                                            style={{ flex: 1, color: colors.primary, fontWeight: '700', fontSize: 16 }}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Time - aligned to page margins */}
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Inizio</Text>
                                    <View className="bg-white p-4 rounded-2xl shadow-sm border border-primary/5 flex-row items-center">
                                        <Clock size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                                        <TextInput
                                            placeholder="10:00"
                                            placeholderTextColor="#94a3b8"
                                            value={formData.startTime}
                                            onChangeText={(t) => setFormData({ ...formData, startTime: t })}
                                            style={{ flex: 1, color: colors.primary, fontWeight: '500', fontSize: 14 }}
                                        />
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Fine</Text>
                                    <View className="bg-white p-4 rounded-2xl shadow-sm border border-primary/5 flex-row items-center">
                                        <Clock size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                                        <TextInput
                                            placeholder="12:00"
                                            placeholderTextColor="#94a3b8"
                                            value={formData.endTime}
                                            onChangeText={(t) => setFormData({ ...formData, endTime: t })}
                                            style={{ flex: 1, color: colors.primary, fontWeight: '500', fontSize: 14 }}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Recurrence */}
                            <View className="bg-white p-5 rounded-2xl border border-primary/5">
                                <View className="flex-row items-center gap-3 mb-3">
                                    <View className="bg-indigo-50 p-2 rounded-xl">
                                        <RefreshCw size={18} color="#6366f1" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="font-bold text-primary">Ricorrenza</Text>
                                        <Text className="text-secondary text-[10px]">Il badge appare sulla scheda attività.</Text>
                                    </View>
                                </View>
                                <View className="flex-row gap-2">
                                    {(['NONE', 'WEEKLY', 'MONTHLY'] as const).map((opt) => (
                                        <TouchableOpacity
                                            key={opt}
                                            onPress={() => setFormData(prev => ({ ...prev, recurrence: opt }))}
                                            className={`flex-1 py-2.5 rounded-xl border items-center ${formData.recurrence === opt ? 'bg-primary border-primary' : 'bg-white border-primary/10'
                                                }`}
                                        >
                                            <Text className={`font-bold text-xs ${formData.recurrence === opt ? 'text-white' : 'text-primary'
                                                }`}>
                                                {opt === 'NONE' ? 'Nessuna' : opt === 'WEEKLY' ? 'Sett.' : 'Mens.'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Slots section removed — merged into Date+Slots row above */}

                            {/* Description */}
                            <View>
                                <View className="flex-row items-center justify-between mb-2">
                                    <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] ml-1">Descrizione</Text>
                                    <TouchableOpacity
                                        onPress={() => applyCuratedDraft('button')}
                                        disabled={isCuratingDraft}
                                        className={`px-3 py-2 rounded-full border flex-row items-center gap-2 ${isCuratingDraft ? 'bg-slate-100 border-slate-200' : 'bg-white border-primary/10'}`}
                                    >
                                        <RefreshCw size={14} color={isCuratingDraft ? '#94a3b8' : colors.primary} />
                                        <Text className={`font-bold text-[11px] ${isCuratingDraft ? 'text-slate-400' : 'text-primary'}`}>
                                            {isCuratingDraft ? 'Gemma al lavoro...' : 'Migliora con AI'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <View className="bg-white p-5 rounded-[28px] shadow-sm border border-primary/5">
                                    <TextInput
                                        placeholder="Descrivi l'attività, i requisiti e l'impatto..."
                                        multiline
                                        numberOfLines={5}
                                        textAlignVertical="top"
                                        value={formData.description}
                                        onChangeText={(t) => setFormData({ ...formData, description: t })}
                                        className="text-primary font-medium text-base min-h-[100px]"
                                    />
                                </View>
                            </View>


                            {/* Urgent Toggle */}
                            <View className="flex-row items-center justify-between bg-white p-5 rounded-2xl border border-primary/5">
                                <View className="flex-row items-center gap-3">
                                    <View className="bg-red-50 p-2 rounded-xl">
                                        <Send size={20} color="#ef4444" />
                                    </View>
                                    <View>
                                        <Text className="font-bold text-primary">Segnala come Urgente</Text>
                                        <Text className="text-secondary text-[10px]">L&apos;attività avrà priorità nel match.</Text>
                                    </View>
                                </View>
                                <Switch
                                    value={formData.isUrgent}
                                    onValueChange={(v) => {
                                        if (v && urgentCount >= 3) {
                                            showToast('error', "Puoi avere al massimo 3 attività urgenti contemporaneamente.");
                                            return;
                                        }
                                        setFormData({ ...formData, isUrgent: v });
                                    }}
                                    trackColor={{ false: "#e2e8f0", true: colors.accent }}
                                />
                            </View>

                            <TouchableOpacity
                                onPress={handleCreate}
                                className="bg-accent py-5 rounded-[24px] shadow-xl shadow-accent/40 items-center justify-center flex-row gap-3 mt-4"
                            >
                                <Text className="text-white font-black text-lg">Pubblica Attività</Text>
                                <Send size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </StandardLayout>
                </ScrollView>
            </KeyboardAvoidingView>
            <CalendarPicker
                visible={showCalendar}
                value={formData.date}
                onSelect={(d) => setFormData(prev => ({ ...prev, date: d }))}
                onClose={() => setShowCalendar(false)}
            />
        </>
    );
}
