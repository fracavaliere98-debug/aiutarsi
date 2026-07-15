import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as Updates from "expo-updates";
import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";
import type { AppUser } from "../types";
import { getExpoProjectId, getSupabaseProjectRef } from "./runtimeConfig";
import {
    getClassification,
    getClassificationLevel,
    getPriorityLevel,
    isExpectedUserInputError,
    toError,
    type TelemetryClassification,
    type TelemetryPriority,
} from "./monitoringLogic";

export { getClassification, getClassificationLevel, getPriorityLevel, isExpectedUserInputError };

type TelemetryPrimitive = string | number | boolean | null | undefined;
type TelemetryValue = TelemetryPrimitive | TelemetryValue[] | { [key: string]: TelemetryValue };
type TelemetryContext = Record<string, TelemetryValue>;

interface TrackErrorOptions {
    source?: string;
    priority?: TelemetryPriority;
    classification?: TelemetryClassification;
    issueName?: string;
    fingerprint?: string[];
    expected?: boolean;
}

const SUPPORT_EMAIL = "aiutarsi.it@gmail.com";
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || "";
const APP_VERSION = Constants.expoConfig?.version || "unknown";
const BUILD_NUMBER = String(
    Constants.expoConfig?.ios?.buildNumber
    || Constants.expoConfig?.android?.versionCode
    || "0"
);
const RUNTIME_CHANNEL = (Updates.channel || "").trim();

let monitoringInitialized = false;

function getEnvironment() {
    if (process.env.EXPO_PUBLIC_APP_ENV) {
        return process.env.EXPO_PUBLIC_APP_ENV;
    }
    if (RUNTIME_CHANNEL) {
        return RUNTIME_CHANNEL;
    }
    return __DEV__ ? "development" : "production";
}

function sanitizeTelemetryValue(value: TelemetryValue, depth = 0): TelemetryValue {
    if (depth > 3) return "[truncated]";
    if (Array.isArray(value)) {
        return value.slice(0, 20).map((item) => sanitizeTelemetryValue(item, depth + 1));
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value)
                .slice(0, 40)
                .map(([key, entryValue]) => {
                    const lowerKey = key.toLowerCase();
                    if (
                        lowerKey.includes("token")
                        || lowerKey.includes("password")
                        || lowerKey.includes("secret")
                        || lowerKey.includes("authorization")
                        || lowerKey.includes("cookie")
                    ) {
                        return [key, "[redacted]"];
                    }
                    return [key, sanitizeTelemetryValue(entryValue, depth + 1)];
                })
        );
    }
    return value;
}

function sanitizeContext(context?: TelemetryContext) {
    if (!context) return undefined;
    return sanitizeTelemetryValue(context) as TelemetryContext;
}

function getIssueSubject() {
    return `[AiutarSi] Segnalazione problema ${getEnvironment()}`;
}

function buildIssueBody(options?: {
    user?: AppUser | null;
    screen?: string;
    error?: unknown;
    extra?: TelemetryContext;
}) {
    const lines = [
        "Descrivi qui il problema riscontrato:",
        "",
        "--- Dettagli tecnici ---",
        `Environment: ${getEnvironment()}`,
        `Versione app: ${APP_VERSION}`,
        `Build: ${BUILD_NUMBER}`,
        `Piattaforma: ${Platform.OS}`,
        `Canale OTA: ${RUNTIME_CHANNEL || "n/a"}`,
        `Expo project: ${getExpoProjectId() || "n/a"}`,
        `Supabase ref: ${getSupabaseProjectRef() || "n/a"}`,
        `Utente ID: ${options?.user?.id || "n/a"}`,
        `Ruolo: ${options?.user?.role || "n/a"}`,
        `Schermata: ${options?.screen || "n/a"}`,
    ];

    if (options?.error) {
        const normalizedError = toError(options.error);
        lines.push(`Errore: ${normalizedError.message}`);
    }

    if (options?.extra) {
        lines.push(`Contesto: ${JSON.stringify(sanitizeContext(options.extra))}`);
    }

    return lines.join("\n");
}

export function isMonitoringEnabled() {
    return !!SENTRY_DSN;
}

export function initializeMonitoring() {
    if (monitoringInitialized) return;
    monitoringInitialized = true;

    if (!SENTRY_DSN) {
        console.log("[Monitoring] Sentry disabled: missing EXPO_PUBLIC_SENTRY_DSN");
        return;
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        enabled: true,
        debug: getEnvironment() !== "production",
        environment: getEnvironment(),
        release: `aiutarsiapp@${APP_VERSION}`,
        dist: BUILD_NUMBER,
        attachStacktrace: true,
        sendDefaultPii: false,
        tracesSampleRate: getEnvironment() === "preview" ? 0.25 : 0.1,
        beforeSend(event) {
            if (event.request?.headers) {
                delete event.request.headers.Authorization;
                delete event.request.headers.authorization;
            }
            return event;
        },
    });

    Sentry.setTags({
        platform: Platform.OS,
        expo_project_id: getExpoProjectId() || "unknown",
        supabase_project_ref: getSupabaseProjectRef() || "unknown",
        updates_channel: RUNTIME_CHANNEL || "none",
    });
}

export function setMonitoringUser(user: AppUser | null) {
    if (!isMonitoringEnabled()) return;

    if (!user) {
        Sentry.setUser(null);
        return;
    }

    Sentry.setUser({
        id: user.id,
        email: user.email || undefined,
        username: user.full_name || user.name || user.npo_name || undefined,
    });

    Sentry.setContext("app_user", {
        role: user.role,
        profile_completed: !!user.profile_completed,
        is_verified: !!(user.is_verified || user.isVerified),
    });
}

export function trackEvent(name: string, context?: TelemetryContext) {
    const data = sanitizeContext(context);
    console.log("[Monitoring] event", name, data || {});
    if (!isMonitoringEnabled()) return;

    Sentry.addBreadcrumb({
        category: "app.event",
        level: "info",
        message: name,
        data,
    });
}

export function trackError(error: unknown, context?: TelemetryContext, options?: TrackErrorOptions) {
    const normalizedError = toError(error);
    const data = sanitizeContext(context);
    const priority = options?.priority || "normal";
    const source = options?.source || (typeof data?.source === "string" ? data.source : "unknown");
    const issueName = options?.issueName || `${source}_failed`;
    const classification = getClassification(options);

    if (classification === "expected_user") {
        trackEvent(`${issueName}_expected`, {
            ...data,
            errorMessage: normalizedError.message,
            classification,
        });
        console.warn("[Monitoring] expected error", normalizedError, data || {});
        return;
    }

    console.error("[Monitoring] error", normalizedError, data || {}, { priority, issueName, classification });

    if (!isMonitoringEnabled()) return;

    Sentry.withScope((scope) => {
        if (data) {
            scope.setContext("telemetry", data);
            Object.entries(data).forEach(([key, value]) => {
                if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                    scope.setTag(key, String(value));
                }
            });
        }
        scope.setTag("priority", priority);
        scope.setTag("classification", classification);
        scope.setTag("issue_name", issueName);
        scope.setLevel(getClassificationLevel(classification));
        if (options?.fingerprint?.length) {
            scope.setFingerprint(options.fingerprint);
        } else {
            scope.setFingerprint([classification, issueName, normalizedError.message]);
        }
        Sentry.captureException(normalizedError);
    });
}

export async function reportIssue(options?: {
    user?: AppUser | null;
    screen?: string;
    error?: unknown;
    extra?: TelemetryContext;
}) {
    const subject = encodeURIComponent(getIssueSubject());
    const body = encodeURIComponent(buildIssueBody(options));
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    await Linking.openURL(url);
}
