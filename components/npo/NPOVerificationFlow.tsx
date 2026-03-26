import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { ArrowRight, FileText, Upload, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Colors } from "../../constants/Colors";
import { OnboardingStepHeader } from "../onboarding/OnboardingStepHeader";
import { storageService } from "../../services/StorageService";
import { authService } from "../../services/AuthService";
import { supabase } from "../../utils/supabase";

type Props = {
  title: string;
  subtitle: string;
  onBack: () => void;
  onClose?: () => void;
  onSkip: () => void;
  onSubmitted: () => void;
  primaryLabel?: string;
  skipAlertMessage?: string;
};

export function NPOVerificationFlow({
  title,
  subtitle,
  onBack,
  onClose,
  onSkip,
  onSubmitted,
  primaryLabel = "Invia per verifica",
  skipAlertMessage = "Puoi tornare piu tardi, ma il tuo ente restera senza Bollino Viola finche non invierai la documentazione.",
}: Props) {
  const { user, fetchUserById, setUser } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [document, setDocument] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkPendingRequest = async () => {
      if (!user?.id || user?.is_verified || user?.isVerified) return;

      try {
        const { data, error } = await supabase
          .from("verification_requests")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .limit(1);

        if (error) throw error;

        if (!isMounted) return;

        const hasPending = !!data && data.length > 0;
        setHasPendingRequest(hasPending);

        if (hasPending && user.verification_status !== "pending") {
          setUser({
            ...user,
            verification_status: "pending",
          });
        }
      } catch (error) {
        console.error("Failed to check pending verification request:", error);
      }
    };

    void checkPendingRequest();
    return () => {
      isMounted = false;
    };
  }, [setUser, user]);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) setDocument(result);
    } catch {
      showToast("error", "Errore nella selezione del documento.");
    }
  };

  const handleContinue = async () => {
    if (hasPendingRequest || user?.verification_status === "pending") {
      showToast("info", "Hai gia una richiesta di verifica in revisione.");
      onSubmitted();
      return;
    }

    if (!document) {
      Alert.alert("Verifica non completata", skipAlertMessage, [
        { text: "Carica ora", style: "cancel" },
        { text: "Piu tardi", onPress: onSkip },
      ]);
      return;
    }

    setIsLoading(true);
    try {
      const asset = document.assets?.[0];
      if (!asset || !user?.id) {
        showToast("error", "Nessun file selezionato.");
        return;
      }

      const extension = asset.name?.split(".").pop() || "pdf";
      const uploadedUrl = await storageService.uploadVerificationDoc(user.id, asset.uri, extension);
      if (!uploadedUrl) {
        showToast("error", "Upload non riuscito.");
        return;
      }

      const npoDetailsSnap = {
        vat_id: user?.npo_vat_id,
        address: user?.address_full,
        mission: user?.bio,
        referent_name: user?.referent_name,
        referent_role: user?.referent_role,
        website: user?.website,
        verification_doc: uploadedUrl,
        timestamp: new Date().toISOString(),
      };

      await authService.updateProfile(user.id, {
        verification_doc_url: uploadedUrl,
        verification_status: "pending",
      } as any);

      await authService.submitVerificationRequest(user.id, npoDetailsSnap);
      const freshUser = await fetchUserById(user.id);
      if (freshUser) {
        setUser(freshUser);
      } else {
        setUser({
          ...user,
          verification_status: "pending",
        });
      }
      showToast("success", "Richiesta inviata! L'admin la revisionera.");
      onSubmitted();
    } catch (e: any) {
      if (e?.message?.includes("Hai gia una richiesta di verifica in revisione.")) {
        const freshUser = await fetchUserById(user!.id);
        if (freshUser) {
          setUser(freshUser);
        } else {
          setUser({
            ...user!,
            verification_status: "pending",
          });
        }
        showToast("info", "Hai gia una richiesta di verifica in revisione.");
        onSubmitted();
        return;
      }
      console.error("Upload verification failed", e);
      showToast("error", "Errore nel caricamento: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <OnboardingStepHeader title={title} subtitle={subtitle} onBack={onBack} onClose={onClose} />

        <View style={styles.badgePreview}>
          <View style={styles.badgeIconContainer}>
            <ShieldCheck size={48} color={Colors.primary} />
            <View style={styles.miniBadge}>
              <CheckCircle2 size={24} color="white" fill={Colors.accent} />
            </View>
          </View>
          <Text style={styles.badgeTitle}>Bollino Viola</Text>
          <Text style={styles.badgeDesc}>
            Ottieni visibilita prioritaria e fiducia immediata dalla community di AiutarSi.
          </Text>
        </View>

        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Documentazione richiesta</Text>
          <Text style={styles.sectionDesc}>
            Carica lo Statuto o l&apos;Atto Costitutivo dell&apos;ente in PDF o immagine.
          </Text>

          {(hasPendingRequest || user?.verification_status === "pending") && (
            <View style={styles.pendingBox}>
              <Text style={styles.pendingTitle}>Richiesta gia inviata</Text>
              <Text style={styles.pendingText}>
                La verifica del tuo ente è già in revisione. Non puoi inviare una nuova richiesta finché non ricevi un esito.
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={pickDocument}
            disabled={hasPendingRequest || user?.verification_status === "pending"}
            style={[styles.uploadBox, document && styles.uploadBoxActive, (hasPendingRequest || user?.verification_status === "pending") && styles.uploadBoxDisabled]}
          >
            {document && document.assets?.[0] ? (
              <View style={styles.fileInfo}>
                <FileText size={32} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {document.assets[0].name}
                  </Text>
                  <Text style={styles.fileSize}>
                    {((document.assets[0].size || 0) / 1024 / 1024).toFixed(2)} MB
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setDocument(null)}>
                  <Text style={styles.removeText}>Cambia</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Upload size={32} color={Colors.secondary} style={{ marginBottom: 12 }} />
                <Text style={styles.uploadText}>Tocca per selezionare un file</Text>
                <Text style={styles.formatText}>PDF o immagini, max 5MB</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.disclaimerBox}>
          <AlertCircle size={20} color="#606080" style={{ marginBottom: 8 }} />
          <Text style={styles.disclaimerText}>
            Dichiaro che i dati forniti e la documentazione caricata sono veritieri e riferiti all&apos;ente di cui sono rappresentante legale o delegato.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={handleContinue} disabled={isLoading} style={styles.button}>
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text style={styles.buttonText}>{document ? primaryLabel : "Carica documento"}</Text>
              <ArrowRight size={22} color="white" strokeWidth={2.5} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FB" },
  scrollContent: { paddingBottom: 120 },
  badgePreview: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "white",
    marginHorizontal: 24,
    borderRadius: 32,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    marginBottom: 32,
  },
  badgeIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F0F0FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  miniBadge: {
    position: "absolute",
    bottom: 8,
    right: 4,
    backgroundColor: Colors.accent,
    borderRadius: 999,
  },
  badgeTitle: { fontSize: 24, fontWeight: "900", color: Colors.primary, marginBottom: 8 },
  badgeDesc: { fontSize: 14, lineHeight: 22, textAlign: "center", color: Colors.secondary },
  uploadSection: { marginHorizontal: 24, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: Colors.primary, marginBottom: 6 },
  sectionDesc: { fontSize: 14, lineHeight: 21, color: Colors.secondary, marginBottom: 14 },
  uploadBox: {
    backgroundColor: "white",
    borderRadius: 28,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#d8d4fe",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
  },
  uploadBoxActive: { borderStyle: "solid", borderColor: Colors.primary, backgroundColor: "#faf8ff" },
  uploadBoxDisabled: { opacity: 0.55 },
  uploadText: { fontSize: 15, fontWeight: "700", color: Colors.primary },
  formatText: { fontSize: 12, fontWeight: "600", color: Colors.secondary, marginTop: 6 },
  pendingBox: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fdba74",
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
  },
  pendingTitle: { color: "#c2410c", fontSize: 13, fontWeight: "900", marginBottom: 4 },
  pendingText: { color: "#9a3412", fontSize: 12, lineHeight: 18 },
  fileInfo: { width: "100%", flexDirection: "row", alignItems: "center", gap: 14 },
  fileName: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  fileSize: { fontSize: 12, color: Colors.secondary, marginTop: 4 },
  removeText: { color: Colors.primary, fontSize: 12, fontWeight: "800" },
  disclaimerBox: { marginHorizontal: 24, borderRadius: 24, padding: 18, backgroundColor: "#F2F4F8", marginBottom: 24 },
  disclaimerText: { fontSize: 13, lineHeight: 20, color: Colors.secondary },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  button: {
    height: 56,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  buttonText: { color: "white", fontSize: 16, fontWeight: "900" },
});
