import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from "react-native";
import { Clock, Building2, MapPin, RefreshCw } from "lucide-react-native";
import { Colors } from "../constants/Colors";
import { SoftCard } from "./SoftCard";
import { UserAvatar } from "./UserAvatar";
import { useAuth } from "../context/AuthContext";

interface ActivityCardProps {
    activity: any;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
}

const MAX_AVATARS = 3;
const AVATAR_SIZE = 22;
const OVERLAP = 5;

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

    const iscritti: string[] = activity.iscritti || [];
    const visibleAvatars = iscritti.slice(0, MAX_AVATARS);
    const overflowCount = iscritti.length - MAX_AVATARS;

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

                {/* Bottom row — left side flex:1 keeps action button from overflowing */}
                <View style={{ paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center' }}>
                    {/* Left: status + recurrence + avatars — flex:1 so it doesn't spill into right */}
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden', marginRight: 8 }}>
                        <View className={`${statusProps.bgColor} px-2 py-1 rounded-full mr-2`} style={{ flexShrink: 0 }}>
                            <Text className={`${statusProps.textColor} text-[10px] font-black uppercase tracking-wider`}>
                                {activity.status}
                            </Text>
                        </View>
                        {activity.recurrence && activity.recurrence !== 'NONE' && (
                            <View className="flex-row items-center gap-1 bg-indigo-50 px-2 py-1 rounded-full mr-2" style={{ flexShrink: 0 }}>
                                <RefreshCw size={9} color="#4f46e5" />
                                <Text className="text-indigo-600 text-[9px] font-black uppercase">
                                    {activity.recurrence === 'WEEKLY' ? 'Sett.' : 'Mens.'}
                                </Text>
                            </View>
                        )}
                        {/* Avatar stack — static, no onLayout */}
                        {visibleAvatars.length > 0 && (
                            <View style={{ flexDirection: 'row', flexShrink: 1 }}>
                                {visibleAvatars.map((volId: string, idx: number) => {
                                    const volunteer = users.find((u: any) => u.id === volId);
                                    return (
                                        <View key={volId} style={{ marginLeft: idx === 0 ? 0 : -OVERLAP, zIndex: 20 - idx }}>
                                            <UserAvatar
                                                size={AVATAR_SIZE}
                                                fontSize={9}
                                                name={volunteer?.name || "V"}
                                                avatarUrl={volunteer?.avatar}
                                            />
                                        </View>
                                    );
                                })}
                                {overflowCount > 0 && (
                                    <View
                                        style={{
                                            marginLeft: -OVERLAP, zIndex: 0,
                                            width: AVATAR_SIZE, height: AVATAR_SIZE,
                                            borderRadius: AVATAR_SIZE / 2,
                                            backgroundColor: '#e2e8f0',
                                            alignItems: 'center', justifyContent: 'center',
                                            borderWidth: 1.5, borderColor: 'white',
                                        }}
                                    >
                                        <Text style={{ fontSize: 8, fontWeight: '900', color: '#64748b' }}>+{overflowCount}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Right: action button — flexShrink:0 so it never overflows */}
                    <View style={{ flexShrink: 0 }}>
                        {user?.role === 'VOLUNTEER' ? (
                            <Text className="text-accent font-bold text-xs">CANDIDATI →</Text>
                        ) : user?.role === 'NPO' && activity.npoId === user.id ? (
                            <Text className="text-primary font-bold text-xs uppercase">GESTISCI →</Text>
                        ) : (
                            <View className="bg-slate-100 px-2.5 py-1 rounded-lg">
                                <Text className="text-slate-400 text-[10px] font-black uppercase">INFO</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </SoftCard>
    );
}
