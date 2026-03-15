import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { X, AlertTriangle } from 'lucide-react-native';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppUser } from '../types';

export type ReportContentType = 'message' | 'profile' | 'community_post';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  reportedUser: AppUser;
  contentType: ReportContentType;
  contentId?: string;
  evidenceSnapshot?: any; // JSON object or array
}

const VOLUNTEER_CATEGORIES = ['Spam', 'Molestie', 'Contenuto Inappropriato', 'Falsa Organizzazione'];
const NPO_CATEGORIES = ['Spam', 'Molestie', 'Contenuto Inappropriato', 'Falsa Identità'];
const DEFAULT_CATEGORIES = ['Spam', 'Molestie', 'Contenuto Inappropriato', 'Altro'];

export default function ReportModal({ visible, onClose, reportedUser, contentType, contentId, evidenceSnapshot }: ReportModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [reasonText, setReasonText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Determinare le categorie in base al ruolo del reporter
  const categories = user?.role === 'VOLUNTEER' 
    ? VOLUNTEER_CATEGORIES 
    : user?.role === 'NPO' 
      ? NPO_CATEGORIES 
      : DEFAULT_CATEGORIES;

  const handleSubmit = async () => {
    if (user?.id === reportedUser.id) {
      showToast('error', 'Non puoi auto-segnalarti :D');
      return;
    }

    if (!selectedCategory || !reasonText.trim() || !user) {
      showToast('error', 'Compila tutti i campi obbligatori');
      return;
    }

    setSubmitting(true);
    try {
      const fullReason = `${selectedCategory}: ${reasonText.trim()}`;

      // 1. Inserisci il report
      const { error: reportError } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          reported_id: reportedUser.id,
          content_type: contentType,
          content_id: contentId || null,
          reason: fullReason,
          evidence_snapshot: evidenceSnapshot || null,
          status: 'pending'
        });

      if (reportError) throw reportError;

      // 2. Auto-block (aggiungi a blocked_users) - Solo se non si sta segnalando se stessi
      if (user.id !== reportedUser.id) {
        const { error: blockError } = await supabase
          .from('blocked_users')
          .insert({
            blocker_id: user.id,
            blocked_id: reportedUser.id
          });

        // Ignoriamo l'errore di duplicato (23505) se era già bloccato
        if (blockError && blockError.code !== '23505') {
          console.error('Error auto-blocking user:', blockError);
          // Non lanciamo l'errore per non bloccare il flow del report
        }
      }

      showToast('success', 'Segnalazione inviata. Hai anche bloccato questo utente.');
      onClose();
      // Reset form
      setSelectedCategory('');
      setReasonText('');
    } catch (error) {
      console.error('Error submitting report:', error);
      showToast('error', 'Errore durante l\'invio della segnalazione');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' }}>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AlertTriangle size={24} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1F2937' }}>Segnala Utente</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 14, color: '#4B5563', marginBottom: 20, lineHeight: 20 }}>
              Stai segnalando <Text style={{ fontWeight: 'bold' }}>{reportedUser.name || reportedUser.npoName || 'l\'utente'}</Text>.
              Questa segnalazione è anonima. L&apos;utente verrà anche bloccato e non potrà più contattarti o interagire con te.
            </Text>

            <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12 }}>Motivazione (richiesta)</Text>
            <View style={{ flexWrap: 'wrap', flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: selectedCategory === cat ? '#EF4444' : '#F3F4F6',
                    borderWidth: 1,
                    borderColor: selectedCategory === cat ? '#EF4444' : '#E5E7EB',
                  }}
                >
                  <Text style={{ color: selectedCategory === cat ? 'white' : '#4B5563', fontWeight: '500' }}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12 }}>Dettagli (richiesti)</Text>
            <TextInput
              style={{
                backgroundColor: '#F9FAFB',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                padding: 16,
                paddingTop: 16,
                minHeight: 120,
                textAlignVertical: 'top',
                fontSize: 15,
                color: '#1F2937',
                marginBottom: 24,
              }}
              placeholder="Descrivi il problema per aiutare i nostri moderatori a prendere provvedimenti..."
              multiline
              numberOfLines={4}
              value={reasonText}
              onChangeText={setReasonText}
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting || !selectedCategory || !reasonText.trim()}
              style={{
                backgroundColor: (selectedCategory && reasonText.trim() && !submitting) ? '#EF4444' : '#FCA5A5',
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                marginBottom: Platform.OS === 'ios' ? 20 : 0
              }}
            >
              {submitting ? (
                <ActivityIndicator color="white" style={{ marginRight: 8 }} />
              ) : null}
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>
                {submitting ? 'Invio in corso...' : 'Invia Segnalazione e Blocca'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
