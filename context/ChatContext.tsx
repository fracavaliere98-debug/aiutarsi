import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './AuthContext';
import ChatService from '../services/ChatService';

interface ChatContextType {
    conversations: any[];
    unreadCount: number;
    refreshConversations: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const refreshConversations = async () => {
        if (!user) return;
        try {
            const data = await ChatService.getConversations(user.id);
            // Sorting is now handled by the backend (order by last_message_at DESC)
            setConversations(data);

            // Fetch unread count from view
            const { data: unreadData } = await supabase
                .from('unread_message_counts')
                .select('unread_count')
                .eq('user_id', user.id);

            const totalUnread = unreadData?.reduce((acc, curr) => acc + (curr.unread_count || 0), 0) || 0;
            setUnreadCount(totalUnread);
        } catch (error) {
            console.error("Error refreshing conversations:", error);
        }
    };

    useEffect(() => {
        if (!user) {
            setConversations([]);
            setUnreadCount(0);
            return;
        }

        refreshConversations();

        // Subscribe to messages INSERT (new message arrives)
        const msgsChannel = supabase.channel('public:messages:context')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                () => { refreshConversations(); }
            )
            .subscribe();

        // Subscribe to conversation_participants UPDATE (last_read_at changes when marking read)
        const participantsChannel = supabase.channel('public:conv_participants:context')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'conversation_participants' },
                () => { refreshConversations(); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(msgsChannel);
            supabase.removeChannel(participantsChannel);
        };
    }, [user]);

    return (
        <ChatContext.Provider value={{ conversations, unreadCount, refreshConversations }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) throw new Error("useChat must be used within ChatProvider");
    return context;
};
