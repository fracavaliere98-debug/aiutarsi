import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bookmark, ChevronLeft, EyeOff, Heart, MapPin, Sparkles } from 'lucide-react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useSmartMatchView } from '../../hooks/smart-match/useSmartMatchView';

export default function SmartMatchScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { matches, isLoading, refresh, saveMatch, hideMatch, likeMatch, markMatchSeen, resetHiddenMatches } = useSmartMatchView(user);
    const [showSavedOnly, setShowSavedOnly] = React.useState(false);

    const visibleMatches = React.useMemo(
        () => (showSavedOnly ? matches.filter((match) => match.saved) : matches),
        [matches, showSavedOnly]
    );

    return (
        <ScreenWrapper edges={['top']} bg="bg-white" withPadding={false}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronLeft size={20} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => void refresh()}>
                        <Text style={{ color: Colors.accent, fontWeight: '700', fontSize: 13 }}>Aggiorna</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ marginBottom: 18 }}>
                    <Text style={{ fontSize: 28, fontWeight: '900', color: Colors.primary, marginBottom: 6 }}>
                        Tutti i tuoi match
                    </Text>
                    <Text style={{ fontSize: 14, lineHeight: 21, color: Colors.secondary }}>
                        Gemma combina fit, prossimità e i segnali che le hai già dato per mostrarti prima le opportunità più promettenti.
                    </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                    <View style={{ backgroundColor: '#f8f4ff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
                        <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '700' }}>Match forti prima</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setShowSavedOnly((current) => !current)}
                        style={{
                            backgroundColor: showSavedOnly ? Colors.info : '#eef2ff',
                            borderRadius: 999,
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                        }}
                    >
                        <Text style={{ color: showSavedOnly ? '#ffffff' : Colors.info, fontSize: 12, fontWeight: '700' }}>
                            Attività salvate
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => void resetHiddenMatches()} style={{ backgroundColor: '#fff1f7', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
                        <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700' }}>Ripristina nascosti</Text>
                    </TouchableOpacity>
                </View>

                {isLoading ? (
                    <Text style={{ color: Colors.secondary, fontSize: 14 }}>Gemma sta aggiornando i suggerimenti…</Text>
                ) : visibleMatches.length === 0 ? (
                    <View style={{ backgroundColor: '#f8fafc', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <Text style={{ color: Colors.primary, fontSize: 16, fontWeight: '800', marginBottom: 6 }}>
                            {showSavedOnly ? 'Nessuna attività salvata' : 'Nessun match disponibile'}
                        </Text>
                        <Text style={{ color: Colors.secondary, fontSize: 13, lineHeight: 20 }}>
                            {showSavedOnly
                                ? 'Salva le attività che vuoi ritrovare più facilmente qui.'
                                : 'Aggiorna bio, interessi o posizione per far lavorare meglio Smart Match.'}
                        </Text>
                    </View>
                ) : (
                    visibleMatches.map((match) => {
                        const activity = match.activity;
                        if (!activity) return null;

                        return (
                            <TouchableOpacity
                                key={match.id}
                                activeOpacity={0.9}
                                onPress={async () => {
                                    await markMatchSeen(match);
                                    router.push(`/activity/${activity.id}` as any);
                                }}
                                style={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: 28,
                                    borderWidth: 1,
                                    borderColor: match.confidence === 'top' ? '#eadcff' : '#eef2f7',
                                    padding: 18,
                                    marginBottom: 14,
                                    shadowColor: '#000',
                                    shadowOpacity: 0.05,
                                    shadowRadius: 10,
                                    shadowOffset: { width: 0, height: 4 },
                                    elevation: 2,
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <View style={{ backgroundColor: match.confidence === 'top' ? '#f8f4ff' : '#f8fafc', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                                        <Text style={{ color: match.confidence === 'top' ? Colors.accent : Colors.primary, fontWeight: '800', fontSize: 11 }}>
                                            {match.confidenceLabel || `${match.score}% match`}
                                        </Text>
                                    </View>
                                    <Text style={{ color: Colors.secondary, fontSize: 12, fontWeight: '700' }}>{match.score}%</Text>
                                </View>

                                <Text style={{ color: Colors.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>
                                    {activity.npoName}
                                </Text>
                                <Text style={{ color: Colors.primary, fontSize: 18, lineHeight: 23, fontWeight: '900', marginBottom: 8 }}>
                                    {activity.title}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                    <MapPin size={13} color={Colors.secondary} />
                                    <Text style={{ color: Colors.secondary, fontSize: 12, flex: 1 }} numberOfLines={1}>
                                        {activity.location.address}
                                    </Text>
                                </View>

                                {!!match.chips?.length && (
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                                        {match.chips.map((chip: string) => (
                                            <View key={chip} style={{ backgroundColor: '#f3f4f6', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                                                <Text style={{ color: Colors.primary, fontSize: 11, fontWeight: '700' }}>{chip}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                <View style={{ backgroundColor: '#f8f4ff', borderRadius: 16, padding: 12, marginBottom: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                                        <Sparkles size={14} color={Colors.accent} style={{ marginTop: 2 }} />
                                        <Text style={{ color: Colors.primary, fontSize: 12, lineHeight: 18, flex: 1 }}>
                                            {match.reason}
                                        </Text>
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                                    <TouchableOpacity onPress={() => likeMatch(match)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff1f7', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}>
                                        <Heart size={14} color={Colors.accent} fill={match.liked ? Colors.accent : 'transparent'} />
                                        <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700' }}>Mi piace</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => saveMatch(match)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#eef2ff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}>
                                        <Bookmark size={14} color={Colors.info} fill={match.saved ? Colors.info : 'transparent'} />
                                        <Text style={{ color: Colors.info, fontSize: 12, fontWeight: '700' }}>Salva</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => hideMatch(match)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f8fafc', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}>
                                        <EyeOff size={14} color={Colors.secondary} />
                                        <Text style={{ color: Colors.secondary, fontSize: 12, fontWeight: '700' }}>Nascondi</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </ScreenWrapper>
    );
}
