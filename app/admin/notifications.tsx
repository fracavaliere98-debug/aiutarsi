import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Bell, ChevronLeft, ChevronRight, ShieldAlert, ShieldCheck, UserRound } from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../context/AuthContext';

type AdminInboxItem = {
  id: string;
  kind: 'report' | 'verification' | 'personal';
  title: string;
  message: string;
  created_at: string;
  unread: boolean;
  href?: string;
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function AdminNotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<AdminInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInbox = useCallback(async () => {
    try {
      const [reportsRes, verificationsRes, personalNotificationsRes] = await Promise.all([
        supabase
          .from('reports')
          .select('id, reason, report_category, created_at, status, reporter:profiles!reports_reporter_id_fkey(full_name), reported:profiles!reports_reported_id_fkey(full_name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('verification_requests')
          .select('id, created_at, status, npo_details, profiles:user_id(full_name, npo_name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(8),
        user?.id
          ? supabase
              .from('notifications')
              .select('id, title, message, created_at, is_read')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (reportsRes.error) throw reportsRes.error;
      if (verificationsRes.error) throw verificationsRes.error;
      if (personalNotificationsRes.error) throw personalNotificationsRes.error;

      const reportItems: AdminInboxItem[] = (reportsRes.data || []).map((report: any) => ({
        id: `report-${report.id}`,
        kind: 'report',
        title: 'Nuova segnalazione da gestire',
        message: `${report.reported?.full_name || 'Utente'} segnalato da ${report.reporter?.full_name || 'utente'} · ${report.report_category || report.reason}`,
        created_at: report.created_at,
        unread: true,
        href: `/admin/report/${report.id}`,
      }));

      const verificationItems: AdminInboxItem[] = (verificationsRes.data || []).map((request: any) => ({
        id: `verification-${request.id}`,
        kind: 'verification',
        title: 'Nuova verifica ente in attesa',
        message: `${request.npo_details?.npo_name || request.profiles?.npo_name || request.profiles?.full_name || 'Ente'} richiede revisione`,
        created_at: request.created_at,
        unread: true,
        href: `/admin/verification/${request.id}`,
      }));

      const personalItems: AdminInboxItem[] = (personalNotificationsRes.data || []).map((notification: any) => ({
        id: `personal-${notification.id}`,
        kind: 'personal',
        title: notification.title || 'Notifica amministratore',
        message: notification.message || 'Aggiornamento di sistema',
        created_at: notification.created_at,
        unread: !notification.is_read,
      }));

      const merged = [...reportItems, ...verificationItems, ...personalItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setItems(merged);
    } catch (error) {
      console.error('Error loading admin inbox:', error);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadInbox();
    }, [loadInbox])
  );

  const unreadCount = useMemo(() => items.filter((item) => item.unread).length, [items]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Inbox admin</Text>
          <Text style={styles.headerSubtitle}>{unreadCount} aggiornamenti da leggere</Text>
        </View>
        <View style={styles.headerBadge}>
          <Bell size={18} color="#311b92" />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#311b92" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadInbox(); }} />}
          renderItem={({ item }) => {
            const icon = item.kind === 'report'
              ? <ShieldAlert size={18} color="#dc2626" />
              : item.kind === 'verification'
                ? <ShieldCheck size={18} color="#2563eb" />
                : <UserRound size={18} color="#7c3aed" />;

            return (
              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.card}
                onPress={() => {
                  if (item.href) {
                    router.push(item.href as any);
                  }
                }}
              >
                <View style={styles.cardIcon}>{icon}</View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                  </View>
                  <Text style={styles.cardMessage}>{item.message}</Text>
                </View>
                {item.href ? <ChevronRight size={18} color="#9CA3AF" /> : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Bell size={42} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Nessun aggiornamento recente</Text>
              <Text style={styles.emptyText}>Qui compariranno segnalazioni, verifiche e notifiche personali dell’area admin.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  listContent: { padding: 20, paddingBottom: 28 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#111827' },
  cardDate: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  cardMessage: { fontSize: 13, lineHeight: 19, color: '#4B5563' },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 28 },
  emptyTitle: { marginTop: 14, fontSize: 17, fontWeight: '800', color: '#111827' },
  emptyText: { marginTop: 8, fontSize: 14, lineHeight: 21, color: '#6B7280', textAlign: 'center' },
});
