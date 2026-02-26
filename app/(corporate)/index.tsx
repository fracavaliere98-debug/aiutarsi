import { View, Text, TouchableOpacity } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { TrendingUp, Users, Clock, LogOut } from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { Card } from "../../components/Card";
import { UserAvatar } from "../../components/UserAvatar";
import { StandardLayout } from "../../components/StandardLayout";

export default function CorporateDashboard() {
    const { user, logout } = useAuth();

    const HeaderActions = (
        <View className="flex-row items-center gap-3">
            <UserAvatar size={40} fontSize={14} />
            <TouchableOpacity onPress={logout} className="bg-white/10 p-2 rounded-full">
                <LogOut size={20} color="white" />
            </TouchableOpacity>
        </View>
    );

    return (
        <StandardLayout
            label="Corporate Social Responsibility"
            title={`Dashboard ${user?.companyName || "Azienda"}`}
            rightElement={HeaderActions}
        >
            {/* ESG Highlights */}
            <View className="flex-row gap-2 mb-6">
                <Card className="flex-1 items-center py-4 bg-primary">
                    <TrendingUp color={Colors.accent} size={24} />
                    <Text className="text-2xl font-bold text-white mt-2">4.5k</Text>
                    <Text className="text-[10px] text-white/70 uppercase text-center">Impact Points</Text>
                </Card>
                <Card className="flex-1 items-center py-4">
                    <Clock color={Colors.primary} size={24} />
                    <Text className="text-2xl font-bold text-primary mt-2">120h</Text>
                    <Text className="text-[10px] text-secondary uppercase text-center">Ore Volontariato</Text>
                </Card>
                <Card className="flex-1 items-center py-4">
                    <Users color={Colors.primary} size={24} />
                    <Text className="text-2xl font-bold text-primary mt-2">45</Text>
                    <Text className="text-[10px] text-secondary uppercase text-center">Dipendenti Attivi</Text>
                </Card>
            </View>

            <Text className="text-base font-bold text-primary mb-3">Impatto Recente</Text>
            <Card className="mb-4">
                <View className="flex-row justify-between items-start">
                    <View>
                        <Text className="font-bold text-primary">Mario Rossi</Text>
                        <Text className="text-xs text-secondary">Supporto Logistico</Text>
                    </View>
                    <Text className="text-accent font-bold">+120 pts</Text>
                </View>
            </Card>
            <Card className="mb-4">
                <View className="flex-row justify-between items-start">
                    <View>
                        <Text className="font-bold text-primary">Giulia Verdi</Text>
                        <Text className="text-xs text-secondary">Mentoring Digitale</Text>
                    </View>
                    <Text className="text-accent font-bold">+85 pts</Text>
                </View>
            </Card>
        </StandardLayout>
    );
}
