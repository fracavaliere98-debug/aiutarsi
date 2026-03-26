import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from "react-native";
import { Clock, Building2, MapPin } from "lucide-react-native";
import { Colors } from "../constants/Colors";

interface EnrolledActivityCardProps {
    activity: any; // We'll use any if type is hard to import perfectly, but better OldActivity
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
}

export function EnrolledActivityCard({ activity, onPress, style }: EnrolledActivityCardProps) {
    const activityDate = new Date(activity.dateTime);
    const month = activityDate.toLocaleDateString("it-IT", { month: "short" }).toUpperCase();
    const day = activityDate.getDate();
    const time = activityDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    const endTime = new Date(activity.endDateTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

    // Extract city from address, assuming format "Street, City, Zip" or just take the whole thing if no comma
    // Real structure: activity.location.address or activity.location
    const address = activity.location?.address || (typeof activity.location === 'string' ? activity.location : '');
    const city = address.split(',')[1]?.trim() || address.split(',')[0]?.trim() || "Città ND";

    const statusProps = (() => {
        switch (activity.status) {
            case "APERTA":
                return { bgColor: "bg-green-50", textColor: "text-green-700" };
            case "IN_CORSO":
                return { bgColor: "bg-yellow-50", textColor: "text-yellow-700" };
            case "COMPLETATA":
                return { bgColor: "bg-emerald-700", textColor: "text-emerald-100" };
            case "CANCELLATA":
                return { bgColor: "bg-red-50", textColor: "text-red-700" };
            default:
                return { bgColor: "bg-gray-50", textColor: "text-gray-700" };
        }
    })();

    return (
        <TouchableOpacity
            style={[{ backgroundColor: 'white', padding: 16 }, style as any]}
            onPress={onPress}
        >
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
                <View>
                    <View style={{ flexDirection: 'row', gap: 14, marginBottom: 12 }}>
                        {/* Date Badge */}
                        <View style={{ width: 56, height: 56, backgroundColor: '#eef2ff', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e0e7ff' }}>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: Colors.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: -2 }}>{month}</Text>
                            <Text style={{ fontSize: 22, fontWeight: '900', color: '#1e1b4b' }}>{day}</Text>
                        </View>

                        <View style={{ flex: 1 }}>
                            <View style={{ backgroundColor: '#f5f3ff', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 6 }}>
                                <Text style={{ fontSize: 9, fontWeight: '900', color: '#4338ca', textTransform: 'uppercase' }}>{activity.category}</Text>
                            </View>
                            <Text style={{ fontSize: 15, fontWeight: '900', color: '#1e1b4b', lineHeight: 20 }} numberOfLines={2}>
                                {activity.title}
                            </Text>
                        </View>
                    </View>

                    <View style={{ gap: 8 }}>
                        {/* Row with Time and Location horizontally aligned */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ backgroundColor: '#f8fafc', padding: 5, borderRadius: 8 }}>
                                    <Clock size={12} color="#64748b" />
                                </View>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>
                                    {time} - {endTime}
                                </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ backgroundColor: '#f8fafc', padding: 5, borderRadius: 8 }}>
                                    <MapPin size={12} color="#64748b" />
                                </View>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }} numberOfLines={1}>
                                    {city}
                                </Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ backgroundColor: '#f8fafc', padding: 5, borderRadius: 8 }}>
                                <Building2 size={12} color="#64748b" />
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }} numberOfLines={1}>
                                {activity.npoName}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={{ paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center' }}>
                    <View className={`${statusProps.bgColor} px-3 py-1.5 rounded-full`}>
                        <Text className={`${statusProps.textColor} text-[10px] font-black uppercase tracking-wider`}>
                            {activity.status}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}
