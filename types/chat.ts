export interface Conversation {
    id: string;
    type: 'PRIVATE' | 'ACTIVITY_GROUP';
    activity_id?: string;
    created_at: string;
    last_message_content?: string | null;
    last_message_at?: string | null;
    last_message_sender_id?: string | null;
}

export interface ConversationParticipant {
    conversation_id: string;
    user_id: string;
    last_read_at: string;
}

export interface MessageMetadata {
    imageUrl?: string;
    linkUrl?: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
    [key: string]: any;
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    metadata: MessageMetadata;
    created_at: string;
}

export interface UnreadMessageCount {
    user_id: string;
    conversation_id: string;
    unread_count: number;
}
