import { supabase } from "./supabase";

type ModerationInput = {
    caption?: string;
    imageUrl?: string;
};

type ModerationResult = {
    safe: boolean;
    reason?: string;
    category?: string;
};

export async function moderateCommunityContent({ caption, imageUrl }: ModerationInput): Promise<ModerationResult> {
    const { data, error } = await supabase.functions.invoke("community-moderator-ai", {
        body: {
            record: {
                id: `draft_${Date.now()}`,
                caption: caption || "",
                image_url: imageUrl || undefined,
                author_id: "draft",
            },
        },
    });

    if (error) {
        throw error;
    }

    return {
        safe: !!data?.analysis?.safe,
        reason: data?.analysis?.reason,
        category: data?.analysis?.category,
    };
}
