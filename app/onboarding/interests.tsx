import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    Dimensions,
    StyleSheet,
    PanResponder,
    Animated as RNAnimated,
    StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { X, Heart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { INTERESTS } from '../../constants/Interests';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;

export default function OnboardingInterests() {
    const router = useRouter();
    const { user } = useAuth();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [likedInterests, setLikedInterests] = useState<string[]>([]);

    // Refs for PanResponder and other closures to avoid stale state
    const currentIndexRef = useRef(0);
    const likedInterestsRef = useRef<string[]>([]);

    // Sync refs with state
    useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
    useEffect(() => { likedInterestsRef.current = likedInterests; }, [likedInterests]);

    // Persistence: Load saved index
    useEffect(() => {
        if (!user?.id) return;

        const loadProgress = async () => {
            try {
                const key = `onboarding_interest_index_${user.id}`;
                const savedLikesKey = `onboarding_interest_likes_${user.id}`;
                const [savedIndex, savedLikes] = await Promise.all([
                    AsyncStorage.getItem(key),
                    AsyncStorage.getItem(savedLikesKey),
                ]);
                console.log("[DEBUG] Interests: Loading progress for user", user.id, "Index:", savedIndex);
                if (savedIndex !== null) {
                    const idx = parseInt(savedIndex);
                    if (idx < INTERESTS.length) {
                        setCurrentIndex(idx);
                    }
                }
                if (savedLikes) {
                    const parsedLikes = JSON.parse(savedLikes);
                    if (Array.isArray(parsedLikes)) {
                        setLikedInterests(parsedLikes);
                    }
                }
                setIsLoaded(true);
            } catch (e) {
                console.error("Failed to load persistence", e);
                setIsLoaded(true);
            }
        };
        loadProgress();
    }, [user?.id]);

    // Persistence: Save index
    useEffect(() => {
        if (isLoaded && user?.id) {
            const key = `onboarding_interest_index_${user.id}`;
            AsyncStorage.setItem(key, currentIndex.toString());
        }
    }, [currentIndex, isLoaded, user?.id]);

    useEffect(() => {
        if (isLoaded && user?.id) {
            const key = `onboarding_interest_likes_${user.id}`;
            AsyncStorage.setItem(key, JSON.stringify(likedInterests));
        }
    }, [isLoaded, likedInterests, user?.id]);

    const position = useRef(new RNAnimated.ValueXY()).current;
    const rotate = position.x.interpolate({
        inputRange: [-width / 2, 0, width / 2],
        outputRange: ['-10deg', '0deg', '10deg'],
        extrapolate: 'clamp',
    });
    const likeOpacity = position.x.interpolate({
        inputRange: [0, SWIPE_THRESHOLD],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });
    const dislikeOpacity = position.x.interpolate({
        inputRange: [-SWIPE_THRESHOLD, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    const nextCard = (updatedInterests?: string[]) => {
        position.setValue({ x: 0, y: 0 });
        
        const currentIdx = currentIndexRef.current;
        console.log("[DEBUG] nextCard: Current Index", currentIdx, "Array Length", INTERESTS.length);

        if (currentIdx < INTERESTS.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            // FINISHED: Proceed to skills
            const finalInterests = updatedInterests || likedInterestsRef.current;
            console.log("[DEBUG] Interests finished. Navigating to skills with:", finalInterests);
            
            // Clear persistence
            if (user?.id) {
                AsyncStorage.removeItem(`onboarding_interest_index_${user.id}`).catch(() => {});
                AsyncStorage.removeItem(`onboarding_interest_likes_${user.id}`).catch(() => {});
            }

            router.replace({
                pathname: "/onboarding/skills",
                params: {
                    interests: JSON.stringify(finalInterests)
                }
            } as any);
        }
    };

    const skipToSkills = () => {
        router.replace({
            pathname: "/onboarding/skills",
            params: {
                interests: JSON.stringify(likedInterestsRef.current),
            },
        } as any);
    };

    const handleLike = async () => {
        const currentIdx = currentIndexRef.current;
        const interest = INTERESTS[currentIdx];
        if (!interest) return nextCard();
        
        const updated = [...likedInterestsRef.current, interest.label];
        setLikedInterests(updated);
        nextCard(updated);
    };

    const handleDislike = () => {
        nextCard();
    };

    const swipeRight = () => {
        RNAnimated.timing(position, {
            toValue: { x: width * 1.5, y: 0 },
            duration: 300,
            useNativeDriver: false,
        }).start(() => handleLike());
    };

    const swipeLeft = () => {
        RNAnimated.timing(position, {
            toValue: { x: -width * 1.5, y: 0 },
            duration: 300,
            useNativeDriver: false,
        }).start(() => handleDislike());
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) =>
                Math.abs(gestureState.dx) > 5,
            onPanResponderMove: (_, gestureState) => {
                position.setValue({ x: gestureState.dx, y: gestureState.dy });
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx > SWIPE_THRESHOLD) {
                    RNAnimated.timing(position, {
                        toValue: { x: width * 1.5, y: gestureState.dy },
                        duration: 250,
                        useNativeDriver: false,
                    }).start(() => handleLike());
                } else if (gestureState.dx < -SWIPE_THRESHOLD) {
                    RNAnimated.timing(position, {
                        toValue: { x: -width * 1.5, y: gestureState.dy },
                        duration: 250,
                        useNativeDriver: false,
                    }).start(() => handleDislike());
                } else {
                    RNAnimated.spring(position, {
                        toValue: { x: 0, y: 0 },
                        useNativeDriver: false,
                        friction: 5,
                    }).start();
                }
            },
        })
    ).current;

    const currentInterest = INTERESTS[currentIndex] || INTERESTS[0];
    if (!isLoaded) return <View style={styles.container} />;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            {/* Top Nav */}
            <View style={styles.topNav}>
                <Text style={styles.logo}>AiutarSì</Text>
                <TouchableOpacity onPress={skipToSkills}>
                    <Text style={styles.skipText}>Salta</Text>
                </TouchableOpacity>
            </View>

            {/* Progress - Removed redundant bar handled by layout */}

            {/* Header Text */}
            <View style={styles.headerSection}>
                <Text style={styles.title}>Cosa ti appassiona?</Text>
                <Text style={styles.subtitle}>
                    Scorri o clicca per scegliere i tuoi interessi.{'\n'}Gemma userà queste info per i tuoi match.
                </Text>
            </View>

            {/* Card Area */}
            <View style={styles.cardArea}>
                {/* Background card (next) */}
                {currentIndex < INTERESTS.length - 1 && (
                    <View style={styles.backgroundCard}>
                        <Image
                            source={{ uri: INTERESTS[currentIndex + 1].uri }}
                            style={styles.cardImage}
                            resizeMode="cover"
                        />
                    </View>
                )}

                {/* Foreground card (current) */}
                <RNAnimated.View
                    style={[
                        styles.foregroundCard,
                        {
                            transform: [
                                { translateX: position.x },
                                { translateY: position.y },
                                { rotate },
                            ],
                        },
                    ]}
                    {...panResponder.panHandlers}
                >
                    <Image
                        source={{ uri: currentInterest.uri }}
                        style={styles.cardImage}
                        resizeMode="cover"
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.85)']}
                        style={styles.cardGradient}
                    >
                        {/* Like / Nope indicators */}
                        <RNAnimated.View style={[styles.likeStamp, { opacity: likeOpacity }]}>
                            <Text style={styles.likeStampText}>💚 MI INTERESSA</Text>
                        </RNAnimated.View>
                        <RNAnimated.View style={[styles.nopeStamp, { opacity: dislikeOpacity }]}>
                            <Text style={styles.nopeStampText}>✕ SALTA</Text>
                        </RNAnimated.View>

                        <Text style={styles.cardLabel}>
                            {currentInterest.label} {currentInterest.emoji}
                        </Text>
                        <Text style={styles.cardDesc}>{currentInterest.description}</Text>
                    </LinearGradient>
                </RNAnimated.View>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttons}>
                <TouchableOpacity style={styles.btnDislike} onPress={swipeLeft} activeOpacity={0.8}>
                    <X size={32} color={Colors.primary} strokeWidth={2.5} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnLike} onPress={swipeRight} activeOpacity={0.8}>
                    <Heart size={38} color="white" fill="white" />
                </TouchableOpacity>
            </View>

            {/* Bottom hint */}
            <View style={styles.hint}>
                <Text style={styles.hintText}>SCORRI PER DECIDERE</Text>
            </View>
        </SafeAreaView>
    );
}

const CARD_HEIGHT = height * 0.48;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F6FF',
    },
    topNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    logo: {
        fontSize: 22,
        fontWeight: '900',
        color: Colors.primary,
    },
    skipText: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.primary,
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    progressContainer: {
        paddingHorizontal: 24,
        marginBottom: 12,
    },
    progressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    progressLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: `${Colors.primary}66`,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    progressTrack: {
        height: 6,
        backgroundColor: `${Colors.primary}18`,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 3,
    },
    headerSection: {
        paddingHorizontal: 24,
        marginBottom: 16,
        alignItems: 'center',
    },
    title: {
        fontSize: 26,
        fontWeight: '900',
        color: '#2d1b69',
        textAlign: 'center',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 13,
        color: Colors.secondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    cardArea: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 24,
    },
    backgroundCard: {
        position: 'absolute',
        width: '100%',
        height: CARD_HEIGHT,
        borderRadius: 36,
        overflow: 'hidden',
        opacity: 0.45,
        transform: [{ scale: 0.95 }, { translateY: 10 }],
        backgroundColor: '#ddd',
    },
    foregroundCard: {
        width: '100%',
        height: CARD_HEIGHT,
        borderRadius: 36,
        overflow: 'hidden',
        backgroundColor: '#eee',
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },
    cardGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
        borderRadius: 36,
        justifyContent: 'flex-end',
        padding: 28,
    },
    likeStamp: {
        position: 'absolute',
        top: 28,
        left: 20,
        backgroundColor: 'rgba(0,200,100,0.85)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    likeStampText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 15,
        letterSpacing: 1,
    },
    nopeStamp: {
        position: 'absolute',
        top: 28,
        right: 20,
        backgroundColor: 'rgba(220,50,50,0.85)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    nopeStampText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 15,
        letterSpacing: 1,
    },
    cardLabel: {
        fontSize: 30,
        fontWeight: '900',
        color: 'white',
        marginBottom: 6,
    },
    cardDesc: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '500',
    },
    buttons: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 32,
        paddingTop: 20,
        paddingBottom: 12,
    },
    btnDislike: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    btnLike: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#e31b5d',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: '#e31b5d',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    hint: {
        alignItems: 'center',
        paddingBottom: 20,
    },
    hintText: {
        fontSize: 10,
        fontWeight: '700',
        color: `${Colors.primary}40`,
        letterSpacing: 4,
    },
});
