import { Tabs, useRouter } from "expo-router";
import { Home, Compass, Calendar as CalendarIcon, Globe, User as UserIcon } from "lucide-react-native";
import { useAuth } from "../../../context/AuthContext";
import { TouchableOpacity, View, Text } from "react-native";
import { Colors } from "../../../constants/Colors";

export default function VolunteerTabsLayout() {
    const { user } = useAuth();
    const router = useRouter();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "white",
                    borderTopWidth: 1,
                    borderTopColor: "#f1f5f9",
                    height: 90,
                    paddingBottom: 30,
                    paddingTop: 12,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.05,
                    shadowRadius: 10,
                    elevation: 5,
                    position: 'absolute',
                },
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: "#94a3b8",
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: "700",
                    marginTop: 4,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Home",
                    tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="search"
                options={{
                    title: "Esplora",
                    tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
                }}
            />
            {/* Community – raised center button */}
            <Tabs.Screen
                name="community"
                options={{
                    title: "Community",
                    tabBarIcon: ({ focused }) => (
                        <View style={{
                            width: 56, height: 56, borderRadius: 28,
                            backgroundColor: Colors.primary,
                            alignItems: 'center', justifyContent: 'center',
                            marginTop: -22,
                            shadowColor: Colors.primary,
                            shadowOpacity: 0.4,
                            shadowRadius: 10,
                            elevation: 8,
                        }}>
                            <Globe size={24} color="white" />
                        </View>
                    ),
                    tabBarLabel: () => (
                        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary, marginTop: -2 }}>Community</Text>
                    ),
                }}
            />
            <Tabs.Screen
                name="calendar"
                options={{
                    title: "Calendario",
                    tabBarIcon: ({ color, size }) => <CalendarIcon color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profilo",
                    tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} />,
                }}
            />
            {/* Hidden – map is accessible via Esplora */}
            <Tabs.Screen name="map" options={{ href: null }} />
        </Tabs>
    );
}
