import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useSegments } from 'expo-router';
import { supabase } from '../utils/supabase';
import { useAuth } from './AuthContext';
import ChatService from '../services/ChatService';

interface ChatContextType {
    conversations: any[];
    unreadCount: number;
    refreshConversations: () => Promise<void>;
    markAsRead: (conversationId: string) => Promise<void>;
    updateConversationPreview: (conversationId: string, content: string, senderId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const segments = useSegments();
    const [conversations, setConversations] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const conversationIdsRef = useRef<string[]>([]);
    const segmentKey = segments.join('/');
    const isQuietRoute = [
        '(volunteer)/settings',
        '(volunteer)/privacy',
        '(volunteer)/interests-skills',
        'blocked-users',
        '(volunteer)/referral',
        'help-center',
        '(npo)/settings',
        '(npo)/settings/privacy',
        '(npo)/edit-profile',
    ].some((route) => segmentKey.includes(route));

    useEffect(() => {
        conversationIdsRef.current = conversations.map((c: any) => c.conversation_id);
    }, [conversations]);

    const refreshConversations = useCallback(async () => {
        if (isQuietRoute) return;
        if (!user) return;
        try {
            const data = await ChatService.getConversations(user.id);
            setConversations(data);
            const totalUnread = data.reduce((acc: number, curr: any) => acc + (curr.unread_count || 0), 0);
            setUnreadCount(totalUnread);
        } catch (error) {
            console.error("Error refreshing conversations:", error);
        }
    }, [user, isQuietRoute]);

    // Optimistically update the preview for a conversation without a DB round-trip
    const updateConversationPreview = useCallback((conversationId: string, content: string, senderId: string) => {
        setConversations(prev => prev.map((c: any) => {
            if (c.conversation_id !== conversationId) return c;
            return {
                ...c,
                conversations: {
                    ...c.conversations,
                    last_message_content: content,
                    last_message_at: new Date().toISOString(),
                    last_message_sender_id: senderId,
                }
            };
        }));
    }, []);

    // Mark a conversation as read and immediately refresh the badge count
    const markAsRead = useCallback(async (conversationId: string) => {
        if (!user) return;
        try {
            await ChatService.markAsRead(conversationId, user.id);
        } catch { /* best-effort */ }
        // Always refresh regardless of whether markAsRead threw
        await refreshConversations();
    }, [refreshConversations, user]);

    useEffect(() => {
        if (isQuietRoute) return;
        if (!user) {
            setConversations([]);
            setUnreadCount(0);
            return;
        }

        refreshConversations();

        // Subscribe to conversations UPDATE (fires AFTER the DB trigger updates last_message_content)
        // This is the correct single source of truth for the preview.
        const messagesChannel = supabase.channel(`public:messages:context:${user.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => {
                    const conversationId = (payload.new as any)?.conversation_id;
                    if (conversationId && conversationIdsRef.current.includes(conversationId)) {
                        refreshConversations();
                    }
                }
            )
            .subscribe();

        // Subscribe to conversation_participants (new chats, read status changes)
        const participantsChannel = supabase.channel(`public:conv_participants:context:${user.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${user.id}` },
                () => { refreshConversations(); }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${user.id}` },
                () => { refreshConversations(); }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${user.id}` },
                () => { refreshConversations(); }
            )
            .subscribe();

        // Subscribe to conversations deletions
        const convsDeleteChannel = supabase.channel('public:conversations:delete')
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'conversations' },
                () => { refreshConversations(); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(messagesChannel);
            supabase.removeChannel(participantsChannel);
            supabase.removeChannel(convsDeleteChannel);
        };
    }, [refreshConversations, user, isQuietRoute]);

    useEffect(() => {
        if (!user || isQuietRoute) return;

        const conversationsChannel = supabase.channel(`public:conversations:context:${user.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'conversations' },
                () => { refreshConversations(); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(conversationsChannel);
        };
    }, [refreshConversations, user, isQuietRoute]);

    return (
        <ChatContext.Provider value={{ conversations, unreadCount, refreshConversations, markAsRead, updateConversationPreview }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) throw new Error("useChat must be used within ChatProvider");
    return context;
};
