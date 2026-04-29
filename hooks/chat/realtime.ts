import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../utils/supabase";
import { chatKeys } from "./keys";

export function useChatInboxRealtime(userId?: string, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !userId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleInvalidation = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: chatKeys.inbox(userId) }),
          queryClient.invalidateQueries({ queryKey: chatKeys.unreadCount(userId) }),
        ]);
      }, 500);
    };

    const participantsChannel = supabase
      .channel(`chat-inbox-participants-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants", filter: `user_id=eq.${userId}` }, scheduleInvalidation)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(participantsChannel);
    };
  }, [enabled, queryClient, userId]);
}

export function useConversationRealtime(conversationId?: string, userId?: string, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !conversationId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const messagesChannel = supabase
      .channel(`chat-conversation-messages-${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) }),
            queryClient.invalidateQueries({ queryKey: chatKeys.conversation(conversationId) }),
          ]);
        }, 300);
      })
      .subscribe();

    const participantsChannel = supabase
      .channel(`chat-conversation-participants-${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants", filter: `conversation_id=eq.${conversationId}` }, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: chatKeys.conversation(conversationId) }),
            queryClient.invalidateQueries({ queryKey: chatKeys.conversationMembers(conversationId) }),
          ]);
        }, 300);
      })
      .subscribe();

    const conversationsChannel = supabase
      .channel(`chat-conversation-${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` }, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: chatKeys.conversation(conversationId) }),
            queryClient.invalidateQueries({ queryKey: chatKeys.inbox(userId) }),
          ]);
        }, 300);
      })
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(participantsChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, [conversationId, enabled, queryClient, userId]);
}
