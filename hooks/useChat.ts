/**
 * useChat.ts
 * React Query hook for chat conversations.
 * Uses staleTime: 0 (always fresh) + Supabase Realtime subscription.
 * No polling — the subscription fires queryClient.invalidateQueries
 * whenever a new message arrives, triggering an instant re-fetch.
 *
 * Usage:
 *   const { conversations, isLoading } = useChat(userId);
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryClient } from '../providers/QueryProvider';
import ChatService from '../services/ChatService';
import { supabase } from '../utils/supabase';

export function useConversations(userId: string | undefined) {
    const query = useQuery({
        queryKey: ['conversations', userId],
        enabled: !!userId,
        staleTime: 0,           // Chat is always stale — Realtime keeps it fresh
        queryFn: () => ChatService.getConversations(userId!),
    });

    // ── Supabase Realtime subscription ──────────────────────────────────────
    // Invalidate the query whenever a message is inserted/updated in a
    // conversation that belongs to this user. No polling needed.
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`chat-realtime-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                },
                () => {
                    // New or updated message → invalidate conversation list
                    queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    return {
        conversations: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: query.refetch,
    };
}
