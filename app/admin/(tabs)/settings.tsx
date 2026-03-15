import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { User, LogOut, ChevronRight, ShieldCheck } from 'lucide-react-native';

export default function AdminSettingsScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Il Tuo Profilo Admin</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatarPlaceholder}>
            <User size={40} color="#311b92" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{user?.full_name || user?.name || 'Administrator'}</Text>
            <View style={styles.roleBadge}>
              <ShieldCheck size={14} color="white" style={{ marginRight: 4 }} />
              <Text style={styles.roleText}>ADMINISTRATOR</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Profilo', 'Modifica profilo admin non disponibile.')}>
            <View style={styles.menuLeft}>
              <User size={20} color="#4B5563" />
              <Text style={styles.menuText}>Modifica Profilo</Text>
            </View>
            <ChevronRight size={20} color="#D1D5DB" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <LogOut size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Esci dall&apos;Area Admin</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  content: { padding: 20 },
  profileCard: { backgroundColor: 'white', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 30, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  avatarPlaceholder: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#F3E5F5', justifyContent: 'center', alignItems: 'center', marginRight: 20 },
  profileInfo: { flex: 1 },
  userName: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 6 },
  roleBadge: { backgroundColor: '#311b92', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  roleText: { color: 'white', fontSize: 10, fontWeight: '800' },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingLeft: 4 },
  menuItem: { backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, marginBottom: 10 },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuText: { fontSize: 16, color: '#374151', fontWeight: '500' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#FEF2F2', marginTop: 20 },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 16 }
});
