import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { Mail, LogOut, Phone, ShieldCheck, User, X } from 'lucide-react-native';

export default function AdminSettingsScreen() {
  const { user, logout, updateUserProfile } = useAuth();
  const [editVisible, setEditVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saveError, setSaveError] = useState('');

  const displayEmail = useMemo(() => user?.email || 'Email non disponibile', [user?.email]);

  const openEditModal = () => {
    setFullName(user?.full_name || user?.name || '');
    setPhone(user?.phone || '');
    setSaveError('');
    setEditVisible(true);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      setSaveError('Inserisci almeno il nome amministratore.');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    try {
      await updateUserProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      } as any);
      setEditVisible(false);
    } catch (error: any) {
      setSaveError(error?.message || 'Errore durante il salvataggio.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Il tuo profilo admin</Text>
        <Text style={styles.headerSubtitle}>Gestisci i dati del profilo e l’uscita dall’area amministrativa.</Text>
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
          <Text style={styles.sectionTitle}>Profilo</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <User size={18} color="#4B5563" />
              <View style={styles.infoCopy}>
                <Text style={styles.infoLabel}>Nome amministratore</Text>
                <Text style={styles.infoValue}>{user?.full_name || user?.name || 'Administrator'}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Mail size={18} color="#4B5563" />
              <View style={styles.infoCopy}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{displayEmail}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Phone size={18} color="#4B5563" />
              <View style={styles.infoCopy}>
                <Text style={styles.infoLabel}>Telefono</Text>
                <Text style={styles.infoValue}>{user?.phone || 'Non impostato'}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryAction} onPress={openEditModal}>
            <Text style={styles.primaryActionText}>Modifica profilo</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <LogOut size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Esci dall&apos;area admin</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifica profilo admin</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setEditVisible(false)}>
                <X size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Nome amministratore</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Nome e cognome"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Telefono</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Numero di telefono"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={[styles.input, styles.readonlyInput]}>
                <Text style={styles.readonlyText}>{displayEmail}</Text>
              </View>
              <Text style={styles.readonlyHint}>L’email admin resta di sola lettura in questa schermata.</Text>
            </View>

            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

            <TouchableOpacity style={[styles.primaryAction, isSaving && { opacity: 0.6 }]} disabled={isSaving} onPress={handleSave}>
              <Text style={styles.primaryActionText}>{isSaving ? 'Salvataggio...' : 'Salva modifiche'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  headerSubtitle: { marginTop: 6, fontSize: 13, lineHeight: 19, color: '#6B7280' },
  content: { padding: 20 },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F3E5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  profileInfo: { flex: 1 },
  userName: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 6 },
  roleBadge: { backgroundColor: '#311b92', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  roleText: { color: 'white', fontSize: 10, fontWeight: '800' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingLeft: 4 },
  infoCard: { backgroundColor: 'white', borderRadius: 18, padding: 16, marginBottom: 14 },
  infoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 14 },
  infoCopy: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', marginBottom: 4 },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
  primaryAction: { backgroundColor: '#311b92', paddingVertical: 15, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: 'white', fontSize: 15, fontWeight: '800' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#FEF2F2', marginTop: 10 },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  closeButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '800', color: '#311b92', marginBottom: 8, marginLeft: 4 },
  input: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(70,34,130,0.08)',
    paddingHorizontal: 16,
    justifyContent: 'center',
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  readonlyInput: { backgroundColor: '#F8FAFC' },
  readonlyText: { color: '#475569', fontSize: 15, fontWeight: '600' },
  readonlyHint: { marginTop: 6, marginLeft: 4, color: '#6B7280', fontSize: 12 },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '600', marginBottom: 12 },
});
