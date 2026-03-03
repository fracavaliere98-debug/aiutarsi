import { Tabs } from "expo-router";
import { LayoutDashboard, Users, Calendar, Settings, Globe } from "lucide-react-native";
import { Colors } from "../../../constants/Colors";
import { View, Text } from "react-native";

export default function NPOTabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "white",
                    borderTopWidth: 1,
                    borderTopColor: "#f1f5f9",
                    height: 85,
                    paddingBottom: 25,
                    paddingTop: 10,
                },
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: "#94a3b8",
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: "700",
                }
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Dashboard",
                    tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="volunteers"
                options={{
                    title: "Volontari",
                    tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
                }}
            />
            {/* Community – raised center button */}
            <Tabs.Screen
                name="community"
                options={{
                    title: "Community",
                    tabBarIcon: ({ focused }) => (
                        <View style={{
                            width: 52, height: 52, borderRadius: 26,
                            backgroundColor: Colors.primary,
                            alignItems: 'center', justifyContent: 'center',
                            marginTop: -20,
                            shadowColor: Colors.primary,
                            shadowOpacity: 0.35,
                            shadowRadius: 10,
                            elevation: 8,
                        }}>
                            <Globe size={22} color="white" />
                        </View>
                    ),
                    tabBarLabel: () => (
                        <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.primary, marginTop: -2 }}>Community</Text>
                    ),
                }}
            />
            <Tabs.Screen
                name="projects"
                options={{
                    title: "Calendario",
                    tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Impostazioni",
                    tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
                }}
            />
        </Tabs>
    );
}
