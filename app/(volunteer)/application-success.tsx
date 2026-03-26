import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, ArrowRight } from "lucide-react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

export default function ApplicationSuccess() {
    const router = useRouter();
    const { npoName, type } = useLocalSearchParams<{ npoName: string, type: string }>();
    const isActivity = type === "ACTIVITY";

    return (
        <SafeAreaView className="flex-1 bg-background justify-between p-8 relative overflow-hidden">
            {/* Background Decorations (Bubbles) */}
            <View className="absolute top-20 right-10 w-20 h-20 bg-accent/5 rounded-full" />
            <View className="absolute bottom-40 left-[-20] w-32 h-32 bg-accent/5 rounded-full" />

            <View className="flex-1 justify-center items-center">
                <Animated.View entering={ZoomIn.duration(600).springify()} className="mb-10 relative">
                    {/* Ripple/Glow effect behind checkmark */}
                    <View className="absolute inset-0 bg-accent/20 rounded-full scale-150" />

                    <View className="w-24 h-24 bg-accent rounded-full items-center justify-center shadow-lg shadow-accent/40">
                        <Check size={48} color="white" strokeWidth={3} />
                    </View>
                </Animated.View>

                <Animated.Text entering={FadeInDown.delay(200).duration(500)} className="text-3xl font-black text-primary text-center mb-6">
                    {isActivity ? "Ti sei iscritto!" : "Candidatura Inviata!"}
                </Animated.Text>

                <Animated.Text entering={FadeInDown.delay(300).duration(500)} className="text-lg text-secondary text-center px-4 leading-relaxed">
                    {isActivity ? (
                        <>
                            L&apos;ente <Text className="font-bold text-accent">{npoName}</Text> sarà felice di averti tra i suoi volontari per questa attività! Mettiti in contatto con loro il prima possibile!
                        </>
                    ) : (
                        <>
                            L&apos;ente <Text className="font-bold text-accent">{npoName}</Text> riceverà la tua richiesta e ti risponderà a breve.
                        </>
                    )}
                </Animated.Text>

                <Animated.Text entering={FadeInDown.delay(400).duration(500)} className="text-secondary text-center mt-8 text-sm">
                    {isActivity ? (
                        <>Puoi vedere i dettagli in{"\n"}<Text className="font-bold">&quot;Calendar&quot;</Text> o <Text className="font-bold">&quot;Le Mie Attività&quot;</Text>.</>
                    ) : (
                        <>Puoi monitorare lo stato in{"\n"}<Text className="font-bold">&quot;Le Mie Attività&quot;</Text>.</>
                    )}
                </Animated.Text>

                {/* Dots indicator mimicking design */}
                <Animated.View entering={FadeInDown.delay(500)} className="flex-row gap-2 mt-10">
                    <View className="w-8 h-2 bg-accent/30 rounded-full" />
                    <View className="w-8 h-2 bg-accent rounded-full" />
                </Animated.View>
            </View>

            <Animated.View entering={FadeInDown.delay(600).duration(500)} className="w-full gap-4 mb-4">
                <TouchableOpacity
                    onPress={() => router.replace("/(volunteer)" as any)}
                    className="bg-accent rounded-full py-4 items-center flex-row justify-center gap-2 shadow-lg shadow-accent/20"
                >
                    <Text className="text-white font-bold text-lg">Torna alla Home</Text>
                    <ArrowRight size={20} color="white" />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => router.replace("/(volunteer)/(tabs)/calendar" as any)}
                    className="bg-white border-2 border-gray-100 rounded-full py-4 items-center"
                >
                    <Text className="text-primary font-bold text-lg">Vedi le mie attività</Text>
                </TouchableOpacity>
            </Animated.View>
        </SafeAreaView>
    );
}
