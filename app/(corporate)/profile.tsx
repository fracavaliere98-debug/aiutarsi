import { View, Text, TouchableOpacity } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { UserAvatar } from "../../components/UserAvatar";
import { Settings, Bell, Shield, LogOut, ChevronRight, Mail, Building } from "lucide-react-native";
import { Card } from "../../components/Card";
import { StandardLayout } from "../../components/StandardLayout";
import { useRouter } from "expo-router";

export default function CorporateProfileScreen() {
    const { user, logout } = useAuth();

    const menuItems = [
        { icon: Building, label: "Dati Aziendali", color: "#6366f1" },
        { icon: Bell, label: "Notifiche ESG", color: "#3b82f6" },
        { icon: Shield, label: "Sicurezza Account", color: "#10b981" },
    ];

    return (
        <StandardLayout
            label="Gestione Azienda"
            title={`Profilo ${user?.companyName || "Azienda"}`}
            rightElement={<UserAvatar size={40} fontSize={14} />}
        >
            {/* Header Info moved to Body for consistency and same height */}
            <View className="flex-row items-center gap-5 mb-8 bg-white p-6 rounded-[32px] shadow-sm border border-gray-50">
                <UserAvatar size={64} fontSize={22} />
                <View className="flex-1">
                    <Text className="text-primary font-black text-xl" numberOfLines={1}>{user?.companyName || "Azienda Partner"}</Text>
                    <View className="flex-row items-center gap-2 mt-1">
                        <Mail size={14} color="#64748b" />
                        <Text className="text-secondary text-sm font-medium">{user?.email}</Text>
                    </View>
                </View>
            </View>
            <Card className="mb-6">
                <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-primary font-black text-lg">Dati Registrati</Text>
                    <Settings size={20} color="#64748b" />
                </View>

                {menuItems.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        className={`flex-row items-center justify-between py-4 ${index !== menuItems.length - 1 ? 'border-b border-gray-50' : ''}`}
                    >
                        <View className="flex-row items-center gap-4">
                            <View style={{ backgroundColor: item.color + '20' }} className="p-2.5 rounded-xl">
                                <item.icon size={20} color={item.color} />
                            </View>
                            <Text className="text-primary font-bold text-base">{item.label}</Text>
                        </View>
                        <ChevronRight size={18} color="#cbd5e1" />
                    </TouchableOpacity>
                ))}
            </Card>

            <TouchableOpacity
                onPress={async () => {
                    await logout();
                }}
                className="flex-row items-center justify-center gap-3 bg-white py-5 rounded-2xl border border-red-100 mb-12 shadow-sm active:scale-95"
            >
                <LogOut size={20} color="#ef4444" />
                <Text className="text-red-500 font-black text-lg">Esci dall&apos;Account</Text>
            </TouchableOpacity>
        </StandardLayout>
    );
}
