import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../utils/supabase';
import { Shield, ChevronRight, Search, Bell, Menu, Filter, Info, Bot } from 'lucide-react-native';
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

  const filteredReports = reports.filter(r => 
    r.reason.toLowerCase().includes(search.toLowerCase()) ||
    r.reporter?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.reported?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getCategoryColor = (category: string) => {
    switch (category?.toUpperCase()) {
      case 'SPAM': return '#EF4444';
      case 'MOLESTIE': return '#F59E0B';
      case 'FALSA IDENTITÀ': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const renderItem = ({ item }: { item: Report }) => (
    <TouchableOpacity 
      style={styles.reportCard}
      onPress={() => router.push(`/admin/report/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.report_category || 'ALTRO') }]}>
          <Text style={styles.categoryText}>{(item.report_category || 'ALTRO').toUpperCase()}</Text>
        </View>
        <Text style={styles.timestamp}>
          {formatDate(item.created_at)}
        </Text>
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
         {item.is_ai_generated && (
          <View style={styles.aiBadge}>
            <Bot size={12} color="#8B5CF6" style={{ marginRight: 4 }} />
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        )}
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
        <Text style={styles.headerTitle}>Segnalazioni AiutarSi</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => Alert.alert('Notifiche', 'Non ci sono nuove notifiche admin.')}>
          <View style={styles.notiBadge} />
          <Bell size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Da gestire</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'resolved' && styles.activeTab]}
          onPress={() => setActiveTab('resolved')}
        >
          <Text style={[styles.tabText, activeTab === 'resolved' && styles.activeTabText]}>Risolti</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={20} color="#9CA3AF" style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
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
          data={filteredReports}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(); }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Shield size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>Nessuna segnalazione trovata</Text>
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
    borderColor: 'white'
  },
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
  reportCard: { 
    backgroundColor: 'white', 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryText: { color: 'white', fontSize: 10, fontWeight: '800' },
  timestamp: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  cardBody: { marginBottom: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  userLabel: { fontSize: 13, color: '#6B7280', marginRight: 6 },
  userName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  userNameTarget: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  description: { fontSize: 14, color: '#4B5563', marginTop: 4, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  arrowCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  aiBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F5F3FF', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 8,
    marginRight: 10
  },
  aiBadgeText: { fontSize: 10, fontWeight: '800', color: '#8B5CF6' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { marginTop: 12, fontSize: 16, color: '#9CA3AF', fontWeight: '500' }
});
