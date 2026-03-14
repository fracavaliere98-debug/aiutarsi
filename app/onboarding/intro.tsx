import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { X, ArrowRight } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function OnboardingIntro() {
    const router = useRouter();
    const { logout } = useAuth();

    const handleStart = () => {
        router.push('/onboarding/interests');
    };

    const handleClose = async () => {
        await logout();
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                    <X size={20} color={Colors.primary} strokeWidth={2.5} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>AiutarSì</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <Animated.View 
                    entering={FadeInUp.delay(200).springify()}
                    style={styles.imageContainer}
                >
                    <Image 
                        source={require('../../assets/images/gemma-intro.png')} 
                        style={styles.image}
                        resizeMode="cover"
                    />
                </Animated.View>

                <Animated.View 
                    entering={FadeInDown.delay(400).springify()}
                    style={styles.textContent}
                >
                    <Text style={styles.title}>Ciao! Io sono <Text style={{ color: Colors.accent }}>Gemma</Text>, la tua assistente di bordo.</Text>
                    <Text style={styles.subtitle}>
                        Ti aiuterò a trovare il modo migliore per fare la differenza oggi.
                    </Text>
                </Animated.View>

                <View style={styles.pagination}>
                    <View style={[styles.dot, styles.dotActive]} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                </View>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity 
                    onPress={handleStart} 
                    style={styles.button}
                    activeOpacity={0.8}
                >
                    <Text style={styles.buttonText}>Inizia</Text>
                    <ArrowRight size={22} color="#FFFFFF" strokeWidth={2.5} />
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#2D2D8A', // Custom purple from mockup
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
    },
    imageContainer: {
        width: width * 0.8,
        aspectRatio: 1,
        borderRadius: 50,
        overflow: 'hidden',
        backgroundColor: '#E0E0E0',
        marginBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    textContent: {
        alignItems: 'center',
        marginBottom: 30,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#1A1A40',
        textAlign: 'center',
        lineHeight: 34,
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 16,
        color: '#606080',
        textAlign: 'center',
        lineHeight: 24,
    },
    pagination: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#D1D1E0',
    },
    dotActive: {
        width: 32,
        backgroundColor: '#352F8B', // Active dot color
    },
    footer: {
        paddingHorizontal: 30,
        paddingBottom: 40,
    },
    button: {
        backgroundColor: '#352F8B',
        height: 70,
        borderRadius: 35,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        shadowColor: '#352F8B',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '700',
    },
});
