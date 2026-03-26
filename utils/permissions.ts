import { Alert, Linking, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

type PermissionPromptOptions = {
  title: string;
  message: string;
  settingsLabel?: string;
};

function confirmPermissionRequest({ title, message }: PermissionPromptOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Non ora", style: "cancel", onPress: () => resolve(false) },
      { text: "Continua", onPress: () => resolve(true) },
    ]);
  });
}

function promptOpenSettings({ title, settingsLabel = "questa autorizzazione" }: PermissionPromptOptions) {
  Alert.alert(
    `${title} disattivato`,
    `Per usare questa funzione devi abilitare ${settingsLabel} nelle impostazioni del dispositivo.`,
    [
      { text: "Annulla", style: "cancel" },
      { text: "Apri impostazioni", onPress: () => void Linking.openSettings() },
    ]
  );
}

export async function requestMediaLibraryPermission(options: PermissionPromptOptions) {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.status === "granted") return true;

  const confirmed = await confirmPermissionRequest(options);
  if (!confirmed) return false;

  const next = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (next.status !== "granted" && !next.canAskAgain) {
    promptOpenSettings(options);
  }

  return next.status === "granted";
}

export async function requestForegroundLocationPermission(options: PermissionPromptOptions) {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === "granted") return true;

  const confirmed = await confirmPermissionRequest(options);
  if (!confirmed) return false;

  const next = await Location.requestForegroundPermissionsAsync();
  if (next.status !== "granted" && !next.canAskAgain) {
    promptOpenSettings(options);
  }

  return next.status === "granted";
}

export async function requestNotificationPermission(options: PermissionPromptOptions) {
  if (Platform.OS === "web") return false;

  const Notifications = await import("expo-notifications");
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return true;

  const confirmed = await confirmPermissionRequest(options);
  if (!confirmed) return false;

  const next = await Notifications.requestPermissionsAsync();
  if (next.status !== "granted" && !next.canAskAgain) {
    promptOpenSettings(options);
  }

  return next.status === "granted";
}
