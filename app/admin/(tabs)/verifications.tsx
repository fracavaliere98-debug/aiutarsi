import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../utils/supabase';
import { ShieldCheck, ChevronRight, Search, Bell, Menu, Filter, Building2, Clock } from 'lucide-react-native';
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

interface VerificationRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  npo_details: {
    npo_name: string;
    vat_id?: string;
    address?: string;
  };
  profiles?: {
    full_name: string;
    npo_name: string;
  };
}

export default function AdminVerifications() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [showFilters, setShowFilters] = useState(false);
  const [withVatIdOnly, setWithVatIdOnly] = useState(false);
  const [recentOnly, setRecentOnly] = useState(false);
  const [missingAddressOnly, setMissingAddressOnly] = useState(false);
  const router = useRouter();

  const fetchRequests = useCallback(async () => {
    try {
      let query = supabase
        .from('verification_requests')
        .select(`
          *,
          profiles:user_id(full_name, npo_name)
        `)
        .order('created_at', { ascending: false });

      if (activeTab === 'pending') {
        query = query.eq('status', 'pending');
      } else {
        query = query.in('status', ['approved', 'rejected']);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRequests((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching verification requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      fetchRequests();
    }, [fetchRequests])
  );

  const filteredRequests = useMemo(() => (
    requests.filter((request) => {
      const term = search.toLowerCase();
      const npoName = request.npo_details?.npo_name || request.profiles?.npo_name || '';
      const fullName = request.profiles?.full_name || '';
      const matchesSearch = npoName.toLowerCase().includes(term) || fullName.toLowerCase().includes(term);
      const createdAt = new Date(request.created_at).getTime();
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const matchesVat = !withVatIdOnly || !!request.npo_details?.vat_id;
      const matchesRecent = !recentOnly || createdAt >= sevenDaysAgo;
      const matchesAddress = !missingAddressOnly || !request.npo_details?.address;
      return matchesSearch && matchesVat && matchesRecent && matchesAddress;
    })
  ), [requests, search, withVatIdOnly, recentOnly, missingAddressOnly]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#3B82F6';
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/admin/settings')}>
          <Menu size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verifiche Enti</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/admin/notifications')}>
          {requests.some((request) => request.status === 'pending') ? <View style={styles.notiBadge} /> : null}
          <Bell size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'pending' && styles.activeTab]} onPress={() => setActiveTab('pending')}>
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Pendenti</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'completed' && styles.activeTab]} onPress={() => setActiveTab('completed')}>
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>Completate</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={20} color="#9CA3AF" style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca ente o utente..."
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
          <View style={styles.booleanFiltersRow}>
            <TouchableOpacity style={[styles.filterChip, withVatIdOnly && styles.filterChipActive]} onPress={() => setWithVatIdOnly((prev) => !prev)}>
              <Text style={[styles.filterChipText, withVatIdOnly && styles.filterChipTextActive]}>Con P.IVA/CF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterChip, recentOnly && styles.filterChipActive]} onPress={() => setRecentOnly((prev) => !prev)}>
              <Text style={[styles.filterChipText, recentOnly && styles.filterChipTextActive]}>Ultimi 7 giorni</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterChip, missingAddressOnly && styles.filterChipActive]} onPress={() => setMissingAddressOnly((prev) => !prev)}>
              <Text style={[styles.filterChipText, missingAddressOnly && styles.filterChipTextActive]}>Indirizzo mancante</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#311b92" />
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.requestCard} onPress={() => router.push(`/admin/verification/${item.id}`)}>
              <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                  <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
                </View>
                <View style={styles.timeRow}>
                  <Clock size={12} color="#9CA3AF" style={{ marginRight: 4 }} />
                  <Text style={styles.timestamp}>{formatDate(item.created_at)}</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.npoRow}>
                  <View style={styles.iconContainer}>
                    <Building2 size={20} color="#311b92" />
                  </View>
                  <View style={styles.npoInfo}>
                    <Text style={styles.npoName} numberOfLines={1}>
                      {item.npo_details?.npo_name || item.profiles?.npo_name || item.profiles?.full_name || 'Ente non specificato'}
                    </Text>
                    <Text style={styles.requesterName}>
                      Richiesto da: {item.profiles?.full_name || 'Utente'}
                    </Text>
                    <Text style={styles.metaLine}>
                      {item.npo_details?.vat_id ? 'P.IVA/CF presente' : 'P.IVA/CF assente'} · {item.npo_details?.address ? 'indirizzo presente' : 'indirizzo assente'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.detailLink}>Vedi dettagli</Text>
                <View style={styles.arrowCircle}>
                  <ChevronRight size={18} color="#9CA3AF" />
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={(
            <View style={styles.emptyContainer}>
              <ShieldCheck size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>Nessuna richiesta trovata</Text>
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
  filtersWrap: { marginBottom: 12, paddingHorizontal: 20 },
  booleanFiltersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  requestCard: {
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
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: 'white', fontSize: 10, fontWeight: '800' },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timestamp: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  cardBody: { marginBottom: 14 },
  npoRow: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  npoInfo: { flex: 1 },
  npoName: { fontSize: 15, color: '#111827', fontWeight: '800', marginBottom: 4 },
  requesterName: { fontSize: 13, color: '#4B5563', marginBottom: 4 },
  metaLine: { fontSize: 12, color: '#6B7280' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLink: { fontSize: 13, fontWeight: '700', color: '#311b92' },
  arrowCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#9CA3AF', fontWeight: '600' },
});
