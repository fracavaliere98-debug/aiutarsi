import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThumbsUp, ThumbsDown, MessageSquare, AlertCircle } from 'lucide-react-native';
import { supabase } from '../../../utils/supabase';
import { colors } from "@/theme";

interface FAQFeedbackStats {
  faq_id: string;
  faq_question: string;
  section_id: string;
  up_votes: number;
  down_votes: number;
  total_votes: number;
}

export default function FAQFeedbackDashboard() {
  const [stats, setStats] = useState<FAQFeedbackStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFeedbackStats();
  }, []);

  const fetchFeedbackStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: sbError } = await supabase
        .from('faq_feedback')
        .select('*');

      if (sbError) throw sbError;

      // Aggregate feedback locally since doing it natively via PostgREST grouping can be complex without an RPC
      const aggregated = (data || []).reduce((acc: Record<string, FAQFeedbackStats>, curr: any) => {
        if (!acc[curr.faq_id]) {
          acc[curr.faq_id] = {
            faq_id: curr.faq_id,
            faq_question: curr.faq_question || curr.faq_id,
            section_id: curr.section_id,
            up_votes: 0,
            down_votes: 0,
            total_votes: 0
          };
        }
        acc[curr.faq_id].total_votes++;
        if (curr.vote === 'up') acc[curr.faq_id].up_votes++;
        if (curr.vote === 'down') acc[curr.faq_id].down_votes++;
        return acc;
      }, {});

      const statsArray = Object.values(aggregated) as FAQFeedbackStats[];
      setStats(statsArray.sort((a, b) => b.total_votes - a.total_votes));
    } catch (err: any) {
      setError(err.message || 'Errore durante il caricamento dei feedback');
    } finally {
      setLoading(false);
    }
  };

  const calculateScoreColor = (up: number, total: number) => {
    if (total === 0) return '#6B7280';
    const pct = up / total;
    if (pct > 0.7) return '#10B981';
    if (pct > 0.4) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={styles.iconBox}>
            <MessageSquare size={24} color={colors.primary} />
          </View>
          <Text style={styles.headerTitle}>Feedback FAQ</Text>
        </View>
        <TouchableOpacity onPress={fetchFeedbackStats} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Aggiorna</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <AlertCircle size={48} color="#EF4444" style={{ marginBottom: 16 }} />
          <Text style={styles.errorText}>Si è verificato un errore</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
          <TouchableOpacity onPress={fetchFeedbackStats} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      ) : stats.length === 0 ? (
        <View style={styles.center}>
          <MessageSquare size={64} color="#E5E7EB" style={{ marginBottom: 16 }} />
          <Text style={styles.emptyText}>Nessun feedback registrato</Text>
          <Text style={styles.emptySubtext}>Gli utenti non hanno ancora valutato le guide.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {stats.map(item => (
            <View key={item.faq_id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.sectionBadge}>{item.section_id.toUpperCase()}</Text>
                <Text style={[
                  styles.scoreText, 
                  { color: calculateScoreColor(item.up_votes, item.total_votes) }
                ]}>
                  {item.total_votes > 0 ? Math.round((item.up_votes / item.total_votes) * 100) : 0}% Utile
                </Text>
              </View>
              
              <Text style={styles.questionText}>{item.faq_question}</Text>
              
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <ThumbsUp size={16} color="#10B981" />
                  <Text style={[styles.statValue, { color: '#047857' }]}>{item.up_votes}</Text>
                </View>
                <View style={styles.statBox}>
                  <ThumbsDown size={16} color="#EF4444" />
                  <Text style={[styles.statValue, { color: '#B91C1C' }]}>{item.down_votes}</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: '#F3F4F6' }]}>
                  <Text style={styles.statLabel}>Totali:</Text>
                  <Text style={styles.statValueTotal}>{item.total_votes}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3E5F5', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  refreshBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F3F4F6', borderRadius: 20 },
  refreshText: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  errorSubtext: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#9CA3AF', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#D1D5DB' },
  list: { padding: 16, gap: 16 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionBadge: { backgroundColor: '#F3F4F6', color: '#4B5563', fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  scoreText: { fontSize: 14, fontWeight: '800' },
  questionText: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16, lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6' },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  statValueTotal: { fontSize: 16, fontWeight: '800', color: '#111827' },
});
