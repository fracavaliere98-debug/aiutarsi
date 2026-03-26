import React from 'react';
import { ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { StandardLayout } from '../../components/StandardLayout';
import { SoftCard } from '../../components/SoftCard';

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
                        Ultimo aggiornamento: 24 Marzo 2026
                    </Text>
                    <Text className="text-secondary text-sm leading-6 mb-4">
                        Benvenuto su AiutarSì. La tua privacy è fondamentale per noi. Questa informativa spiega come raccogliamo, utilizziamo e proteggiamo i tuoi dati personali.
                    </Text>
                    
                    <Text className="text-primary font-bold text-lg mb-2">1. Dati Raccolti</Text>
                    <Text className="text-secondary text-sm leading-6 mb-4">
                        Raccogliamo dati necessari per il funzionamento dell&apos;app: nome, email, posizione (opzionale), interessi e competenze di volontariato.
                    </Text>

                    <Text className="text-primary font-bold text-lg mb-2">2. Finalità del Trattamento</Text>
                    <Text className="text-secondary text-sm leading-6 mb-4">
                        I tuoi dati vengono utilizzati per metterti in contatto con le NPO, suggerirti attività tramite lo Smart Match e gestire il tuo profilo di volontario.
                    </Text>

                    <Text className="text-primary font-bold text-lg mb-2">3. Condivisione dei Dati</Text>
                    <Text className="text-secondary text-sm leading-6 mb-4">
                        Condividiamo le tue informazioni di profilo solo con le NPO a cui ti candidi esplicitamente o che decidi di seguire.
                    </Text>

                    <Text className="text-primary font-bold text-lg mb-2">4. I tuoi Diritti</Text>
                    <Text className="text-secondary text-sm leading-6 mb-4">
                        Puoi richiedere la cancellazione del tuo account direttamente dalle impostazioni dell&apos;app in qualsiasi momento.
                    </Text>

                    <Text className="text-secondary text-xs italic mt-6">
                        Questa è una versione sintetica della Privacy Policy per AiutarSì.
                    </Text>
                </SoftCard>
            </ScrollView>
        </StandardLayout>
    );
}
