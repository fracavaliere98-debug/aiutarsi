import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../utils/supabase';
import { useAuth } from '../../../context/AuthContext';
import { 
  ChevronLeft, ShieldAlert, User, ShieldCheck, 
  MessageCircle, Clock, CheckCircle2, AlertTriangle, 
  EyeOff, Bot, Trash2, Ban
} from 'lucide-react-native';
import { useNotifications } from '../../../context/NotificationContext';

const formatDate = (dateString: string, includeYear = false) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return includeYear 
    ? `${day} ${month} ${year}, ${hours}:${minutes}`
    : `${day} ${month}, ${hours}:${minutes}`;
};

interface AuditLog {
  id: string;
  action_type: string;
  reason: string;
  created_at: string;
}

export default function AdminReportDetail() {
  const { id } = useLocalSearchParams();
  const { user: adminUser } = useAuth();
  const { addNotification } = useNotifications();
  const [report, setReport] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const router = useRouter();

  const fetchDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          reporter:profiles!reports_reporter_id_fkey(*),
          reported:profiles!reports_reported_id_fkey(*)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      setReport(data);

      // Fetch audit logs for the reported user
      const { data: logs } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .eq('target_id', data.reported_id)
        .order('created_at', { ascending: false })
        .limit(5);
      setAuditLogs(logs || []);
    } catch (error) {
      console.error('Error fetching report detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleAction = async (action: 'dismissed' | 'warned' | 'resolved' | 'banned', reason: string) => {
    if (actionLoading) return;
    setActionLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('reports')
        .update({ 
          status: action,
          admin_id: adminUser?.id,
          resolution_date: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Se è un BAN, aggiorna il profilo
      if (action === 'banned') {
        const { error: banError } = await supabase
          .from('profiles')
          .update({ 
            is_banned: true, 
            ban_reason: reason,
            ban_report_id: id // L'ID della segnalazione corrente
          })
          .eq('id', report.reported_id);
        if (banError) throw banError;
      }

      // Log dell'azione nell'Audit Log
      await supabase.from('admin_audit_logs').insert({
        admin_id: adminUser?.id,
        target_id: report.reported_id,
        action_type: action.toUpperCase(),
        reason: reason,
        ip_address: '0.0.0.0', // In una vera app prenderesti l'IP lato server
        user_agent: `${Platform.OS} ${Platform.Version}`
      });

      Alert.alert('Successo', `Azione "${action}" completata.`);

      // Invia notifica al segnalatore (reporter)
      if (report?.reporter_id) {
        addNotification({
          userId: report.reporter_id,
          type: 'SUCCESS',
          title: 'Aggiornamento Segnalazione',
          message: 'Abbiamo gestito la tua segnalazione.'
        });
      }

      router.back();
    } catch (error: any) {
      Alert.alert('Errore', error.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#311b92" /></View>;
  if (!report) return <View style={styles.centered}><Text>Segnalazione non trovata.</Text></View>;

  const reportedRecidiveCount = auditLogs.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Dettaglio Segnalazione</Text>
          <Text style={styles.headerSubtitle}>ID: {id?.toString().slice(0, 8)}</Text>
        </View>
        <TouchableOpacity style={styles.iconButton}>
           <Bot size={20} color={report.is_ai_generated ? "#8B5CF6" : "#D1D5DB"} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {reportedRecidiveCount > 0 && (
          <View style={styles.alertBanner}>
            <AlertTriangle size={20} color="#EF4444" style={{ marginRight: 10 }} />
            <Text style={styles.alertText}>
              Questo utente ha ricevuto {reportedRecidiveCount} segnalazioni in passato.
            </Text>
          </View>
        )}

        {/* User Sections */}
        <View style={styles.userSection}>
          <Text style={styles.sectionLabel}>UTENTE SEGNALATO</Text>
          <TouchableOpacity 
            style={styles.userCard}
            onPress={() => router.push(`/user-profile/${report.reported_id}` as any)}
            activeOpacity={0.7}
          >
            <View style={styles.avatarCircle}>
              <User size={24} color="#311b92" />
            </View>
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{report.reported?.full_name || 'Anonimo'}</Text>
                <View style={styles.trustBadge}>
                  <Text style={styles.trustText}>TRUST 85%</Text>
                </View>
              </View>
              <Text style={styles.userId}>ID: {report.reported_id.slice(0, 12)}...</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.userSection}>
          <Text style={styles.sectionLabel}>SEGNALATO DA</Text>
          <TouchableOpacity 
            style={styles.userCardMini}
            onPress={() => router.push(`/user-profile/${report.reporter_id}` as any)}
            activeOpacity={0.7}
          >
            <View style={styles.avatarCircleSmall}>
              <User size={18} color="#6B7280" />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userNameSmall}>{report.reporter?.full_name || 'Anonimo'}</Text>
              <Text style={styles.userId}>ID: {report.reporter_id.slice(0, 12)}...</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Content Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONTENUTO SEGNALATO</Text>
          <View style={styles.evidenceBubble}>
             <Text style={styles.evidenceText}>{report.description || report.reason}</Text>
          </View>
        </View>

        {/* Evidence Snapshot (Chat) */}
        {report.evidence_snapshot && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CHAT EVIDENCE (SNAOPSHOT)</Text>
            <View style={styles.chatContainer}>
              {Array.isArray(report.evidence_snapshot) ? report.evidence_snapshot.map((msg: any, idx: number) => (
                <View key={idx} style={[
                  styles.chatBubble, 
                  msg.sender_id === report.reported_id ? styles.reportedBubble : styles.reporterBubble
                ]}>
                  <Text style={styles.chatText}>{msg.content}</Text>
                </View>
              )) : (
                <Text style={styles.noEvidenceText}>Nessuno snapshot disponibile o formato errato.</Text>
              )}
            </View>
          </View>
        )}

        {/* Audit Log */}
        {auditLogs.length > 0 && (
          <View style={styles.section}>
             <Text style={styles.sectionLabel}>RECENT ACTIONS ON THIS TARGET</Text>
             {auditLogs.map(log => (
               <View key={log.id} style={styles.logItem}>
                  <Text style={styles.logAction}>{log.action_type}</Text>
                  <Text style={styles.logDate}>{formatDate(log.created_at)}</Text>
               </View>
             ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Action Grid */}
      <View style={styles.footerActions}>
        <View style={styles.actionGrid}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.grayButton]} 
            onPress={() => handleAction('dismissed', 'Azione ignorata dall\'admin')}
            disabled={actionLoading}
          >
            <CheckCircle2 size={24} color="#111827" />
            <Text style={styles.actionButtonText}>Ignora</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.yellowButton]} 
            onPress={() => handleAction('warned', 'Utente avvertito')}
            disabled={actionLoading}
          >
            <AlertTriangle size={24} color="#F59E0B" />
            <Text style={[styles.actionButtonText, { color: '#F59E0B' }]}>Avvertimento</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.orangeButton]} 
            onPress={() => handleAction('resolved', 'Contenuto nascosto')}
            disabled={actionLoading}
          >
            <EyeOff size={24} color="#F97316" />
            <Text style={[styles.actionButtonText, { color: '#F97316' }]}>Nascondi</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.redButton]} 
            onPress={() => handleAction('banned', 'Utente bannato per violazione termini')}
            disabled={actionLoading}
          >
            <Ban size={24} color="white" />
            <Text style={[styles.actionButtonText, { color: 'white' }]}>BAN</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20 },
  alertBanner: { backgroundColor: '#FEF2F2', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#FEE2E2' },
  alertText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#EF4444' },
  userSection: { marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', marginBottom: 12, letterSpacing: 1 },
  userCard: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  userCardMini: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F3E5F5', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarCircleSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  userName: { fontSize: 16, fontWeight: '700', color: '#111827', marginRight: 8 },
  userNameSmall: { fontSize: 14, fontWeight: '700', color: '#111827' },
  trustBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  trustText: { fontSize: 10, fontWeight: '800', color: '#166534' },
  userId: { fontSize: 11, color: '#9CA3AF' },
  section: { marginBottom: 24 },
  evidenceBubble: { backgroundColor: '#F3F4F6', padding: 16, borderRadius: 16 },
  evidenceText: { fontSize: 15, color: '#111827', lineHeight: 22 },
  chatContainer: { padding: 10, backgroundColor: '#F9FAFB', borderRadius: 20 },
  chatBubble: { maxWidth: '85%', padding: 12, borderRadius: 16, marginBottom: 8 },
  reportedBubble: { backgroundColor: '#FEE2E2', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  reporterBubble: { backgroundColor: '#E5E7EB', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  chatText: { fontSize: 14, color: '#111827' },
  noEvidenceText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginVertical: 10 },
  logItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  logAction: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  logDate: { fontSize: 13, color: '#9CA3AF' },
  footerActions: { padding: 20, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionButton: { flex: 1, minWidth: '45%', height: 74, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 6 },
  grayButton: { backgroundColor: '#F3F4F6' },
  yellowButton: { backgroundColor: '#FEF3C7' },
  orangeButton: { backgroundColor: '#FFEDD5' },
  redButton: { backgroundColor: '#EF4444' },
  actionButtonText: { fontSize: 13, fontWeight: '800', color: '#111827' }
});
