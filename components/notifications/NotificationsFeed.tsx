import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import {
  AlertCircle,
  Bell,
  BellRing,
  CalendarClock,
  ChartColumnIncreasing,
  CheckCircle,
  FileText,
  HeartHandshake,
  Info,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react-native";
import { SoftCard } from "../SoftCard";
import { EmptyState } from "../EmptyState";
import { AppNotification } from "../../hooks/notifications/types";
import { colors } from "@/theme";

function getNotificationIcon(type: string, title?: string) {
  switch (type) {
    case "ACTIVITY_UPDATE":
      return { Icon: AlertCircle, color: colors.accent };
    case "ACTIVITY_COMPLETED":
      return { Icon: CheckCircle, color: "#22c55e" };
    case "ACTIVITY_REMINDER":
      return { Icon: CalendarClock, color: colors.primary };
    case "REVIEW_REMINDER":
      return { Icon: HeartHandshake, color: "#db2777" };
    case "FOLLOWED_NPO_ACTIVITY":
      return { Icon: Bell, color: colors.primary };
    case "VOLUNTEER_WEEKLY_RECAP":
    case "NPO_WEEKLY_RECAP":
      return { Icon: ChartColumnIncreasing, color: "#7c3aed" };
    case "VOLUNTEER_ENROLLED":
      return { Icon: Users, color: colors.accent };
    case "APPLICATION_RECEIVED":
      return { Icon: FileText, color: colors.primary };
    case "APPLICATION_APPROVED":
    case "APPLICATION_REJECTED":
      return { Icon: CheckCircle, color: "#22c55e" };
    case "SUCCESS":
      return { Icon: CheckCircle, color: "#22c55e" };
    case "URGENT":
      return { Icon: BellRing, color: "#ef4444" };
    case "SKILL_MATCH":
    case "BADGE_UNLOCKED":
    case "GAMIFICATION_REMIND":
      return { Icon: Sparkles, color: colors.accent };
    case "CHAT_MESSAGE":
      return { Icon: MessageCircle, color: colors.primary };
    case "INFO":
    default:
      if (title?.startsWith("Nuovo messaggio da")) {
        return { Icon: MessageCircle, color: colors.primary };
      }
      return { Icon: Info, color: colors.accent };
  }
}

function formatRelativeTime(timestamp: string) {
  const now = new Date();
  const notifDate = new Date(timestamp);
  const diffMs = now.getTime() - notifDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Adesso";
  if (diffMins < 60) return `${diffMins} min fa`;
  if (diffHours < 24) return `${diffHours} ore fa`;
  if (diffDays === 1) return "1 giorno fa";
  return `${diffDays} giorni fa`;
}

export function NotificationsFeed({
  notifications,
  onOpen,
}: {
  notifications: AppNotification[];
  onOpen: (notification: AppNotification) => void | Promise<void>;
}) {
  const sortedNotifications = useMemo(
    () => [...notifications].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [notifications]
  );
  const unreadCount = sortedNotifications.filter((notification) => !notification.read).length;

  if (sortedNotifications.length === 0) {
    return (
      <EmptyState
        emoji="🔔"
        title="Nessuna notifica"
        description="Ti avviseremo quando succede qualcosa di importante!"
      />
    );
  }

  return (
    <View>
      <SoftCard className="mb-4 px-4 py-3 rounded-[24px] bg-white border border-primary/5">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-[11px] font-black tracking-[2px] uppercase text-secondary/50">
              Centro Notifiche
            </Text>
            <Text className="mt-1 text-base font-black text-primary">
              {unreadCount > 0 ? `${unreadCount} nuove da controllare` : "Tutto aggiornato"}
            </Text>
          </View>
          <View className="h-11 min-w-[44px] rounded-2xl bg-accent/10 items-center justify-center px-3">
            <Text className="text-accent text-xl font-black">{unreadCount}</Text>
          </View>
        </View>
      </SoftCard>

      {sortedNotifications.map((notification) => {
        const { Icon, color } = getNotificationIcon(notification.type, notification.title);

        return (
          <TouchableOpacity
            key={notification.id}
            activeOpacity={0.92}
            onPress={() => {
              void onOpen(notification);
            }}
          >
            <SoftCard
              className={`mb-4 overflow-hidden rounded-[28px] border ${notification.read ? "border-primary/5 bg-white/90" : "border-accent/20 bg-white"}`}
            >
              <View className="flex-row">
                <View className={`w-1.5 ${notification.read ? "bg-transparent" : "bg-accent"}`} />
                <View className="flex-1 p-4">
                  <View className="flex-row items-start gap-4">
                    <View style={{ backgroundColor: `${color}14` }} className="h-12 w-12 rounded-2xl items-center justify-center">
                      <Icon size={20} color={color} />
                    </View>

                    <View className="flex-1">
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                          <Text className="text-primary text-[15px] font-black leading-5" numberOfLines={2}>
                            {notification.title}
                          </Text>
                        </View>
                        <View className="bg-slate-100 rounded-full px-2.5 py-1">
                          <Text className="text-[10px] font-bold uppercase text-secondary/70">
                            {formatRelativeTime(notification.timestamp)}
                          </Text>
                        </View>
                      </View>

                      <Text className="mt-2 text-[14px] leading-5 text-secondary/80">
                        {notification.message}
                      </Text>

                      <View className="mt-3 flex-row items-center justify-end">
                        {!notification.read && (
                          <View className="flex-row items-center gap-2">
                            <View className="h-2.5 w-2.5 rounded-full bg-accent" />
                            <Text className="text-[11px] font-black uppercase tracking-[1.5px] text-accent">
                              Non letta
                            </Text>
                          </View>
                        )}
                        {notification.read && (
                          <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary/45">
                            Letta
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </SoftCard>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
