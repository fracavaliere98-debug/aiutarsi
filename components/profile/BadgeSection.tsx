import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SheetModal } from "../SheetModal";
import { Info, X, Clock, Award, Star, CheckCircle2 } from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { useGamification } from "../../context/GamificationContext";

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
    { id: "debt", name: "Debuttante", icon: "🌱", criteria: "Completa la tua prima attività di volontariato.", xp: 100, goal: 1 },
    { id: "pila", name: "Pilastro", icon: "🏛️", criteria: "Completa 10 attività diverse.", xp: 1000, goal: 10 },
    { id: "stac", name: "Stacanovista", icon: "🏎️", criteria: "Partecipa a un'attività della durata superiore a 6 ore.", xp: 200, goal: 1 },
    { id: "tutt", name: "Tuttofare", icon: "🛠️", criteria: "Partecipa ad attività in 3 categorie differenti.", xp: 300, goal: 3 },
    { id: "fede", name: "Fedelissimo", icon: "🗓️", criteria: "Partecipa ad almeno un'attività per 4 settimane diverse.", xp: 600, goal: 4 },
    { id: "vete", name: "Veterano", icon: "🏅", criteria: "Accumula un totale di 100 ore di volontariato certificate.", xp: 1000, goal: 100 },
    { id: "gufo", name: "Gufo Notturno", icon: "🦉", criteria: "Partecipa ad un'attività che inizia tra le 20:00 e le 07:00.", xp: 350, goal: 1 },
    { id: "voce", name: "Voce del Popolo", icon: "📢", criteria: "Condividi 10 attività con i tuoi amici.", xp: 100, goal: 10 },
    { id: "netw", name: "Networker", icon: "🤝", criteria: "Segui almeno 5 diverse organizzazioni (NPO).", xp: 50, goal: 5 },
    { id: "anni", name: "Anniversario", icon: "🎂", criteria: "Rimani attivo nella community per un intero anno.", xp: 1200, goal: 365 },
    { id: "rece", name: "Recensore d'Oro", icon: "🌟", criteria: "Lascia 5 recensioni costruttive a organizzazioni diverse.", xp: 150, goal: 5 },
];

const ProgressBar = ({ progress, label, color = Colors.accent }: { progress: number, label: string, color?: string }) => {
    const clampedProgress = Math.min(100, Math.max(0, progress));
    return (
        <View className="mt-2">
            <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-[10px] font-black text-primary uppercase tracking-tighter">{label}</Text>
                <Text className="text-[10px] font-black text-primary">{Math.round(clampedProgress)}%</Text>
            </View>
            <View className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                <View 
                    style={{ 
                        width: `${clampedProgress}%`, 
                        backgroundColor: color,
                        height: '100%'
                    }} 
                />
            </View>
        </View>
    );
};

export function BadgeSection({ badges }: BadgeSectionProps) {
    const { state } = useGamification();
    const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
    const [showInfoModal, setShowInfoModal] = useState(false);

    const earnedBadgeIds = badges.map(b => b.id);

    const getBadgeProgress = (badgeId: string): { current: number; goal: number; progress: number; label: string } => {
        const badge = ALL_BADGES.find(b => b.id === badgeId);
        if (!badge) return { current: 0, goal: 0, progress: 0, label: "" };

        let current = 0;
        let goal = badge.goal;
        let label = "";

        switch (badgeId) {
            case "debt":
                current = state.completedActivitiesCount >= 1 ? 1 : 0;
                label = `${current}/1 attività`;
                break;
            case "pila":
                current = state.completedActivitiesCount;
                label = `${current}/10 attività`;
                break;
            case "stac":
                current = earnedBadgeIds.includes("stac") ? 1 : 0;
                label = current === 1 ? "Completato" : "Non completato";
                break;
            case "tutt":
                current = state.completedCategories?.length || 0;
                label = `${current}/3 categorie`;
                break;
            case "fede":
                // Estimate weeks from completion dates (simplified)
                const uniqueWeeks = new Set(state.completionDates?.map(d => {
                    const date = new Date(d);
                    const oneJan = new Date(date.getFullYear(), 0, 1);
                    const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
                    return Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
                }));
                current = uniqueWeeks.size;
                label = `${current}/4 settimane`;
                break;
            case "vete":
                current = Math.round(state.totalHours || 0);
                label = `${current}/100 ore`;
                break;
            case "gufo":
                current = earnedBadgeIds.includes("gufo") ? 1 : 0;
                label = current === 1 ? "Completato" : "Non completato";
                break;
            case "voce":
                current = state.sharedActivities?.length || 0;
                label = `${current}/10 condivisioni`;
                break;
            case "netw":
                current = state.followedNPOsHistory?.length || 0;
                label = `${current}/5 NPO seguite`;
                break;
            case "rece":
                current = state.reviewedNpoIds?.length || 0;
                label = `${current}/5 recensioni`;
                break;
            case "anni":
                // This would ideally use the user's registration date
                // For now, we'll mark as binary or placeholder if not in state
                current = earnedBadgeIds.includes("anni") ? 365 : 0;
                label = current === 365 ? "1 anno" : "In corso";
                break;
        }

        return {
            current,
            goal,
            progress: (current / goal) * 100,
            label
        };
    };

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
                                {selectedBadge.dateEarned && (
                                    <View className="flex-row items-center justify-center gap-2 pt-4 border-t border-slate-200/50">
                                        <Clock size={16} color={Colors.secondary} />
                                        <Text className="text-secondary font-bold text-sm">
                                            Ottenuto il {new Date(selectedBadge.dateEarned).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </Text>
                                    </View>
                                )}
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
                            const prog = getBadgeProgress(b.id);

                            return (
                                <View
                                    key={b.id}
                                    className={`p-4 rounded-3xl mb-4 border ${isEarned ? 'bg-indigo-50/50 border-indigo-100' : 'bg-white border-slate-100 shadow-sm shadow-slate-200/40'}`}
                                >
                                    <View className="flex-row items-center">
                                        <View className={`w-14 h-14 rounded-2xl items-center justify-center mr-4 ${isEarned ? 'bg-white' : 'bg-slate-50 border border-slate-100'}`}>
                                            <Text className={`text-2xl ${!isEarned && 'grayscale opacity-50'}`}>{isEarned ? b.icon : b.icon}</Text>
                                        </View>
                                        <View className="flex-1 mr-2">
                                            <View className="flex-row items-center gap-2 mb-0.5">
                                                <Text className={`font-black text-sm ${isEarned ? 'text-primary' : 'text-slate-600'}`}>{b.name}</Text>
                                                {isEarned ? (
                                                    <CheckCircle2 size={14} color="#10b981" />
                                                ) : (
                                                    <Award size={12} color={Colors.secondary} />
                                                )}
                                            </View>
                                            <Text className="text-[11px] text-secondary leading-4 font-medium" numberOfLines={2}>
                                                {b.criteria}
                                            </Text>
                                        </View>
                                        <View className="items-end">
                                            <View className="bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                                                <Text className="text-[10px] font-black text-accent">+{b.xp} XP</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {!isEarned && (
                                        <ProgressBar 
                                            progress={prog.progress} 
                                            label={prog.label}
                                        />
                                    )}
                                    {isEarned && (
                                        <View className="mt-3 pt-3 border-t border-indigo-100/50 flex-row items-center gap-2">
                                            <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <Text className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Badge Sbloccato</Text>
                                        </View>
                                    )}
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
