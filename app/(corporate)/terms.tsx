import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StandardLayout } from '../../components/StandardLayout';
import { SoftCard } from '../../components/SoftCard';

export default function TermsOfServiceScreen() {
    const router = useRouter();

    return (
        <StandardLayout 
            title="Termini di Servizio" 
            label="Legale" 
            onBack={() => router.back()}
        >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <SoftCard className="p-6">
                    <Text className="text-primary font-black text-xl mb-4">Termini e Condizioni d&apos;Uso</Text>
                    <Text className="text-secondary text-sm leading-6 mb-4">
                        Ultimo aggiornamento: 24 Marzo 2026
                    </Text>
                    
                    <Text className="text-primary font-bold text-lg mb-2">1. Accettazione dei Termini</Text>
                    <Text className="text-secondary text-sm leading-6 mb-4">
                        Utilizzando l&apos;app AiutarSì, accetti di rispettare questi termini. L&apos;app è una piattaforma di matching tra volontari e organizzazioni non profit.
                    </Text>

                    <Text className="text-primary font-bold text-lg mb-2">2. Comportamento dell&apos;Utente</Text>
                    <Text className="text-secondary text-sm leading-6 mb-4">
                        Gli utenti si impegnano a fornire informazioni veritiere e a partecipare alle attività in modo rispettoso e responsabile.
                    </Text>

                    <Text className="text-primary font-bold text-lg mb-2">3. Responsabilità</Text>
                    <Text className="text-secondary text-sm leading-6 mb-4">
                        AiutarSì non è responsabile per gli incidenti che possono verificarsi durante le attività fisiche coordinate tramite la piattaforma. Ogni NPO è responsabile per la sicurezza dei propri volontari.
                    </Text>

                    <Text className="text-primary font-bold text-lg mb-2">4. Modifiche</Text>
                    <Text className="text-secondary text-sm leading-6 mb-4">
                        Ci riserviamo il diritto di sospendere account che violino lo spirito della community o forniscano dati falsi.
                    </Text>

                    <Text className="text-secondary text-xs italic mt-6">
                        Questa è una versione sintetica dei Termini di Servizio per AiutarSì.
                    </Text>
                </SoftCard>
            </ScrollView>
        </StandardLayout>
    );
}
