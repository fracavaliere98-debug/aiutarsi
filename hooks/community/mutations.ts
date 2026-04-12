import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ReactionType } from "../../types/community";
import { storageService } from "../../services/StorageService";
import { moderateCommunityContent } from "../../utils/communityModeration";
import { supabase } from "../../utils/supabase";
import { AppUser } from "../../types";
import { communityKeys } from "./keys";

async function invalidateCommunityQueries(queryClient: ReturnType<typeof useQueryClient>) {
    await queryClient.invalidateQueries({ queryKey: communityKeys.all });
}

async function moderatePostContent(caption: string, imageUrls: string[]) {
    if (imageUrls.length > 0) {
        for (const imageUrl of imageUrls) {
            const moderation = await moderateCommunityContent({ caption, imageUrl });
            if (!moderation.safe) {
                throw new Error(moderation.reason || "Contenuto non approvato dai controlli automatici.");
            }
        }
        return;
    }

    if (caption.trim()) {
        const moderation = await moderateCommunityContent({ caption });
        if (!moderation.safe) {
            throw new Error(moderation.reason || "Testo non approvato dai controlli automatici.");
        }
    }
}

export function useCreateCommunityPostMutation(user?: AppUser | null) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ caption, imageUris, linkedActivityId }: { caption: string; imageUris: string[]; linkedActivityId?: string }) => {
            if (!user) throw new Error("Missing user");

            const imageUrls = imageUris.length > 0
                ? await storageService.uploadCommunityImages(user.id, imageUris)
                : [];

            await moderatePostContent(caption, imageUrls);

            const { error } = await supabase.from("community_posts").insert({
                author_id: user.id,
                caption: caption || null,
                image_url: imageUrls[0] || null,
                images_urls: imageUrls.length > 0 ? imageUrls : null,
                linked_activity_id: linkedActivityId || null,
            });

            if (error) throw error;
        },
        onSuccess: async () => {
            await invalidateCommunityQueries(queryClient);
        },
    });
}

export function useUpdateCommunityPostMutation(user?: AppUser | null) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            postId,
            caption,
            newLocalUris,
            retainedExistingUrls,
            linkedActivityId,
        }: {
            postId: string;
            caption: string;
            newLocalUris: string[];
            retainedExistingUrls: string[];
            linkedActivityId?: string;
        }) => {
            if (!user) throw new Error("Missing user");

            const newUploadedUrls = newLocalUris.length > 0
                ? await storageService.uploadCommunityImages(user.id, newLocalUris)
                : [];

            const finalImageUrls = [...retainedExistingUrls, ...newUploadedUrls];
            await moderatePostContent(caption, finalImageUrls);

            const { error } = await supabase
                .from("community_posts")
                .update({
                    caption: caption || null,
                    image_url: finalImageUrls[0] || null,
                    images_urls: finalImageUrls.length > 0 ? finalImageUrls : null,
                    linked_activity_id: linkedActivityId || null,
                })
                .eq("id", postId)
                .eq("author_id", user.id);

            if (error) throw error;
        },
        onSuccess: async () => {
            await invalidateCommunityQueries(queryClient);
        },
    });
}

export function useDeleteCommunityPostMutation(user?: AppUser | null) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (postId: string) => {
            if (!user) throw new Error("Missing user");

            const { error } = await supabase
                .from("community_posts")
                .delete()
                .eq("id", postId)
                .eq("author_id", user.id);

            if (error) throw error;
        },
        onSuccess: async () => {
            await invalidateCommunityQueries(queryClient);
        },
    });
}

export function useReportCommunityPostMutation(user?: AppUser | null) {
    return useMutation({
        mutationFn: async ({ postId, reason }: { postId: string; reason: string }) => {
            if (!user) throw new Error("Missing user");

            const { error } = await supabase.from("community_reports").insert({
                post_id: postId,
                reporter_id: user.id,
                reason,
                status: "pending",
            });

            if (error) throw error;
        },
    });
}

export function useToggleCommunityReactionMutation(user?: AppUser | null) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ postId, reaction }: { postId: string; reaction: ReactionType }) => {
            if (!user) throw new Error("Missing user");

            const { data: existingReaction, error: existingReactionError } = await supabase
                .from("post_reactions")
                .select("id")
                .eq("post_id", postId)
                .eq("user_id", user.id)
                .eq("reaction", reaction)
                .maybeSingle();

            if (existingReactionError) throw existingReactionError;

            if (existingReaction?.id) {
                const { error } = await supabase.from("post_reactions").delete().eq("id", existingReaction.id);
                if (error) throw error;
                return;
            }

            const { error } = await supabase
                .from("post_reactions")
                .insert({ post_id: postId, user_id: user.id, reaction });

            if (error) throw error;
        },
        onSuccess: async () => {
            await invalidateCommunityQueries(queryClient);
        },
    });
}
