import { Tabs, useRouter } from "expo-router";
import { Home, Compass, Calendar as CalendarIcon, Map as MapIcon, User as UserIcon } from "lucide-react-native";
import { useAuth } from "../../../context/AuthContext";

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
                tabBarActiveTintColor: "#311b92",
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
            <Tabs.Screen
                name="calendar"
                options={{
                    title: "Calendario",
                    tabBarIcon: ({ color, size }) => <CalendarIcon color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="map"
                options={{
                    title: "Mappa",
                    tabBarIcon: ({ color, size }) => <MapIcon color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profilo",
                    tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} />,
                }}
            />
        </Tabs>
    );
}
