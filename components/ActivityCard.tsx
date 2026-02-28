import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from "react-native";
import { Clock, Building2, MapPin } from "lucide-react-native";
import { Colors } from "../constants/Colors";
import { SoftCard } from "./SoftCard";
import { UserAvatar } from "./UserAvatar";
import { useAuth } from "../context/AuthContext";

interface ActivityCardProps {
    activity: any;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
}

export function ActivityCard({ activity, onPress, style }: ActivityCardProps) {
    const { users, user } = useAuth();
    const activityDate = new Date(activity.dateTime);
    const month = activityDate.toLocaleDateString("it-IT", { month: "short" }).toUpperCase();
    const day = activityDate.getDate();
    const time = activityDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    const endTime = new Date(activity.endDateTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

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
        <SoftCard
            className="bg-white p-4"
            style={style as any}
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
                                <Text style={{ fontSize: 9, fontWeight: '900', color: '#4338ca', textTransform: 'uppercase' }}>{activity.category || 'Generale'}</Text>
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
                                {activity.npoName || 'NPO'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={{ paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View className={`${statusProps.bgColor} px-3 py-1.5 rounded-full mr-3`}>
                            <Text className={`${statusProps.textColor} text-[10px] font-black uppercase tracking-wider`}>
                                {activity.status}
                            </Text>
                        </View>
                        {activity.iscritti && activity.iscritti.length > 0 ? (
                            <View className="flex-row -space-x-2">
                                {activity.iscritti.slice(0, 3).map((volId: string, idx: number) => {
                                    const volunteer = users.find((u: any) => u.id === volId);
                                    return (
                                        <View key={volId} style={{ zIndex: 10 - idx }}>
                                            <UserAvatar
                                                size={24}
                                                fontSize={10}
                                                name={volunteer?.name || "V"}
                                                avatarUrl={volunteer?.avatar}
                                            />
                                        </View>
                                    );
                                })}
                                {activity.iscritti.length > 3 && (
                                    <View className="w-6 h-6 rounded-full bg-gray-100 items-center justify-center border border-white" style={{ zIndex: 0 }}>
                                        <Text className="text-[8px] font-bold text-gray-500">+{activity.iscritti.length - 3}</Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            <Text className="text-secondary/60 text-[10px] font-medium italic">Ancora nessun iscritto</Text>
                        )}
                    </View>
                    {user?.role === 'VOLUNTEER' ? (
                        <Text className="text-accent font-bold text-xs">CANDIDATI &rarr;</Text>
                    ) : user?.role === 'NPO' && activity.npoId === user.id ? (
                        <Text className="text-primary font-bold text-xs uppercase">GESTISCI &rarr;</Text>
                    ) : (
                        <View className="bg-slate-100 px-2.5 py-1 rounded-lg">
                            <Text className="text-slate-400 text-[10px] font-black uppercase">INFO</Text>
                        </View>
                    )}
                </View>
            </View>
        </SoftCard>
    );
}
