import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../utils/supabase';
import { useAuth } from '../../../context/AuthContext';
import { 
  ChevronLeft, Building2, User, ShieldCheck, FileText, XCircle, 
  MapPin, Globe, Mail, Info, ExternalLink, Phone
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
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

export default function AdminVerificationDetail() {
  const { id } = useLocalSearchParams();
  const { user: adminUser } = useAuth();
  const { addNotification } = useNotifications();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const router = useRouter();

  const fetchDetails = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('verification_requests')
        .select(`
          *,
          profiles:user_id(*)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      setRequest(data);
    } catch (error) {
      console.error('Error fetching verification detail:', error);
      Alert.alert('Errore', 'Impossibile caricare i dettagli della richiesta.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchDetails();
  }, [fetchDetails]);

  const handleAction = async (action: 'approved' | 'rejected') => {
    if (actionLoading) return;

    if (action === 'rejected') {
      setShowRejectModal(true);
      return;
    }
    
    const confirmMsg = "Sei sicuro di voler APPROVARE questa richiesta? L'ente riceverà il Bollino Viola.";

    Alert.alert(
      "Approva Verifica",
      confirmMsg,
      [
        { text: "Annulla", style: "cancel" },
        { 
          text: "Approva", 
          style: "default",
          onPress: () => processAction(action)
        }
      ]
    );
  };

  const processAction = async (action: 'approved' | 'rejected', notes?: string) => {
    setActionLoading(true);
    try {
      const cleanedNotes = notes?.trim() || '';
      const adminNotes = action === 'rejected'
        ? `Gestita da admin ${adminUser?.full_name || 'N/D'} | Motivo rifiuto: ${cleanedNotes}`
        : `Gestita da admin ${adminUser?.full_name || 'N/D'}`;

      // 1. Update verification_requests status
      const { error: requestError } = await supabase
        .from('verification_requests')
        .update({ 
          status: action,
          admin_notes: adminNotes
        })
        .eq('id', id);

      if (requestError) throw requestError;

      // 2. Update profile verification status
      const profileUpdates: any = {
        verification_status: action === 'approved' ? 'verified' : 'rejected'
      };

      if (action === 'approved') {
        profileUpdates.is_verified = true;
      } else {
        profileUpdates.is_verified = false;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', request.user_id);

      if (profileError) throw profileError;

      // 3. Notify user
      const rejectionReasonSuffix = cleanedNotes ? ` Motivo: ${cleanedNotes}` : '';

      if (addNotification) {
        addNotification({
          userId: request.user_id,
          type: action === 'approved' ? 'SUCCESS' : 'INFO',
          title: action === 'approved' ? 'Profilo Verificato! 🎉' : 'Richiesta di Verifica Respinta',
          message: action === 'approved' 
            ? `Congratulazioni! ${request.npo_details?.npo_name || request.profiles?.npo_name || request.profiles?.full_name || 'Il tuo ente'} ha ottenuto il Bollino Viola.`
            : `La tua richiesta di verifica per ${request.npo_details?.npo_name || request.profiles?.npo_name || request.profiles?.full_name || 'il tuo ente'} non è stata approvata.${rejectionReasonSuffix}`
        });
      }

      Alert.alert('Successo', `Richiesta ${action === 'approved' ? 'approvata' : 'rifiutata'} correttamente.`);
      setShowRejectModal(false);
      setRejectionNotes('');
      router.back();
    } catch (error: any) {
      console.error('Action failed:', error);
      Alert.alert('Errore', error.message || 'Si è verificato un errore durante l\'operazione.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#311b92" /></View>;
  if (!request) return <View style={styles.centered}><Text>Richiesta non trovata.</Text></View>;

  const npo = request.npo_details || {};
  const profile = request.profiles || {};

  const openDocument = async () => {
    const docUrl = npo.verification_doc || profile.verification_doc_url;
    if (docUrl) {
      try {
        await WebBrowser.openBrowserAsync(docUrl);
      } catch (error) {
        console.error('Error opening browser:', error);
        Alert.alert('Errore', 'Impossibile aprire il documento nel browser.');
      }
    } else {
      Alert.alert('Documento non disponibile', 'L\'ente non ha caricato alcun documento di supporto.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Dettaglio Verifica</Text>
          <Text style={styles.headerSubtitle}>Richiesta del {formatDate(request.created_at)}</Text>
        </View>
        <View style={styles.statusBadgeHeader}>
          <View style={[styles.statusDot, { backgroundColor: request.status === 'pending' ? '#3B82F6' : request.status === 'approved' ? '#10B981' : '#EF4444' }]} />
          <Text style={styles.statusTextHeader}>{request.status.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* NPO Card */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>INFORMAZIONI ENTE</Text>
          <View style={styles.npoCard}>
            <View style={styles.npoHeader}>
              <View style={styles.iconCircle}>
                <Building2 size={32} color="#311b92" />
              </View>
              <View style={styles.npoTitleInfo}>
                <Text style={styles.npoName}>{npo.npo_name || profile.npo_name || profile.full_name || 'Nome non disponibile'}</Text>
                <Text style={styles.vatId}>P.IVA / CF: {npo.vat_id || profile.npo_vat_id || 'N/D'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <MapPin size={18} color="#6B7280" />
                <Text style={styles.infoText}>{npo.address || profile.address_full || 'Indirizzo non specificato'}</Text>
              </View>
              
              <View style={styles.infoRow}>
                <Mail size={18} color="#6B7280" />
                <Text style={styles.infoText}>{npo.email || profile.public_email || profile.email || 'Email non disponibile'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Phone size={18} color="#6B7280" />
                <Text style={styles.infoText}>{npo.phone || profile.phone || 'Telefono non disponibile'}</Text>
              </View>

              {(npo.website || profile.website) && (
              <View style={styles.infoRow}>
                <Globe size={18} color="#6B7280" />
                <Text style={styles.infoText} onPress={() => Linking.openURL(npo.website || profile.website)}>{npo.website || profile.website}</Text>
              </View>
              )}
              
              <View style={styles.infoRow}>
                <User size={18} color="#6B7280" />
                <Text style={styles.infoText}>{npo.referent_name || profile.referent_name || 'Referente non specificato'} ({npo.referent_role || profile.referent_role || 'Ruolo non specificato'})</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Mission Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MISSIONE / BIO</Text>
          <View style={styles.bioCard}>
            <Info size={20} color="#311b92" style={{ marginBottom: 12 }} />
            <Text style={styles.bioText}>
              {npo.mission || profile.bio || 'Nessuna descrizione fornita.'}
            </Text>
          </View>
        </View>

        {/* Document Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DOCUMENTAZIONE ALLEGATA</Text>
          <TouchableOpacity style={styles.docButton} onPress={openDocument}>
            <View style={styles.docIcon}>
              <FileText size={24} color="#311b92" />
            </View>
            <View style={styles.docInfo}>
              <Text style={styles.docTitle}>Statuto / Atto Costitutivo</Text>
              <Text style={styles.docSubtitle}>Tocca per visualizzare il file</Text>
            </View>
            <ExternalLink size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {request.admin_notes && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NOTE AMMINISTRATIVE</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesCardText}>{request.admin_notes}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (actionLoading) return;
          setShowRejectModal(false);
          setRejectionNotes('');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rifiuta richiesta</Text>
            <Text style={styles.modalSubtitle}>
              Inserisci una spiegazione da inviare alla NPO. La nota verrà salvata nella richiesta e riportata nelle notifiche.
            </Text>

            <TextInput
              value={rejectionNotes}
              onChangeText={setRejectionNotes}
              placeholder="Es. Documento non leggibile, dati dell'ente incompleti, referente non coerente..."
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
              style={styles.notesInput}
              editable={!actionLoading}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  if (actionLoading) return;
                  setShowRejectModal(false);
                  setRejectionNotes('');
                }}
                disabled={actionLoading}
              >
                <Text style={styles.modalCancelText}>Annulla</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalRejectButton, !rejectionNotes.trim() && styles.modalRejectButtonDisabled]}
                onPress={() => processAction('rejected', rejectionNotes)}
                disabled={actionLoading || !rejectionNotes.trim()}
              >
                {actionLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.modalRejectText}>Conferma rifiuto</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Action Bar */}
      {request.status === 'pending' && (
        <View style={styles.footerActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleAction('rejected')}
            disabled={actionLoading}
          >
            <XCircle size={22} color="#EF4444" />
            <Text style={styles.rejectText}>Rifiuta</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleAction('approved')}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <ShieldCheck size={22} color="white" />
                <Text style={styles.approveText}>Approva</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15, 
    backgroundColor: 'white',
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6' 
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitleContainer: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  statusBadgeHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F3F4F6', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20 
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusTextHeader: { fontSize: 10, fontWeight: '800', color: '#4B5563' },
  scrollContent: { padding: 20 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', marginBottom: 12, letterSpacing: 1 },
  npoCard: { backgroundColor: 'white', borderRadius: 24, padding: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  npoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3E5F5', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  npoTitleInfo: { flex: 1 },
  npoName: { fontSize: 20, fontWeight: '900', color: '#111827', marginBottom: 4 },
  vatId: { fontSize: 14, color: '#311b92', fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 20 },
  infoGrid: { gap: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoText: { fontSize: 14, color: '#4B5563', marginLeft: 12, flex: 1 },
  bioCard: { backgroundColor: 'white', borderRadius: 24, padding: 20, borderLeftWidth: 4, borderLeftColor: '#311b92' },
  bioText: { fontSize: 15, color: '#4B5563', lineHeight: 24 },
  docButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'white', 
    borderRadius: 20, 
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed'
  },
  docIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F3E5F5', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  docSubtitle: { fontSize: 13, color: '#9CA3AF' },
  notesCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  notesCardText: { fontSize: 14, lineHeight: 22, color: '#374151' },
  footerActions: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    flexDirection: 'row', 
    padding: 20, 
    paddingBottom: 40,
    backgroundColor: 'white', 
    borderTopWidth: 1, 
    borderTopColor: '#F3F4F6',
    gap: 16
  },
  actionButton: { flex: 1, height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  rejectButton: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2' },
  approveButton: { backgroundColor: '#311b92', elevation: 4, shadowColor: '#311b92', shadowOpacity: 0.3, shadowRadius: 10 },
  rejectText: { fontSize: 16, fontWeight: '800', color: '#EF4444' },
  approveText: { fontSize: 16, fontWeight: '800', color: 'white' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: 'white', borderRadius: 24, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#111827', marginBottom: 8 },
  modalSubtitle: { fontSize: 13, lineHeight: 20, color: '#6B7280', marginBottom: 14 },
  notesInput: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB'
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalButton: { flex: 1, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  modalCancelButton: { backgroundColor: '#F3F4F6' },
  modalRejectButton: { backgroundColor: '#DC2626' },
  modalRejectButtonDisabled: { opacity: 0.5 },
  modalCancelText: { color: '#374151', fontWeight: '800', fontSize: 15 },
  modalRejectText: { color: 'white', fontWeight: '800', fontSize: 15 }
});
