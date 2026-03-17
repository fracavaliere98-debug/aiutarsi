import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, CheckCircle2 } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SKILLS } from '../../constants/Skills';

const { width } = Dimensions.get('window');

export default function NPOSkillsScreen() {
    const router = useRouter();
    const { updateUserProfile } = useAuth();
    const [selected, setSelected] = useState<string[]>([]);

    const toggleSkill = (label: string) => {
        if (selected.includes(label)) {
            setSelected(selected.filter((i) => i !== label));
        } else {
            setSelected([...selected, label]);
        }
    };

    const handleContinue = async () => {
        if (selected.length === 0) return;
        try {
            // Saving sought_skills in the database
            await updateUserProfile({ sought_skills: selected } as any);
            router.push('/onboarding/npo-details');
        } catch (e) {
            console.error("Save skills failed", e);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Quali skill cercate?</Text>
                <Text style={styles.subtitle}>
                    Selezionate le competenze che ricercate più spesso nei volontari.{'\n'}
                    Avviseremo i talenti giusti non appena sarete pronti!
                </Text>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.grid}>
                    {SKILLS.map((item, index) => {
                        const isSelected = selected.includes(item.label);
                        const Icon = item.icon;
                        return (
                            <Animated.View 
                                key={item.id}
                                entering={FadeInDown.delay(index * 50).springify()}
                                style={styles.cardWrapper}
                            >
                                <TouchableOpacity 
                                    onPress={() => toggleSkill(item.label)}
                                    activeOpacity={0.7}
                                    style={[
                                        styles.card,
                                        isSelected && styles.cardSelected
                                    ]}
                                >
                                    <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                                        <Icon size={24} color={isSelected ? 'white' : Colors.primary} />
                                    </View>
                                    <Text style={[styles.label, isSelected && styles.labelSelected]}>{item.label}</Text>
                                    {isSelected && (
                                        <View style={styles.checkIcon}>
                                            <CheckCircle2 size={20} color={Colors.success} fill="white" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </Animated.View>
                        );
                    })}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity 
                    onPress={handleContinue}
                    disabled={selected.length === 0}
                    style={[styles.button, selected.length === 0 && styles.buttonDisabled]}
                >
                    <Text style={styles.buttonText}>Continua</Text>
                    <ArrowRight size={22} color="white" strokeWidth={2.5} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FB',
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#1A1A40',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 15,
        color: '#606080',
        lineHeight: 22,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    cardWrapper: {
        width: (width - 48) / 2,
        marginBottom: 12,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        height: 110,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    cardSelected: {
        borderColor: Colors.primary,
        backgroundColor: '#F0F0FF',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F0F0FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    iconContainerSelected: {
        backgroundColor: Colors.primary,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: '#404060',
        textAlign: 'center',
    },
    labelSelected: {
        color: Colors.primary,
    },
    checkIcon: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        paddingBottom: 30,
        backgroundColor: 'rgba(248,249,251,0.9)',
    },
    button: {
        backgroundColor: '#352F8B',
        height: 56,
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        elevation: 5,
        shadowColor: '#352F8B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    buttonDisabled: {
        backgroundColor: '#D1D1E0',
        shadowOpacity: 0,
        elevation: 0,
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
});
