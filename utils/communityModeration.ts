import { Platform } from "react-native";
import { supabase } from "./supabase";

type ModerationInput = {
    caption?: string;
    imageUrl?: string;
};

type ChatModerationInput = {
    message: string;
    userId?: string;
    conversationId?: string;
};

type ModerationResult = {
    safe: boolean;
    reason?: string;
    category?: string;
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

async function invokeModeratorNative(body: Record<string, unknown>, timeoutMs = 8000): Promise<any> {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error("Supabase env mancanti.");
    }

    const url = `${SUPABASE_URL}/functions/v1/community-moderator-ai`;

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const timer = setTimeout(() => {
            xhr.abort();
            reject(new Error(`community-moderator-ai timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
        xhr.setRequestHeader("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);

        xhr.onreadystatechange = () => {
            if (xhr.readyState !== 4) return;
            clearTimeout(timer);

            if (xhr.status < 200 || xhr.status >= 300) {
                reject(new Error(xhr.responseText || `community-moderator-ai failed with ${xhr.status}`));
                return;
            }

            try {
                resolve(JSON.parse(xhr.responseText || "{}"));
            } catch (error) {
                reject(error);
            }
        };

        xhr.onerror = () => {
            clearTimeout(timer);
            reject(new Error("community-moderator-ai network error"));
        };

        try {
            xhr.send(JSON.stringify(body));
        } catch (error) {
            clearTimeout(timer);
            reject(error);
        }
    });
}

export async function moderateCommunityContent({ caption, imageUrl }: ModerationInput): Promise<ModerationResult> {
    const body = {
        record: {
            id: `draft_${Date.now()}`,
            caption: caption || "",
            image_url: imageUrl || undefined,
            author_id: "draft",
        },
    };

    try {
        const result = Platform.OS === "web"
            ? await supabase.functions.invoke("community-moderator-ai", { body })
            : { data: await invokeModeratorNative(body), error: null };

        if (result.error) {
            throw result.error;
        }

        return {
            safe: result.data?.analysis?.safe !== false,
            reason: result.data?.analysis?.reason,
            category: result.data?.analysis?.category,
        };
    } catch (error) {
        console.warn("[CommunityModeration] unavailable, allowing content", error);
        return {
            safe: true,
            reason: "Moderazione temporaneamente non disponibile.",
            category: "none",
        };
    }
}

export async function moderateChatMessage({ message, userId, conversationId }: ChatModerationInput): Promise<ModerationResult> {
    const body = {
        chat: {
            message,
            user_id: userId,
            conversation_id: conversationId,
        },
    };

    try {
        const result = Platform.OS === "web"
            ? await supabase.functions.invoke("community-moderator-ai", { body })
            : { data: await invokeModeratorNative(body), error: null };

        if (result.error) {
            throw result.error;
        }

        return {
            safe: result.data?.analysis?.safe !== false,
            reason: result.data?.analysis?.reason,
            category: result.data?.analysis?.category,
        };
    } catch (error) {
        console.warn("[ChatModeration] unavailable, allowing content", error);
        return {
            safe: true,
            reason: "Moderazione temporaneamente non disponibile.",
            category: "none",
        };
    }
}
