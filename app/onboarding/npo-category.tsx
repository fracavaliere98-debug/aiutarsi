import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Dimensions,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, CheckCircle2 } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const CATEGORIES = [
    {
        id: 'ambiente',
        label: 'Ambiente',
        emoji: '🌿',
        uri: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop',
    },
    {
        id: 'sociale',
        label: 'Sociale',
        emoji: '🤝',
        uri: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?q=80&w=800&auto=format&fit=crop',
    },
    {
        id: 'educazione',
        label: 'Educazione',
        emoji: '📚',
        uri: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop',
    },
    {
        id: 'animali',
        label: 'Animali',
        emoji: '🐶',
        uri: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=800&auto=format&fit=crop',
    },
    {
        id: 'arte',
        label: 'Arte & Cultura',
        emoji: '🎨',
        uri: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800&auto=format&fit=crop',
    },
    {
        id: 'salute',
        label: 'Salute',
        emoji: '💚',
        uri: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=800&auto=format&fit=crop',
    },
];

export default function NPOCategoryScreen() {
    const router = useRouter();
    const { updateUserProfile } = useAuth();
    const [selected, setSelected] = useState<string[]>([]);

    const toggleCategory = (label: string) => {
        if (selected.includes(label)) {
            setSelected(selected.filter((i) => i !== label));
        } else {
            setSelected([...selected, label]);
        }
    };

    const handleContinue = async () => {
        if (selected.length === 0) return;
        try {
            await updateUserProfile({ interests: selected });
            router.push('/onboarding/npo-skills');
        } catch (e) {
            console.error("Save categories failed", e);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>In quali settori operate?</Text>
                <Text style={styles.subtitle}>
                    Selezionate le aree di intervento principali del vostro ente.{'\n'}
                    Questo garantirà il match perfetto con i volontari interessati.
                </Text>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.grid}>
                    {CATEGORIES.map((item, index) => {
                        const isSelected = selected.includes(item.label);
                        return (
                            <Animated.View 
                                key={item.id}
                                entering={FadeInDown.delay(index * 100).springify()}
                                style={styles.cardWrapper}
                            >
                                <TouchableOpacity 
                                    onPress={() => toggleCategory(item.label)}
                                    activeOpacity={0.9}
                                    style={[
                                        styles.card,
                                        isSelected && styles.cardSelected
                                    ]}
                                >
                                    <Image source={{ uri: item.uri }} style={styles.cardImage} />
                                    <View style={[styles.overlay, isSelected && styles.overlaySelected]}>
                                        <Text style={styles.emoji}>{item.emoji}</Text>
                                        <Text style={styles.label}>{item.label}</Text>
                                        {isSelected && (
                                            <View style={styles.checkIcon}>
                                                <CheckCircle2 size={24} color="white" fill={Colors.success} />
                                            </View>
                                        )}
                                    </View>
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
        paddingTop: 12, // Reduced to sit below layout progress bar
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
        aspectRatio: 1,
        marginBottom: 16,
    },
    card: {
        flex: 1,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#E0E0E0',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    cardSelected: {
        borderWidth: 3,
        borderColor: Colors.primary,
    },
    cardImage: {
        ...StyleSheet.absoluteFillObject,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
    },
    overlaySelected: {
        backgroundColor: 'rgba(53, 47, 139, 0.4)', // Primary with opacity
    },
    emoji: {
        fontSize: 40,
        marginBottom: 8,
    },
    label: {
        color: 'white',
        fontSize: 18,
        fontWeight: '900',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    checkIcon: {
        position: 'absolute',
        top: 12,
        right: 12,
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
