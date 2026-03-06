import { Tabs, useRouter, useSegments, Redirect } from "expo-router";
import { BarChart3, Users, Award, User } from 'lucide-react-native';
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { useEffect } from "react";

export default function CorporateLayout() {
    const { user } = useAuth();
    const router = useRouter();


    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: Colors.primary,
                    borderTopWidth: 0,
                    height: 70,
                    paddingBottom: 10,
                    paddingTop: 10,
                },
                tabBarActiveTintColor: Colors.accent,
                tabBarInactiveTintColor: "rgba(255, 255, 255, 0.5)",
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "ESG Dashboard",
                    tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="catalog"
                options={{
                    title: "Catalogo CSR",
                    tabBarIcon: ({ color, size }) => <Award color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="employees"
                options={{
                    title: "Dipendenti",
                    tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
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
