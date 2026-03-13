import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Linking, StyleSheet } from 'react-native';
import { AlertOctagon } from 'lucide-react-native';

interface BannedScreenProps {
  reason?: string;
  onLogout: () => void;
}

export default function BannedScreen({ reason, onLogout }: BannedScreenProps) {
  const handleContact = () => {
    Linking.openURL('mailto:support@aiutarsi.it?subject=Account%20Sospeso');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <AlertOctagon size={80} color="#EF4444" strokeWidth={1.5} />
        </View>
        
        <Text style={styles.title}>Account Sospeso</Text>
        
        <Text style={styles.desc}>
          Il tuo account è stato permanentemente sospeso per violazione dei Termini di Servizio o delle Linee Guida della Community.
        </Text>
        
        {reason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Motivazione fornita dai moderatori:</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        )}
        
        <Text style={styles.helpText}>
          Se ritieni che ci sia stato un errore, puoi contattare il supporto.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.buttonPrimary} onPress={handleContact}>
          <Text style={styles.buttonPrimaryText}>Contatta il Supporto</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.buttonSecondary} onPress={onLogout}>
          <Text style={styles.buttonSecondaryText}>Torna al Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    backgroundColor: '#FEF2F2',
    height: 140,
    width: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  desc: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  reasonBox: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  reasonLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
    lineHeight: 22,
  },
  helpText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12,
  },
  buttonPrimary: {
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonSecondaryText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
});
