import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useActivities } from "../../context/ActivityContext";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { ArrowLeft, Calendar, MapPin, Users, Tag, AlignLeft, Send, Clock, Sparkles, MessageSquare, Code, Heart, PenTool, Lightbulb, BarChart, HardHat, Camera, CheckCircle2, AlertCircle } from "lucide-react-native";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { StandardLayout } from "../../components/StandardLayout";
import { AddressAutocomplete } from "../../components/AddressAutocomplete";

const SKILLS = [
    { id: "comms", label: "Comunicazione", icon: MessageSquare },
    { id: "tech", label: "Informatica", icon: Code },
    { id: "medical", label: "Primo Soccorso", icon: Heart },
    { id: "creative", label: "Creatività", icon: PenTool },
    { id: "planning", label: "Organizzazione", icon: Lightbulb },
    { id: "data", label: "Analisi Dati", icon: BarChart },
    { id: "manual", label: "Lavoro Manuale", icon: HardHat },
    { id: "photo", label: "Fotografia", icon: Camera },
];

export default function CreateActivityScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { createActivity, activities } = useActivities();
    const [formData, setFormData] = useState({
        title: "",
        category: "Sociale",
        address: "",
        lat: 45.464,
        lng: 9.190,
        date: "2026-02-12",
        slots: "10",
        description: "",
        startTime: "10:00",
        endTime: "12:00",
        isUrgent: false,
        skills: [] as string[],
        imageUrl: undefined as string | undefined
    });

    const urgentCount = activities.filter(a => a.npoId === user?.id && a.isUrgent && (a.status === 'APERTA' || a.status === 'IN_CORSO')).length;
    const [coordsConfirmed, setCoordsConfirmed] = useState(false);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            alert('Permesso galleria necessario.');
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
            alert("Compila tutti i campi obbligatori, inclusa la data e l'orario di fine.");
            return;
        }

        // Guard: user typed an address but never tapped a suggestion from the autocomplete dropdown
        if (!coordsConfirmed) {
            alert("Seleziona un indirizzo dalla lista dei suggerimenti per ottenere le coordinate corrette.");
            return;
        }

        // ISO strings from local time
        const start = new Date(`${formData.date}T${formData.startTime}:00`);
        const end = new Date(`${formData.date}T${formData.endTime}:00`);
        const startISO = start.toISOString();
        const endISO = end.toISOString();

        const now = new Date();

        if (start < now) {
            alert("Non puoi creare un'attività che inizia nel passato. Seleziona una data e un orario futuri.");
            return;
        }

        if (end <= start) {
            alert("L'orario di fine deve essere successivo all'orario di inizio.");
            return;
        }

        const success = await createActivity({
            title: formData.title,
            category: formData.category,
            location: {
                coords: { lat: formData.lat, lng: formData.lng },
                address: formData.address
            },
            slots: parseInt(formData.slots),
            description: formData.description,
            dateTime: startISO,
            endDateTime: endISO,
            skills: formData.skills,
            isUrgent: formData.isUrgent,
            imageUrl: formData.imageUrl
        });

        if (success) {
            router.replace("/(npo)" as any);
        }
    };

    return (
        <StandardLayout
            label="Inizia ora"
            title="Crea Attività"
            bg="bg-background-light"
            onBack={() => router.back()}
        >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <View className="gap-6">
                    {/* Activity Image */}
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
                                        <Camera size={32} color={Colors.primary} />
                                    </View>
                                    <Text className="text-primary/40 font-bold text-sm">Carica una foto per l'attività</Text>
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
                        <AddressAutocomplete
                            onSelect={(addr, lat, lng) => {
                                setFormData({ ...formData, address: addr, lat, lng });
                                setCoordsConfirmed(true);
                            }}
                            onChangeText={() => setCoordsConfirmed(false)}
                            placeholder="Cerca via, piazza o città..."
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

                    {/* Date */}
                    <View>
                        <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Data Attività (AAAA-MM-GG)</Text>
                        <View className="bg-white p-4 rounded-2xl shadow-sm border border-primary/5 flex-row items-center">
                            <Calendar size={20} color={Colors.secondary} className="mr-3" />
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
                                <Clock size={20} color={Colors.secondary} className="mr-3" />
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
                                <Clock size={20} color={Colors.secondary} className="mr-3" />
                                <TextInput
                                    placeholder="12:00"
                                    value={formData.endTime}
                                    onChangeText={(t) => setFormData({ ...formData, endTime: t })}
                                    className="flex-1 text-primary font-medium text-base"
                                />
                            </View>
                        </View>
                    </View>

                    {/* Slots */}
                    <View>
                        <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-2 ml-1">Volontari Necessari</Text>
                        <View className="bg-white p-4 rounded-2xl shadow-sm border border-primary/5 flex-row items-center">
                            <Users size={20} color={Colors.secondary} className="mr-3" />
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
                                <Text className="text-secondary text-[10px]">L'attività avrà priorità nel match.</Text>
                            </View>
                        </View>
                        <Switch
                            value={formData.isUrgent}
                            onValueChange={(v) => {
                                if (v && urgentCount >= 3) {
                                    alert("Puoi avere al massimo 3 attività urgenti contemporaneamente.");
                                    return;
                                }
                                setFormData({ ...formData, isUrgent: v });
                            }}
                            trackColor={{ false: "#e2e8f0", true: Colors.accent }}
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleCreate}
                        className="bg-accent py-5 rounded-[24px] shadow-xl shadow-accent/40 items-center justify-center flex-row gap-3 mt-4 active:scale-95 transition-transform"
                    >
                        <Text className="text-white font-black text-lg">Pubblica Attività</Text>
                        <Send size={20} color="white" />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </StandardLayout>
    );
}
