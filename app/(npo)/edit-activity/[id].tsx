import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, ActivityIndicator, Alert, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useActivities } from "../../../context/ActivityContext";
import { Colors } from "../../../constants/Colors";
import { Calendar, Users, Send, Clock, Camera, Trash2, RefreshCw } from "lucide-react-native";
import { StandardLayout } from "../../../components/StandardLayout";
import { AddressAutocomplete } from "../../../components/AddressAutocomplete";

import * as ImagePicker from 'expo-image-picker';
import { SKILLS } from "../../../constants/Skills";
import { requestMediaLibraryPermission } from "../../../utils/permissions";

export default function EditActivityScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { activities, updateActivity, deleteActivity } = useActivities();
    const [loading, setLoading] = useState(true);

    const [formData, setFormData] = useState({
        title: "",
        category: "Sociale",
        address: "",
        lat: 45.464,
        lng: 9.190,
        date: "",
        slots: "10",
        description: "",
        startTime: "10:00",
        endTime: "12:00",
        isUrgent: false,
        skills: [] as string[],
        imageUrl: "" as string | undefined,
        recurrence: 'NONE' as 'NONE' | 'WEEKLY' | 'MONTHLY',
    });

    useEffect(() => {
        const activity = activities.find((a: any) => a.id === id);
        if (activity) {
            setFormData({
                title: activity.title,
                category: activity.category,
                address: activity.location.address,
                lat: activity.location.coords.lat,
                lng: activity.location.coords.lng,
                date: activity.dateTime.split('T')[0],
                slots: activity.slots.toString(),
                description: activity.description,
                startTime: new Date(activity.dateTime).toLocaleTimeString("it-IT", { hour: '2-digit', minute: '2-digit' }),
                endTime: new Date(activity.endDateTime).toLocaleTimeString("it-IT", { hour: '2-digit', minute: '2-digit' }),
                isUrgent: activity.isUrgent || false,
                skills: activity.skills || [],
                imageUrl: activity.imageUrl,
                recurrence: (activity.recurrence as any) || 'NONE',
            });
            setLoading(false);
        }
    }, [id, activities]);

    const pickImage = async () => {
        const granted = await requestMediaLibraryPermission({
            title: "Accesso alla galleria",
            message: "AiutarSi ti chiede l'accesso alla galleria per aggiornare l'immagine dell'attivita.",
            settingsLabel: "la galleria",
        });
        if (!granted) {
            Alert.alert("Permesso negato", "Serve accesso alla galleria per caricare l'immagine dell'attivita.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });

        if (!result.canceled) {
            setFormData(prev => ({ ...prev, imageUrl: result.assets[0].uri }));
        }
    };

    const handleUpdate = async () => {
        if (!formData.title || !formData.address || !formData.description || !formData.endTime || !formData.date) {
            alert("Compila tutti i campi obbligatori.");
            return;
        }

        setLoading(true);
        const startISO = `${formData.date}T${formData.startTime}:00Z`;
        const endISO = `${formData.date}T${formData.endTime}:00Z`;

        const now = new Date();
        const start = new Date(startISO);
        const end = new Date(endISO);

        // Allow editing activities that already started, but don't let them move to the past if they are future
        const activity = activities.find(a => a.id === id);
        const wasInFuture = activity ? new Date(activity.dateTime) > now : true;

        if (wasInFuture && start < now) {
            alert("Non puoi spostare un'attività futura nel passato.");
            setLoading(false);
            return;
        }

        if (end <= start) {
            alert("L'orario di fine deve essere successivo all'orario di inizio.");
            setLoading(false);
            return;
        }

        const success = await updateActivity(id as string, {
            title: formData.title,
            category: formData.category,
            location: {
                coords: { lat: 45.464, lng: 9.190 },
                address: formData.address
            },
            slots: parseInt(formData.slots),
            description: formData.description,
            dateTime: startISO,
            endDateTime: endISO,
            skills: formData.skills,
            isUrgent: formData.isUrgent,
            imageUrl: formData.imageUrl,
            recurrence: formData.recurrence === 'NONE' ? undefined : formData.recurrence,
        });

        setLoading(false);

        if (success) {
            Alert.alert("Successo", "Attività aggiornata con successo! I volontari iscritti riceveranno una notifica.");
            router.back();
        }
    };

    const handleDelete = () => {
        Alert.alert(
            "Elimina Attività",
            "Sei sicuro di voler eliminare questa attività? Verrà spostata nello stato 'Cancellata' e i volontari iscritti riceveranno una notifica.",
            [
                { text: "Annulla", style: "cancel" },
                {
                    text: "Elimina",
                    style: "destructive",
                    onPress: async () => {
                        const success = await deleteActivity(id as string);
                        if (success) {
                            router.back();
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <StandardLayout title="Modifica" label="Caricamento...">
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </StandardLayout>
        );
    }

    return (
        <StandardLayout
            label="Gestione"
            title="Modifica Attività"
            bg="bg-background-light"
            onBack={() => router.back()}
            noScroll={true}
        >
            <View className="flex-1">
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 160 }}
                    className="flex-1"
                >
                    <View className="gap-6">
                        {/* Image Selection */}
                        <View>
                            <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Immagine di Copertina</Text>
                            <TouchableOpacity onPress={pickImage} className="active:scale-95 transition-transform">
                                <View className="bg-white rounded-[24px] overflow-hidden shadow-sm border border-primary/5 h-48 justify-center items-center relative">
                                    {formData.imageUrl ? (
                                        <View className="w-full h-full">
                                            <Image source={{ uri: formData.imageUrl }} className="w-full h-full" resizeMode="cover" />
                                            <View className="absolute inset-0 bg-black/30 justify-center items-center">
                                                <RefreshCw color="white" size={32} />
                                                <Text className="text-white font-bold mt-2">Cambia Foto</Text>
                                            </View>
                                        </View>
                                    ) : (
                                        <View className="items-center justify-center p-6">
                                            <View className="w-16 h-16 bg-primary/10 rounded-full items-center justify-center mb-3">
                                                <RefreshCw color={Colors.primary} size={32} />
                                            </View>
                                            <Text className="text-primary/60 font-medium">Tocca per caricare una foto</Text>
                                        </View>
                                    )}
                                </View>
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
                                {["Sociale", "Ambiente", "Istruzione", "Salute", "Animali"].map(cat => (
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
                            <View className="flex-row flex-wrap gap-2">
                                {SKILLS.map((skill) => {
                                    const isSelected = formData.skills.includes(skill.id);
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
                                            className={`px-4 py-2 rounded-full border ${isSelected ? "bg-primary border-primary" : "bg-white border-primary/10"}`}
                                        >
                                            <Text className={`font-bold text-xs ${isSelected ? "text-white" : "text-primary"}`}>{skill.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Location */}
                        <View>
                            <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Indirizzo / Luogo</Text>
                            {!loading && (
                                <AddressAutocomplete
                                    initialValue={formData.address}
                                    onSelect={(addr, lat, lng) => setFormData({ ...formData, address: addr, lat, lng })}
                                    placeholder="Cerca via, piazza o città..."
                                />
                            )}
                        </View>

                        {/* Date */}
                        <View>
                            <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Data Attività (AAAA-MM-GG)</Text>
                            <View className="bg-white p-4 rounded-2xl shadow-sm border border-primary/5 flex-row items-center">
                                <View className="mr-3">
                                    <Calendar size={20} color={Colors.secondary} />
                                </View>
                                <TextInput
                                    placeholder="2026-02-12"
                                    value={formData.date}
                                    onChangeText={(t) => setFormData({ ...formData, date: t })}
                                    className="flex-1 text-primary font-medium text-base"
                                />
                            </View>
                        </View>

                        {/* Time */}
                        <View className="flex-row gap-4">
                            <View className="flex-1">
                                <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Inizio</Text>
                                <View className="bg-white p-4 rounded-2xl shadow-sm border border-primary/5 flex-row items-center">
                                    <View className="mr-3">
                                        <Clock size={20} color={Colors.secondary} />
                                    </View>
                                    <TextInput
                                        placeholder="10:00"
                                        value={formData.startTime}
                                        onChangeText={(t) => setFormData({ ...formData, startTime: t })}
                                        className="flex-1 text-primary font-medium text-base"
                                    />
                                </View>
                            </View>
                            <View className="flex-1">
                                <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Fine</Text>
                                <View className="bg-white p-4 rounded-2xl shadow-sm border border-primary/5 flex-row items-center">
                                    <View className="mr-3">
                                        <Clock size={20} color={Colors.secondary} />
                                    </View>
                                    <TextInput
                                        placeholder="12:00"
                                        value={formData.endTime}
                                        onChangeText={(t) => setFormData({ ...formData, endTime: t })}
                                        className="flex-1 text-primary font-medium text-base"
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

                        {/* Slots */}
                        <View>
                            <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Volontari Necessari</Text>
                            <View className="bg-white p-4 rounded-2xl shadow-sm border border-primary/5 flex-row items-center">
                                <View className="mr-3">
                                    <Users size={20} color={Colors.secondary} />
                                </View>
                                <TextInput
                                    placeholder="10"
                                    keyboardType="number-pad"
                                    value={formData.slots}
                                    onChangeText={(t) => setFormData({ ...formData, slots: t })}
                                    className="flex-1 text-primary font-medium text-base"
                                />
                            </View>
                        </View>

                        {/* Description */}
                        <View>
                            <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Descrizione</Text>
                            <View className="bg-white p-5 rounded-[28px] shadow-sm border border-primary/5">
                                <TextInput
                                    placeholder="Descrivi l'attività..."
                                    multiline
                                    numberOfLines={5}
                                    textAlignVertical="top"
                                    value={formData.description}
                                    onChangeText={(t) => setFormData({ ...formData, description: t })}
                                    className="text-primary font-medium text-base min-h-[100px]"
                                />
                            </View>
                        </View>

                        {/* Highlighting Urgency Limit logic */}
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
                                    if (v) {
                                        // Count other urgent activities (excluding current one if it was already urgent)
                                        const currentActivity = activities.find(a => a.id === id);
                                        const otherUrgentCount = activities.filter(a =>
                                            a.npoId === currentActivity?.npoId &&
                                            a.id !== id &&
                                            a.isUrgent &&
                                            (a.status === 'APERTA' || a.status === 'IN_CORSO')
                                        ).length;

                                        if (otherUrgentCount >= 3) {
                                            alert("Puoi avere al massimo 3 attività urgenti contemporaneamente.");
                                            return;
                                        }
                                    }
                                    setFormData({ ...formData, isUrgent: v });
                                }}
                                trackColor={{ false: "#e2e8f0", true: Colors.accent }}
                            />
                        </View>

                    </View>

                    {/* Delete Link (Text only) */}
                    <TouchableOpacity
                        onPress={handleDelete}
                        disabled={loading}
                        className="mt-12 mb-10 items-center active:opacity-50"
                    >
                        <View className="flex-row items-center gap-2">
                            <Trash2 size={14} color="#EF4444" />
                            <Text className="text-red-500 font-bold text-sm underline">Elimina questa attività</Text>
                        </View>
                    </TouchableOpacity>
                </ScrollView>

                {/* Truly Sticky Save Button (Compact) */}
                <View className="absolute bottom-0 left-0 right-0 bg-white/95 py-6 border-t border-slate-50 flex-row justify-center">
                    <TouchableOpacity
                        onPress={handleUpdate}
                        disabled={loading}
                        activeOpacity={0.8}
                        className="bg-accent px-10 py-4 rounded-2xl shadow-lg shadow-accent/30 flex-row items-center justify-center active:scale-95 transition-transform"
                    >
                        {loading ? (
                            <ActivityIndicator color="white" size="small" />
                        ) : (
                            <View className="flex-row items-center justify-center w-full relative">
                                <Text className="text-white font-black text-sm uppercase">Salva Modifiche</Text>
                                <View className="absolute right-[-14]">
                                    <Send size={16} color="white" />
                                </View>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </StandardLayout>
    );
}
