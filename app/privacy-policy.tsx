import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StandardLayout } from '../components/StandardLayout';
import { SoftCard } from '../components/SoftCard';
import { PRIVACY_POLICY_LAST_UPDATE, PRIVACY_POLICY_SECTIONS as SECTIONS } from '../shared/privacyPolicyContent';

export default function PrivacyPolicyScreen() {
    const router = useRouter();

    return (
        <StandardLayout
            title="Privacy Policy"
            label="Legale"
            onBack={() => router.back()}
        >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <SoftCard className="p-6">
                    <Text className="text-primary font-black text-xl mb-4">Informativa sulla Privacy</Text>
                    <Text className="text-secondary text-sm leading-6 mb-4">
                        Ultimo aggiornamento: {PRIVACY_POLICY_LAST_UPDATE}
                    </Text>
                    <Text className="text-secondary text-sm leading-6 mb-6">
                        Questa informativa spiega quali dati personali tratta AiutarSì, perché, chi li vede e per quanto tempo li conserviamo.
                    </Text>

                    {SECTIONS.map((section) => (
                        <View key={section.title} className="mb-4">
                            <Text className="text-primary font-bold text-lg mb-2">{section.title}</Text>
                            {section.paragraphs.map((paragraph) => (
                                <Text key={paragraph} className="text-secondary text-sm leading-6 mb-3">
                                    {paragraph}
                                </Text>
                            ))}
                        </View>
                    ))}
                </SoftCard>
            </ScrollView>
        </StandardLayout>
    );
}
