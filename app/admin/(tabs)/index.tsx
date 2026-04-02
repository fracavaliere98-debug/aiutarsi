import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../utils/supabase';
import { Shield, ChevronRight, Search, Bell, Menu, Filter, Bot } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const month = months[date.getMonth()];
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month}, ${hours}:${minutes}`;
};

interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  description: string;
  status: 'pending' | 'resolved' | 'dismissed' | 'banned';
  created_at: string;
  is_ai_generated: boolean;
  reporter: { full_name: string; avatar_url: string };
  reported: { full_name: string; avatar_url: string };
  report_category?: string;
}

export default function AdminDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [onlyAi, setOnlyAi] = useState(false);
  const [onlyWithDescription, setOnlyWithDescription] = useState(false);
  const router = useRouter();

  const fetchReports = useCallback(async () => {
    try {
      let query = supabase
        .from('reports')
        .select(`
          *,
          reporter:profiles!reports_reporter_id_fkey(full_name, avatar_url),
          reported:profiles!reports_reported_id_fkey(full_name, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (activeTab === 'pending') {
        query = query.eq('status', 'pending');
      } else {
        query = query.in('status', ['resolved', 'dismissed', 'banned', 'warned']);
      }

      const { data, error } = await query;
      if (error) throw error;
      setReports((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [fetchReports])
  );

  const reportCategories = useMemo(() => (
    Array.from(new Set(
      reports
        .map((report) => (report.report_category || 'ALTRO').toUpperCase())
        .filter(Boolean)
    ))
  ), [reports]);

  const filteredReports = useMemo(() => (
    reports.filter((report) => {
      const term = search.toLowerCase();
      const reportCategory = (report.report_category || 'ALTRO').toUpperCase();
      const matchesSearch =
        report.reason.toLowerCase().includes(term)
        || report.reporter?.full_name?.toLowerCase().includes(term)
        || report.reported?.full_name?.toLowerCase().includes(term)
        || reportCategory.toLowerCase().includes(term);

      const matchesCategory = selectedCategory === 'all' || reportCategory === selectedCategory;
      const matchesAi = !onlyAi || !!report.is_ai_generated;
      const matchesDescription = !onlyWithDescription || !!report.description?.trim();

      return matchesSearch && matchesCategory && matchesAi && matchesDescription;
    })
  ), [reports, search, selectedCategory, onlyAi, onlyWithDescription]);

  const getCategoryColor = (category: string) => {
    switch (category?.toUpperCase()) {
      case 'SPAM': return '#EF4444';
      case 'MOLESTIE': return '#F59E0B';
      case 'FALSA IDENTITÀ': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/admin/settings')}>
          <Menu size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Segnalazioni AiutarSi</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/admin/notifications')}>
          {reports.some((report) => report.status === 'pending') ? <View style={styles.notiBadge} /> : null}
          <Bell size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'pending' && styles.activeTab]} onPress={() => setActiveTab('pending')}>
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Da gestire</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'resolved' && styles.activeTab]} onPress={() => setActiveTab('resolved')}>
          <Text style={[styles.tabText, activeTab === 'resolved' && styles.activeTabText]}>Risolti</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={20} color="#9CA3AF" style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca motivo o utente..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9CA3AF"
          />
        </View>
        <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters((prev) => !prev)}>
          <Filter size={20} color="white" />
        </TouchableOpacity>
      </View>

      {showFilters ? (
        <View style={styles.filtersWrap}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['all', ...reportCategories]}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const active = selectedCategory === item;
              return (
                <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setSelectedCategory(item)}>
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {item === 'all' ? 'Tutte le categorie' : item}
                  </Text>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.filterListContent}
          />
          <View style={styles.booleanFiltersRow}>
            <TouchableOpacity style={[styles.filterChip, onlyAi && styles.filterChipActive]} onPress={() => setOnlyAi((prev) => !prev)}>
              <Text style={[styles.filterChipText, onlyAi && styles.filterChipTextActive]}>Solo AI</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterChip, onlyWithDescription && styles.filterChipActive]} onPress={() => setOnlyWithDescription((prev) => !prev)}>
              <Text style={[styles.filterChipText, onlyWithDescription && styles.filterChipTextActive]}>Con descrizione</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#311b92" />
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(); }} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.reportCard} onPress={() => router.push(`/admin/report/${item.id}`)}>
              <View style={styles.cardHeader}>
                <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.report_category || 'ALTRO') }]}>
                  <Text style={styles.categoryText}>{(item.report_category || 'ALTRO').toUpperCase()}</Text>
                </View>
                <Text style={styles.timestamp}>{formatDate(item.created_at)}</Text>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.userRow}>
                  <Text style={styles.userLabel}>Segnalato da</Text>
                  <Text style={styles.userName}>{item.reporter?.full_name || 'Utente'}</Text>
                </View>
                <View style={styles.userRow}>
                  <Text style={styles.userLabel}>Contro</Text>
                  <Text style={styles.userNameTarget}>{item.reported?.full_name || 'Utente'}</Text>
                </View>

                <Text style={styles.description} numberOfLines={2}>
                  {item.description || item.reason}
                </Text>
              </View>

              <View style={styles.cardFooter}>
                {item.is_ai_generated ? (
                  <View style={styles.aiBadge}>
                    <Bot size={12} color="#8B5CF6" style={{ marginRight: 4 }} />
                    <Text style={styles.aiBadgeText}>AI</Text>
                  </View>
                ) : <View />}
                <View style={styles.arrowCircle}>
                  <ChevronRight size={18} color="#9CA3AF" />
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={(
            <View style={styles.emptyContainer}>
              <Shield size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>Nessuna segnalazione trovata</Text>
            </View>
          )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  notiBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    zIndex: 1,
    borderWidth: 2,
    borderColor: 'white',
  },
  tabsContainer: {
    flexDirection: 'row',
    padding: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 25,
    marginHorizontal: 20,
    marginVertical: 15,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 21 },
  activeTab: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  activeTabText: { color: '#111827' },
  searchContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 12, gap: 12 },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 15,
  },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 16, color: '#111827' },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: '#311b92',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersWrap: { marginBottom: 12 },
  filterListContent: { paddingHorizontal: 20, gap: 8 },
  booleanFiltersRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 10 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#EEF2F7',
  },
  filterChipActive: { backgroundColor: '#311b92' },
  filterChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  filterChipTextActive: { color: 'white' },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryText: { color: 'white', fontSize: 10, fontWeight: '800' },
  timestamp: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  cardBody: { marginBottom: 14 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  userLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600', width: 88 },
  userName: { fontSize: 14, color: '#111827', fontWeight: '700', flex: 1 },
  userNameTarget: { fontSize: 14, color: '#DC2626', fontWeight: '700', flex: 1 },
  description: { fontSize: 14, color: '#4B5563', lineHeight: 20, marginTop: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3E8FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  aiBadgeText: { color: '#8B5CF6', fontSize: 11, fontWeight: '800' },
  arrowCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#9CA3AF', fontWeight: '600' },
});
