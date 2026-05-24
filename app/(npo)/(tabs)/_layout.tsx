import { Tabs } from "expo-router";
import { LayoutDashboard, Users, Calendar, User, Globe } from "lucide-react-native";
import { View, Text, TouchableOpacity, GestureResponderEvent } from "react-native";
import { colors } from "@/theme";

export default function NPOTabsLayout() {
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
                    paddingHorizontal: 20,
                },
                tabBarItemStyle: {
                    marginHorizontal: -10,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: "#94a3b8",
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: "700",
                    marginTop: 4,
                }
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Dashboard",
                    tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
                    tabBarButton: (props) => (
                        <TouchableOpacity
                            testID="tab-home"
                            onPress={props.onPress as (e: GestureResponderEvent) => void}
                            style={props.style as any}
                            accessibilityRole="button"
                        >
                            {props.children}
                        </TouchableOpacity>
                    ),
                }}
            />
            <Tabs.Screen
                name="volunteers"
                options={{
                    title: "Volontari",
                    tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
                    tabBarButton: (props) => (
                        <TouchableOpacity
                            testID="tab-volunteers"
                            onPress={props.onPress as (e: GestureResponderEvent) => void}
                            style={props.style as any}
                            accessibilityRole="button"
                        >
                            {props.children}
                        </TouchableOpacity>
                    ),
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
                            backgroundColor: colors.primary,
                            alignItems: 'center', justifyContent: 'center',
                            marginTop: -22,
                            shadowColor: colors.primary,
                            shadowOpacity: 0.4,
                            shadowRadius: 10,
                            elevation: 8,
                        }}>
                            <Globe size={24} color="white" />
                        </View>
                    ),
                    tabBarLabel: () => (
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, marginTop: 10 }}>Community</Text>
                    ),
                }}
            />
            <Tabs.Screen
                name="projects"
                options={{
                    title: "Attività",
                    tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profilo",
                    tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
                }}
            />
        </Tabs>
    );
}
