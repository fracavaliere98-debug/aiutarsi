import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Image } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, MapPin, Calendar, CheckCircle2, Building2, User } from 'lucide-react-native';
import { useAuth } from "../../context/AuthContext";
import { useActivities } from "../../context/ActivityContext";
import { useApplications } from "../../context/ApplicationContext";
import { Colors } from "../../constants/Colors";
import { UserAvatar } from "../../components/UserAvatar";

export default function ReviewApplication() {
    const router = useRouter();
    const { activityId, npoId, type } = useLocalSearchParams<{ activityId: string, npoId: string, type: "ACTIVITY" | "NPO" }>();
    const { user, users } = useAuth();
    const { activities, applyToActivity, enrollInActivity } = useActivities();
    const { applyToNPO } = useApplications();

    // 1. Resolve Data based on Type
    const isActivity = type !== "NPO"; // Default to activity for backward compatibility
    const activity = isActivity ? activities.find(a => a.id === activityId) : null;
    const npoUser = !isActivity ? users.find(u => u.id === npoId) : null;

    // State
    const [phoneNumber, setPhoneNumber] = useState(user?.phone || "");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Validation
    if ((isActivity && !activity) || (!isActivity && !npoUser) || !user) {
        return (
            <SafeAreaView className="flex-1 bg-background justify-center items-center">
                <Text className="text-secondary text-lg">Caricamento o dati mancanti...</Text>
            </SafeAreaView>
        );
    }

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network

            let success = false;

            if (isActivity && activity) {
                // IMMEDIATE Enrollment for OldActivity
                success = await enrollInActivity(activity.id, notes, phoneNumber);
            } else if (npoUser) {
                // Apply to NPO
                success = await applyToNPO(npoUser.id, npoUser.npoName || "NPO", notes);
            }

            if (success) {
                router.replace({
                    pathname: "/(volunteer)/application-success",
                    params: {
                        npoName: isActivity ? activity!.npoName : npoUser!.npoName,
                        activityTitle: isActivity ? activity!.title : "Candidatura Ente"
                    }
                } as any);
            } else {
                alert("Errore durante l'invio. Potresti aver già inviato una candidatura.");
            }
        } catch (error) {
            console.error(error);
            alert("Si è verificato un errore tecnico.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            {/* Header */}
            <View className="px-6 py-4 flex-row items-center border-b border-gray-100 bg-white">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ArrowLeft size={24} color={Colors.primary} />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-primary">
                    {isActivity ? "Riepilogo Iscrizione" : "Candidatura Ente"}
                </Text>
            </View>

            <ScrollView className="flex-1 px-6 pt-6">
                {/* Step Indicator */}
                <View className="flex-row items-center justify-between mb-8">
                    <Text className="text-accent font-bold">Passo 1 di 2</Text>
                    <View className="flex-row gap-2">
                        <View className="h-2 w-16 bg-accent rounded-full" />
                        <View className="h-2 w-16 bg-gray-200 rounded-full" />
                    </View>
                </View>

                {/* Summary Card */}
                <View className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-8">
                    <View className="flex-row items-center gap-4 mb-4">
                        <View className="w-12 h-12 bg-indigo-50 rounded-full items-center justify-center">
                            {isActivity ? <Text className="text-xl">🤝</Text> : <Building2 size={24} color={Colors.accent} />}
                        </View>
                        <View className="flex-1">
                            <Text className="text-lg font-bold text-primary leading-tight mb-1">
                                {isActivity ? activity!.title : npoUser!.npoName}
                            </Text>
                            <Text className="text-accent font-medium">
                                {isActivity ? activity!.npoName : "Candidatura Spontanea"}
                            </Text>
                        </View>
                    </View>

                    {isActivity ? (
                        <View className="space-y-3">
                            <View className="flex-row items-center gap-3">
                                <Calendar size={18} color={Colors.secondary} />
                                <Text className="text-secondary">
                                    {new Date(activity!.dateTime).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </Text>
                            </View>
                            <View className="flex-row items-center gap-3">
                                <MapPin size={18} color={Colors.secondary} />
                                <Text className="text-secondary flex-1" numberOfLines={1}>
                                    {activity!.location.address}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <View className="space-y-3">
                            <Text className="text-secondary leading-5">
                                Stai inviando la tua candidatura per entrare a far parte dei volontari di {npoUser!.npoName}.
                            </Text>
                        </View>
                    )}
                </View>

                {/* Form Section */}
                <View className="border-l-4 border-accent pl-4 mb-6">
                    <Text className="text-xl font-bold text-primary">Conferma i tuoi dati</Text>
                </View>

                <View className="mb-6">
                    <Text className="text-primary font-bold mb-2 text-base">Telefono</Text>
                    <View className="flex-row items-center bg-white border border-gray-200 rounded-2xl px-4 h-14">
                        <TextInput
                            className="flex-1 text-primary text-lg"
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            keyboardType="phone-pad"
                            placeholder="+39 ..."
                        />
                        <CheckCircle2 size={20} color={Colors.success} fill={Colors.success} className="opacity-20" />
                    </View>
                    <Text className="text-gray-400 text-xs mt-2 px-1">
                        Usiamo questo numero per contattarti in caso di necessità.
                    </Text>
                </View>

                <View className="mb-8">
                    <Text className="text-primary font-bold mb-2 text-base">
                        {isActivity ? "Note per l'Ente" : "Presentati (Opzionale)"}
                        <Text className="text-gray-400 font-normal"> (Opzionale)</Text>
                    </Text>
                    <TextInput
                        className="bg-white border border-gray-200 rounded-2xl p-4 text-primary text-base min-h-[120px]"
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        textAlignVertical="top"
                        placeholder={isActivity
                            ? "Scrivi qui se hai esigenze particolari..."
                            : "Racconta brevemente perché vuoi unirti a noi..."
                        }
                    />
                </View>
            </ScrollView>

            {/* Footer Action */}
            <View className="p-6 bg-white border-t border-gray-100">
                <TouchableOpacity
                    onPress={handleConfirm}
                    disabled={isSubmitting}
                    className={`bg-accent rounded-full py-4 items-center flex-row justify-center gap-2 ${isSubmitting ? 'opacity-70' : ''}`}
                >
                    <Text className="text-white font-bold text-lg">
                        {isSubmitting ? "Invio in corso..." : (isActivity ? "Iscriviti all'attività" : "Richiedi iscrizione all'ente")}
                    </Text>
                    {!isSubmitting && <ArrowLeft size={20} color="white" style={{ transform: [{ rotate: '180deg' }] }} />}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
