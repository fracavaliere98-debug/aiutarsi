import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Switch, Animated, Dimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { MapPin, Bell, Shield, Heart, Sparkles, Rocket, ArrowLeft } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { UserAvatar } from '../../components/UserAvatar';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
    const router = useRouter();
    const { user, updateUserProfile } = useAuth();
    const [phase, setPhase] = useState<'permissions' | 'transition'>('permissions');
    
    // Phase 1 States
    const [locationEnabled, setLocationEnabled] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    
    // Phase 2 States
    const progress = useRef(new Animated.Value(0)).current;
    const [progressPercent, setProgressPercent] = useState(0);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (phase === 'transition') {
            // Fade in transition
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }).start();

            // Progress bar animation (5 seconds)
            Animated.timing(progress, {
                toValue: 1,
                duration: 5000,
                useNativeDriver: false,
            }).start();

            const listener = progress.addListener(({ value }) => {
                setProgressPercent(Math.floor(value * 100));
            });

            const timer = setTimeout(async () => {
                await updateUserProfile({ profile_completed: true });
                router.replace("/(volunteer)/(tabs)/community" as any);
            }, 5500);

            return () => {
                progress.removeListener(listener);
                clearTimeout(timer);
            };
        }
    }, [phase]);

    const toggleLocation = async (value: boolean) => {
        if (value) {
            const { status } = await Location.requestForegroundPermissionsAsync();
            setLocationEnabled(status === 'granted');
        } else {
            setLocationEnabled(false);
        }
    };

    const toggleNotifications = async (value: boolean) => {
        if (value) {
            const { status } = await Notifications.requestPermissionsAsync();
            setNotificationsEnabled(status === 'granted');
        } else {
            setNotificationsEnabled(false);
        }
    };

    const startJourney = () => {
        setPhase('transition');
    };

    if (phase === 'transition') {
        return (
            <View style={{ flex: 1 }}>
                <LinearGradient
                    colors={['#4c1d95', '#7c3aed', '#db2777']}
                    style={{ flex: 1 }}
                >
                    <Animated.View 
                        style={{ flex: 1, opacity: fadeAnim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 }}
                    >
                        <View className="items-center mb-12">
                            <View className="relative">
                                <View className="w-40 h-40 rounded-full border-4 border-white/30 p-2">
                                    <View className="w-full h-full rounded-full overflow-hidden bg-white/10 shadow-2xl">
                                        <UserAvatar size={144} />
                                    </View>
                                </View>
                                <View className="absolute top-4 right-4 w-6 h-6 bg-green-500 rounded-full border-2 border-white" />
                            </View>
                        </View>

                        <Text className="text-white text-4xl font-black mb-4">Tutto pronto!</Text>
                        <Text className="text-white/80 text-lg text-center font-medium mb-16 px-10">
                            Stiamo preparando la tua community...
                        </Text>

                        <View className="w-full mb-3 flex-row justify-between items-end">
                            <Text className="text-white/60 text-[10px] font-black uppercase tracking-[3px]">Inizializzazione</Text>
                            <Text className="text-white text-xl font-black">{progressPercent}%</Text>
                        </View>
                        
                        <View className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden">
                            <Animated.View 
                                style={{ 
                                    width: progress.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%']
                                    }),
                                    backgroundColor: 'white'
                                }} 
                                className="h-full rounded-full"
                            />
                        </View>

                        {/* Branding */}
                        <View className="absolute bottom-10 opacity-30">
                             <Text className="text-white text-xs font-black tracking-[8px]">AIUTARSÌ</Text>
                        </View>

                        {/* Gemma Transition Info */}
                        <View className="absolute bottom-24 bg-white/10 px-6 py-5 rounded-[32px] border border-white/20 flex-row items-center gap-4 w-full">
                            <View className="w-12 h-12 bg-white/20 rounded-2xl items-center justify-center">
                                <Sparkles size={24} color="white" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-white font-bold text-base">Gemma sta arrivando</Text>
                                <Text className="text-white/70 text-xs">Connettendo i nodi di assistenza locale</Text>
                            </View>
                        </View>
                    </Animated.View>
                </LinearGradient>
            </View>
        );
    }

    return (
        <ScreenWrapper className="bg-white">
            <ScrollView 
                className="flex-1" 
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                <View className="px-6">
                    {/* Header with back button */}
                    <View className="h-16 flex-row items-center justify-between">
                        <TouchableOpacity 
                            onPress={() => router.back()}
                            className="w-10 h-10 bg-primary/5 rounded-full items-center justify-center"
                        >
                            <ArrowLeft size={20} color="#4c1d95" />
                        </TouchableOpacity>
                        <Text className="text-xl font-bold text-[#2d1b69]">Permessi e Privacy</Text>
                        <View className="w-10" />
                    </View>

                    {/* Gemma Insight Box (Compact layout) */}
                    <View 
                        className="mb-3 mt-0 bg-primary/5 px-4 py-2 rounded-2xl border border-primary/10 flex-row items-center"
                    >
                        <View className="w-9 h-9 bg-primary/10 rounded-xl items-center justify-center mr-3">
                            <Sparkles size={16} color={Colors.primary} />
                        </View>
                        <View className="flex-1">
                            <Text 
                                numberOfLines={2}
                                className="text-primary/80 font-bold text-[12px] italic leading-tight"
                            >
                                Gemma sta già ricercando attività giuste per te, ma intanto...
                            </Text>
                        </View>
                    </View>

                    {/* Main Illustration Area (Reduced Size) */}
                    <View className="items-center mb-6">
                        <View className="w-full h-44 rounded-[40px] overflow-hidden items-center justify-center bg-[#f3f0ff]">
                            <LinearGradient
                                colors={['#f3f0ff', '#e9e4ff']}
                                className="absolute inset-0"
                            />
                            <View className="w-16 h-24 bg-[#a78bfa] rounded-2xl items-center justify-center shadow-xl relative">
                                <Shield size={32} color="white" strokeWidth={2.5} />
                                <View className="absolute top-1/2 left-1/2 -mt-1.5 -ml-2">
                                    <Heart size={16} color="white" fill="white" />
                                </View>
                            </View>
                        </View>
                    </View>

                    <View className="items-center mb-8">
                        <Text className="text-3xl font-extrabold text-[#2d1b69] mb-3">Quasi pronti!</Text>
                        <Text className="text-secondary/80 text-center leading-relaxed font-medium px-4 text-[13px]">
                            AiutarSì funziona meglio quando siamo connessi. Ecco come utilizzeremo i tuoi dati per aiutarti a fare la differenza.
                        </Text>
                    </View>

                    {/* Permissions List (Reduced Size ~20%) */}
                    <View className="gap-3">
                        <View className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex-row items-center">
                            <View className="w-11 h-11 bg-[#f3f0ff] rounded-xl items-center justify-center mr-3">
                                <MapPin size={20} color="#4c1d95" fill="#4c1d95" fillOpacity={0.1} />
                            </View>
                            <View className="flex-1 mr-2">
                                <Text className="text-sm font-bold text-[#2d1b69]">Localizzazione</Text>
                                <Text className="text-[10px] text-secondary leading-tight font-medium" numberOfLines={2}>Trova opportunità vicino a te</Text>
                            </View>
                            <Switch 
                                value={locationEnabled} 
                                onValueChange={toggleLocation}
                                trackColor={{ false: '#e2e8f0', true: '#4c1d95' }}
                                thumbColor="white"
                                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                            />
                        </View>

                        <View className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex-row items-center">
                            <View className="w-11 h-11 bg-pink-50 rounded-xl items-center justify-center mr-3">
                                <Bell size={20} color="#db2777" fill="#db2777" fillOpacity={0.1} />
                            </View>
                            <View className="flex-1 mr-2">
                                <Text className="text-sm font-bold text-[#2d1b69]">Notifiche Push</Text>
                                <Text className="text-[10px] text-secondary leading-tight font-medium" numberOfLines={2}>Ricevi avvisi per nuovi match</Text>
                            </View>
                            <Switch 
                                value={notificationsEnabled} 
                                onValueChange={toggleNotifications}
                                trackColor={{ false: '#e2e8f0', true: '#4c1d95' }}
                                thumbColor="white"
                                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                            />
                        </View>
                    </View>

                    {/* Bottom Indicator */}
                    <View className="mt-12">
                        <TouchableOpacity
                            onPress={startJourney}
                            className="h-16 rounded-2xl flex-row items-center justify-center shadow-xl active:scale-[0.98] bg-[#3b2391]"
                        >
                            <Text className="text-white text-lg font-bold mr-3">Inizia il tuo viaggio</Text>
                            <Rocket size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}
