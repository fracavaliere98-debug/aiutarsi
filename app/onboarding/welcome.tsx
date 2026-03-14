import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';
import { Button } from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2 } from 'lucide-react-native';

export default function WelcomeScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const { updateUserProfile } = useAuth();

    const handleFinish = async () => {
        // Double check completion state just in case
        await updateUserProfile({ profile_completed: true });
        router.replace("/(volunteer)/(tabs)/community" as any);
    };

    return (
        <ScreenWrapper className="bg-background-light">
            <View className="flex-1 px-6 justify-center items-center">
                {/* Branding / Gemma Robot */}
                <View className="w-full h-48 mb-6 items-center justify-center">
                    <Image 
                        source={require('../../assets/images/logo.png')} 
                        className="w-full h-full"
                        resizeMode="contain"
                    />
                </View>

                <View className="flex-row items-center gap-2 mb-4">
                    <CheckCircle2 size={32} color={Colors.primary} />
                    <Text className="text-3xl font-bold text-primary">Ottimo lavoro!</Text>
                </View>

                <Text className="text-lg text-secondary text-center mb-12">
                    Grazie {user?.full_name?.split(' ')[0] || 'Volontario'}, il tuo profilo è pronto. Gemma ha già iniziato a cercare le attività migliori per te.
                </Text>

                <View className="w-full">
                    <Button 
                        onPress={handleFinish}
                        variant="primary"
                        className="h-14"
                        title="Inizia ora"
                    />
                </View>
            </View>
        </ScreenWrapper>
    );
}
