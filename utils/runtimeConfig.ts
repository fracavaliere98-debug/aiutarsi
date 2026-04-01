import Constants from "expo-constants";

export function extractSupabaseProjectRef(url: string) {
    if (!url) return "";

    try {
        const hostname = new URL(url).hostname;
        const projectRef = hostname.split(".")[0];
        return projectRef || "";
    } catch {
        return "";
    }
}

export function getExpoProjectId() {
    const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
    return extra?.eas?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "";
}

export function getSupabaseProjectRef() {
    return extractSupabaseProjectRef(process.env.EXPO_PUBLIC_SUPABASE_URL || "");
}
