import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertOctagon } from 'lucide-react-native';

interface BannedScreenProps {
  reason?: string;
  reportId?: string;
  onLogout: () => void;
}

export default function BannedScreen({ reason, reportId, onLogout }: BannedScreenProps) {
  const handleContact = () => {
    Linking.openURL(`mailto:aiutarsi.it@gmail.com?subject=Account%20Sospeso&body=ID%20Segnalazione:%20${reportId || 'N/D'}`);
  };

  const displayReportId = reportId ? (reportId.length > 8 ? reportId.substring(0, 8).toUpperCase() : reportId.toUpperCase()) : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <AlertOctagon size={80} color="#EF4444" strokeWidth={1.5} />
        </View>
        
        <Text style={styles.title}>Account Sospeso</Text>
        
        <Text style={styles.statusLabel}>Sospensione permanente</Text>
        
        <Text style={styles.desc}>
          Il tuo account è stato permanentemente sospeso per violazione dei Termini di Servizio o delle Linee Guida della Community.
        </Text>
        
        {reason && (
          <View style={styles.reasonBox}>
            <View style={styles.reasonHeader}>
              <Text style={styles.reasonLabel}>Motivazione dei moderatori</Text>
            </View>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        )}
        
        <Text style={styles.helpText}>
          Se ritieni che ci sia stato un errore, puoi contattare il supporto scrivendo a aiutarsi.it@gmail.com.
        </Text>

        {displayReportId && (
          <View style={styles.reportIdContainer}>
            <Text style={styles.reportIdLabel}>ID SEGNALAZIONE: </Text>
            <Text style={styles.reportIdValue}>{displayReportId}</Text>
          </View>
        )}
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
    marginBottom: 8,
    textAlign: 'center',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 24,
    textAlign: 'center',
  },
  desc: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  reasonBox: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 20,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  reasonHeader: {
    marginBottom: 8,
  },
  reasonLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    marginBottom: 16,
  },
  reportIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    paddingVertical: 12,
  },
  reportIdLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  reportIdValue: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '800',
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
