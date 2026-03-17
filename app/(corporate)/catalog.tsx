import { View, Text, TouchableOpacity, ScrollView, TextInput, Share } from "react-native";
import { useActivities } from "../../context/ActivityContext";
import { Search, Share2, Sparkles, Filter, MapPin, Building2 } from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { Card } from "../../components/Card";
import { StandardLayout } from "../../components/StandardLayout";
import { useState } from "react";

export default function CorporateCatalog() {
    const { activities } = useActivities();
    const [searchQuery, setSearchQuery] = useState("");

    const filteredActivities = activities.filter(a =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.npoName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSuggest = async (act: any) => {
        try {
            await Share.share({
                message: `👐 ${act.title}\nTi suggerisco questa attività di volontariato aziendale tramite AiutarSì!\n\n📱 Apri direttamente nell'app:\naiutarsiapp://activity/${act.id}\n\n🌐 Oppure visualizza sul web:\nhttps://aiutarsi.app/activity/${act.id}`,
            });
        } catch (error) {
            console.error("Error sharing activity:", error);
        }
    };

    return (
        <StandardLayout
            label="Corporate Social Responsibility"
            title="Catalogo Attività NPO"
            bg="bg-background-light"
        >
            {/* Search */}
            <View className="bg-white rounded-2xl flex-row items-center px-4 py-3 mb-6 shadow-sm border border-primary/5">
                <Search size={20} color={Colors.secondary} />
                <TextInput
                    className="flex-1 ml-3 text-primary font-medium"
                    placeholder="Cerca attività o NPO..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                <TouchableOpacity className="bg-primary/5 p-2 rounded-xl">
                    <Filter size={18} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text className="text-lg font-black text-primary mb-4">Disponibili per il sugerimento ({filteredActivities.length})</Text>

                {filteredActivities.map((act) => (
                    <Card key={act.id} className="mb-6 border-0 shadow-lg overflow-hidden p-0">
                        <View className="p-5">
                            <View className="flex-row justify-between items-start mb-4">
                                <View className="flex-1">
                                    <View className="flex-row items-center gap-2 mb-1">
                                        <Building2 size={12} color={Colors.secondary} />
                                        <Text className="text-secondary text-[10px] font-bold uppercase tracking-widest">{act.npoName}</Text>
                                    </View>
                                    <Text className="text-xl font-black text-primary leading-tight">{act.title}</Text>
                                </View>
                                <View className="bg-accent/10 px-3 py-1.5 rounded-full">
                                    <Text className="text-accent font-bold text-[10px] uppercase">{act.category}</Text>
                                </View>
                            </View>

                            <View className="flex-row items-center gap-4 mb-5">
                                <View className="flex-row items-center gap-1.5">
                                    <MapPin size={14} color={Colors.secondary} />
                                    <Text className="text-secondary text-xs">{act.location.address}</Text>
                                </View>
                                <View className="flex-row items-center gap-1.5">
                                    <Sparkles size={14} color={Colors.primary} />
                                    <Text className="text-primary font-bold text-[10px]">95% ESG Impact</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={() => handleSuggest(act)}
                                className="bg-primary flex-row items-center justify-center py-4 rounded-xl gap-2 active:scale-95"
                            >
                                <Share2 size={18} color="white" />
                                <Text className="text-white font-black">Suggerisci ai Dipendenti</Text>
                            </TouchableOpacity>
                        </View>
                    </Card>
                ))}
            </ScrollView>
        </StandardLayout>
    );
}
