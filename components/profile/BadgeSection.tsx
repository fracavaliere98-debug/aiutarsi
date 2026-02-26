import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SheetModal } from "../SheetModal";
import { Info, X, Clock, Award, Star } from "lucide-react-native";
import { Colors } from "../../constants/Colors";

interface Badge {
    id: string;
    name: string;
    icon: string;
    description: string;
    dateEarned: string;
    color: string;
}

interface BadgeSectionProps {
    badges: Badge[];
}

const ALL_BADGES = [
    { id: "debt", name: "Debuttante", icon: "🌱", criteria: "Completa la tua prima attività di volontariato.", xp: 100 },
    { id: "pila", name: "Pilastro", icon: "🏛️", criteria: "Completa 10 attività diverse.", xp: 1000 },
    { id: "stac", name: "Stacanovista", icon: "🏎️", criteria: "Partecipa a un'attività della durata superiore a 6 ore.", xp: 200 },
    { id: "tutt", name: "Tuttofare", icon: "🛠️", criteria: "Partecipa ad attività in 3 categorie differenti.", xp: 300 },
    { id: "fede", name: "Fedelissimo", icon: "🗓️", criteria: "Partecipa ad almeno un'attività per 4 settimane consecutive.", xp: 600 },
    { id: "vete", name: "Veterano", icon: "🏅", criteria: "Accumula un totale di 100 ore di volontariato certificate.", xp: 1000 },
    { id: "gufo", name: "Gufo Notturno", icon: "🦉", criteria: "Partecipa ad un'attività che inizia tra le 20:00 e le 07:00.", xp: 350 },
    { id: "voce", name: "Voce del Popolo", icon: "📢", criteria: "Condividi 10 attività con i tuoi amici.", xp: 100 },
    { id: "netw", name: "Networker", icon: "🤝", criteria: "Segui almeno 5 diverse organizzazioni (NPO).", xp: 50 },
    { id: "anni", name: "Anniversario", icon: "🎂", criteria: "Rimani attivo nella community per un intero anno.", xp: 1200 },
    { id: "rece", name: "Recensore d'Oro", icon: "🌟", criteria: "Lascia 5 recensioni costruttive a organizzazioni diverse.", xp: 150 },
];

export function BadgeSection({ badges }: BadgeSectionProps) {
    const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
    const [showInfoModal, setShowInfoModal] = useState(false);

    const earnedBadgeIds = badges.map(b => b.id);

    return (
        <View className="px-6 mb-8">
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-black text-primary">Badge Sbloccati</Text>
                <TouchableOpacity
                    onPress={() => setShowInfoModal(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}
                >
                    <Text style={{ fontSize: 11, color: '#1e1b4b', fontWeight: '800', lineHeight: 14 }}>{badges.length} / 11</Text>
                    <Info size={11} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {badges.length === 0 ? (
                <TouchableOpacity
                    onPress={() => setShowInfoModal(true)}
                    className="bg-gray-50 rounded-2xl p-6 items-center border border-gray-100 border-dashed"
                >
                    <Text className="text-4xl mb-2 opacity-50">🔒</Text>
                    <Text className="text-gray-400 font-medium text-center text-sm">
                        Nessun badge sbloccato ancora. Clicca per scoprire come ottenerli!
                    </Text>
                </TouchableOpacity>
            ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {badges.map(badge => (
                        <TouchableOpacity
                            key={badge.id}
                            onPress={() => setSelectedBadge(badge)}
                            activeOpacity={0.7}
                            style={{
                                flex: 1,
                                minWidth: '45%',
                                height: 140,
                                borderRadius: 24,
                                padding: 16,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: '#e0e7ff',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.05,
                                shadowRadius: 4,
                                elevation: 2,
                            }}
                            className={badge.color || 'bg-indigo-50'}
                        >
                            <Text style={{ fontSize: 32, marginBottom: 8 }}>{badge.icon}</Text>
                            <Text style={{ fontSize: 11, fontWeight: '800', textAlign: 'center', color: '#1e1b4b', marginBottom: 4 }} numberOfLines={1}>
                                {badge.name}
                            </Text>
                            <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'center', lineHeight: 13 }} numberOfLines={2}>
                                {badge.description}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Modal: Badge Detail */}
            <SheetModal visible={!!selectedBadge} onClose={() => setSelectedBadge(null)}>
                <View className="flex-1 bg-white px-8 pt-10">
                    <View className="flex-row justify-between items-center mb-8">
                        <Text className="text-2xl font-black text-primary">Dettaglio Badge</Text>
                        <TouchableOpacity onPress={() => setSelectedBadge(null)} className="p-2 bg-slate-100 rounded-full">
                            <X size={20} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {selectedBadge && (
                        <View className="items-center">
                            <View className={`${selectedBadge.color || 'bg-indigo-50'} w-32 h-32 rounded-[40px] items-center justify-center mb-6 shadow-xl border border-indigo-100`}>
                                <Text className="text-7xl">{selectedBadge.icon}</Text>
                            </View>

                            <Text className="text-3xl font-black text-primary mb-2">{selectedBadge.name}</Text>
                            <View className="bg-emerald-100 px-4 py-1.5 rounded-full mb-6">
                                <Text className="text-emerald-700 font-black text-xs uppercase tracking-widest">Sbloccato</Text>
                            </View>

                            <View className="bg-slate-50 p-6 rounded-[32px] w-full border border-slate-100 mb-6">
                                <Text className="text-secondary text-center text-base font-medium leading-6 mb-4">
                                    {ALL_BADGES.find(b => b.id === selectedBadge.id)?.criteria ?? selectedBadge.description}
                                </Text>
                                <View className="flex-row items-center justify-center gap-2 pt-4 border-t border-slate-200/50">
                                    <Clock size={16} color={Colors.secondary} />
                                    <Text className="text-secondary font-bold text-sm">
                                        Ottenuto il {new Date(selectedBadge.dateEarned).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={() => setSelectedBadge(null)}
                                className="bg-primary w-full py-5 rounded-2xl items-center shadow-lg shadow-primary/20"
                            >
                                <Text className="text-white font-black text-lg">Chiudi</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </SheetModal>

            {/* Modal: All Badges Info */}
            <SheetModal visible={showInfoModal} onClose={() => setShowInfoModal(false)}>
                <View className="flex-1 bg-white px-8 pt-10">
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <Text className="text-2xl font-black text-primary">Tutti i Badge</Text>
                            <Text className="text-secondary font-semibold text-sm">Scopri come scalare la classifica</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowInfoModal(false)} className="p-2 bg-slate-100 rounded-full">
                            <X size={20} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
                        <Text className="text-xs font-black text-accent uppercase tracking-widest mb-4">Guida agli Obiettivi</Text>

                        {ALL_BADGES.map((b, index) => {
                            const isEarned = earnedBadgeIds.includes(b.id);
                            return (
                                <View
                                    key={b.id}
                                    className={`flex-row items-center p-4 rounded-3xl mb-3 border ${isEarned ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-100 opacity-70'}`}
                                >
                                    <View className={`w-14 h-14 rounded-2xl items-center justify-center mr-4 ${isEarned ? 'bg-white' : 'bg-slate-200'}`}>
                                        <Text className={`text-2xl ${!isEarned && 'grayscale opacity-50'}`}>{isEarned ? b.icon : '🔒'}</Text>
                                    </View>
                                    <View className="flex-1 mr-2">
                                        <View className="flex-row items-center gap-2 mb-0.5">
                                            <Text className={`font-black text-sm ${isEarned ? 'text-primary' : 'text-slate-400'}`}>{b.name}</Text>
                                            {isEarned && <Award size={12} color={Colors.accent} />}
                                        </View>
                                        <Text className="text-[11px] text-secondary leading-4 font-medium" numberOfLines={2}>
                                            {b.criteria}
                                        </Text>
                                    </View>
                                    <View className="items-end">
                                        <View className="bg-white px-2 py-1 rounded-lg border border-slate-100">
                                            <Text className="text-[10px] font-black text-accent">+{b.xp} XP</Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}

                        <View className="bg-amber-50 p-6 rounded-[32px] border border-amber-100 mt-4">
                            <View className="flex-row items-center gap-3 mb-2">
                                <Star size={20} color="#b45309" fill="#f59e0b" />
                                <Text className="font-black text-amber-900">Il Tuo Progresso</Text>
                            </View>
                            <Text className="text-amber-800 text-xs leading-5 font-medium">
                                Hai sbloccato {badges.length} badge su 11. Continua così per diventare un volontario leggendario!
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            </SheetModal>
        </View>
    );
}
