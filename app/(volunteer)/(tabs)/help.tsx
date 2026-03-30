import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { GemmaAIChat } from '../../../components/GemmaAIChat';

export default function VolunteerHelpTab() {
    const router = useRouter();
    const [chatVisible, setChatVisible] = useState(true);

    useFocusEffect(
        React.useCallback(() => {
            setChatVisible(true);
        }, [])
    );

    useEffect(() => {
        setChatVisible(true);
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <GemmaAIChat
                visible={chatVisible}
                onClose={() => {
                    setChatVisible(false);
                    router.replace('/(volunteer)/(tabs)/community' as any);
                }}
                mode="help_center"
                title="Chiedi a Gemma"
                subtitle="Assistente AiutarSì"
            />
        </View>
    );
}
