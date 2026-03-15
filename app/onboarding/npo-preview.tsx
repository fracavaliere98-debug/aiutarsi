import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Dimensions,
    Image,
    StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, ArrowRight, CheckCircle2, Globe, MapPin, Share2, ShieldCheck, User } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeInRight } from 'react-native-reanimated';
import { UserAvatar } from '../../components/UserAvatar';

const { width } = Dimensions.get('window');

export default function NPOPreviewScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const handleContinue = () => {
        router.push('/onboarding/welcome');
    };

    const categories = user?.interests || [];
    const soughtSkills = user?.sought_skills || [];
    
    const isVerified = user?.verification_status === 'verified';
    const isPending = user?.verification_status === 'pending';
    const badgeColor = isVerified ? '#8B5CF6' : (isPending ? Colors.primary : '#606080');
    const badgeText = isVerified ? 'Bollino Viola' : (isPending ? 'In attesa di verifica' : 'Profilo non verificato');

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header / Hero */}
                <View style={styles.hero}>
                    <Image 
                        source={{ uri: 'https://images.unsplash.com/photo-1559027615-cd937c9be54a?q=80&w=1000&auto=format&fit=crop' }} 
                        style={styles.heroBackground}
                    />
                    <LinearGradient 
                        colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)']}
                        style={styles.heroGradient}
                    />
                    
                    <View style={styles.heroContent}>
                        <Animated.View entering={FadeInUp.delay(200)}>
                            <UserAvatar 
                                size={90} 
                                name={user?.npo_name || user?.name || "NPO"} 
                                avatarUrl={(user?.avatar_url || user?.avatar) as string | undefined}
                                fontSize={32}
                            />
                        </Animated.View>
                        <Text style={styles.npoName}>{user?.npo_name || user?.name}</Text>
                        <View style={[styles.verificationBadge, { backgroundColor: isVerified ? '#8B5CF630' : 'rgba(255,255,255,0.2)' }]}>
                            <ShieldCheck size={16} color={isVerified ? '#8B5CF6' : "white"} />
                            <Text style={styles.verificationText}>{badgeText}</Text>
                        </View>
                    </View>
                </View>

                {/* Profile Stats mock */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>0</Text>
                        <Text style={styles.statLabel}>Progetti</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>0</Text>
                        <Text style={styles.statLabel}>Volontari</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>-</Text>
                        <Text style={styles.statLabel}>Ranking</Text>
                    </View>
                </View>

                {/* Info Sections */}
                <View style={styles.infoContent}>
                    {/* Mission */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>La Nostra Missione</Text>
                        <Text style={styles.missionText}>
                            {user?.bio || "Nessuna missione inserita."}
                        </Text>
                    </View>

                    {/* Meta Info */}
                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <MapPin size={18} color={Colors.primary} />
                            <Text style={styles.metaText} numberOfLines={1}>{user?.address_full || "Indirizzo non specificato"}</Text>
                        </View>
                        {user?.website && (
                            <View style={styles.metaItem}>
                                <Globe size={18} color={Colors.primary} />
                                <Text style={styles.metaText} numberOfLines={1}>{user.website}</Text>
                            </View>
                        )}
                    </View>

                    {/* Categories (Interests) */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Aree di Intervento</Text>
                        <View style={styles.tagCloud}>
                            {categories.map((cat, i) => (
                                <View key={i} style={styles.tag}>
                                    <Text style={styles.tagText}>{cat}</Text>
                                </View>
                            ))}
                            {categories.length === 0 && <Text style={styles.emptyText}>Nessun settore selezionato</Text>}
                        </View>
                    </View>

                    {/* Referent */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Il tuo referente in AiutarSì</Text>
                        <View style={styles.referentCard}>
                            <UserAvatar 
                                size={50} 
                                name={user?.referent_name || "R"} 
                                avatarUrl={user?.referent_avatar_url as string | undefined}
                                fontSize={20}
                            />
                            <View style={styles.referentInfo}>
                                <Text style={styles.referentName}>{user?.referent_name || "Non specificato"}</Text>
                                <Text style={styles.referentRole}>{user?.referent_role || "Referente Ente"}</Text>
                            </View>
                            <TouchableOpacity style={styles.referentChatIcon}>
                                <Share2 size={20} color={Colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Seeking */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Skill più ricercate</Text>
                        <View style={styles.skillList}>
                            {soughtSkills.map((skill, i) => (
                                <View key={i} style={styles.skillItem}>
                                    <CheckCircle2 size={16} color={Colors.accent} />
                                    <Text style={styles.skillLabel}>{skill}</Text>
                                </View>
                            ))}
                            {soughtSkills.length === 0 && <Text style={styles.emptyText}>Nessuna skill selezionata</Text>}
                        </View>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity 
                    onPress={() => router.back()}
                    style={styles.backButton}
                >
                    <ArrowLeft size={24} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={handleContinue}
                    style={styles.button}
                >
                    <Text style={styles.buttonText}>Sembra Perfetto!</Text>
                    <ArrowRight size={22} color="white" strokeWidth={2.5} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingBottom: 120,
    },
    hero: {
        height: 320,
        position: 'relative',
        justifyContent: 'flex-end',
        padding: 24,
    },
    heroBackground: {
        ...StyleSheet.absoluteFillObject,
    },
    heroGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    heroContent: {
        alignItems: 'center',
    },
    npoName: {
        fontSize: 28,
        fontWeight: '900',
        color: 'white',
        marginTop: 12,
        textAlign: 'center',
    },
    verificationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 8,
    },
    verificationText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        paddingVertical: 20,
        backgroundColor: '#F8F9FB',
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: '900',
        color: Colors.primary,
    },
    statLabel: {
        fontSize: 12,
        color: Colors.secondary,
        marginTop: 2,
    },
    divider: {
        width: 1,
        height: '60%',
        backgroundColor: '#DDDDDD',
        alignSelf: 'center',
    },
    infoContent: {
        padding: 24,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1A1A40',
        marginBottom: 12,
    },
    missionText: {
        fontSize: 15,
        color: '#404060',
        lineHeight: 24,
    },
    metaRow: {
        backgroundColor: '#F0F0F5',
        borderRadius: 20,
        padding: 16,
        gap: 12,
        marginBottom: 24,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    metaText: {
        fontSize: 14,
        color: '#1A1A40',
        fontWeight: '600',
        flex: 1,
    },
    tagCloud: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        backgroundColor: `${Colors.primary}10`,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: `${Colors.primary}20`,
    },
    tagText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.primary,
    },
    referentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#EEEEEE',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    referentInfo: {
        flex: 1,
        marginLeft: 12,
    },
    referentName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1A1A40',
    },
    referentRole: {
        fontSize: 13,
        color: Colors.secondary,
    },
    referentChatIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F0F0F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    skillList: {
        gap: 10,
    },
    skillItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    skillLabel: {
        fontSize: 14,
        color: '#404060',
        fontWeight: '500',
    },
    emptyText: {
        fontSize: 14,
        fontStyle: 'italic',
        color: '#A0A0B0',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        paddingBottom: 30,
        backgroundColor: 'rgba(255,255,255,0.9)',
        flexDirection: 'row',
        gap: 16,
    },
    backButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#EEEEEE',
    },
    button: {
        flex: 1,
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
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
});
