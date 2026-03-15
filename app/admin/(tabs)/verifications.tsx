import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl, Alert } from 'react-native';
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
      Alert.alert('Errore', 'Impossibile caricare le richieste di verifica.');
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

  const filteredRequests = requests.filter(r => {
    const term = search.toLowerCase();
    const npoName = r.npo_details?.npo_name || r.profiles?.npo_name || '';
    const fullName = r.profiles?.full_name || '';
    return npoName.toLowerCase().includes(term) || fullName.toLowerCase().includes(term);
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#3B82F6'; // Blue
      case 'approved': return '#10B981'; // Green
      case 'rejected': return '#EF4444'; // Red
      default: return '#6B7280';
    }
  };

  const renderItem = ({ item }: { item: VerificationRequest }) => (
    <TouchableOpacity 
      style={styles.requestCard}
      onPress={() => router.push(`/admin/verification/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
        <View style={styles.timeRow}>
          <Clock size={12} color="#9CA3AF" style={{ marginRight: 4 }} />
          <Text style={styles.timestamp}>
            {formatDate(item.created_at)}
          </Text>
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
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => Alert.alert('Menu', 'Funzionalità menu in arrivo.')}>
          <Menu size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verifiche Enti</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => Alert.alert('Notifiche', 'Non ci sono nuove notifiche admin.')}>
          <Bell size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Pendenti</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>Completate</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Filter */}
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
        <TouchableOpacity style={styles.filterButton} onPress={() => Alert.alert('Filtri', 'Filtri avanzati non ancora implementati.')}>
          <Filter size={20} color="white" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#311b92" />
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ShieldCheck size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>Nessuna richiesta trovata</Text>
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
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    backgroundColor: 'white'
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  tabsContainer: { 
    flexDirection: 'row', 
    padding: 4, 
    backgroundColor: '#F3F4F6', 
    borderRadius: 25, 
    marginHorizontal: 20,
    marginVertical: 15
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 21 },
  activeTab: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  activeTabText: { color: '#111827' },
  searchContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 15, gap: 12 },
  searchInputWrapper: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F3F4F6', 
    borderRadius: 15 
  },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 16, color: '#111827' },
  filterButton: { 
    width: 48, 
    height: 48, 
    backgroundColor: '#311b92', 
    borderRadius: 15, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  requestCard: { 
    backgroundColor: 'white', 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: 'white', fontSize: 10, fontWeight: '800' },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timestamp: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  cardBody: { marginBottom: 16 },
  npoRow: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { 
    width: 44, 
    height: 44, 
    backgroundColor: '#F3E5F5', 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 12
  },
  npoInfo: { flex: 1 },
  npoName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  requesterName: { fontSize: 13, color: '#6B7280' },
  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderTopWidth: 1, 
    borderTopColor: '#F3F4F6', 
    paddingTop: 12 
  },
  detailLink: { fontSize: 13, fontWeight: '600', color: '#311b92' },
  arrowCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { marginTop: 12, fontSize: 16, color: '#9CA3AF', fontWeight: '500' }
});
