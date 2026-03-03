import { supabase } from '../utils/supabase';
import { Conversation, Message, ConversationParticipant, MessageMetadata } from '../types/chat';
import { filterMessage, recordMessageSent, getFilterErrorMessage } from '../utils/chatFilter';

/** Thrown when a message is blocked by the content filter */
export class ChatFilterError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ChatFilterError';
    }
}

class ChatService {
    /**
     * Fetch all conversations for a specific user
     */
    async getConversations(userId: string) {
        const { data, error } = await supabase
            .from('conversation_participants')
            .select(`
                conversation_id,
                last_read_at,
                conversations!inner (
                    id,
                    type,
                    activity_id,
                    created_at,
                    last_message_at,
                    last_message_sender_id,
                    activities (title),
                    participants:conversation_participants (
                        user_id,
                        profiles (
                            name:full_name,
                            npo_name,
                            avatar:avatar_url
                        )
                    ),
                    last_message:messages (
                        id,
                        content,
                        sender_id,
                        created_at
                    )
                )
            `)
            .eq('user_id', userId)
            .order('last_message_at', { foreignTable: 'conversations', ascending: false })
            .order('created_at', { foreignTable: 'conversations.messages', ascending: false })
            .limit(1, { foreignTable: 'conversations.messages' });

        if (error) {
            console.error('Error fetching conversations:', error);
            throw error;
        }

        return data;
    }

    /**
     * Start a private conversation between two users
     */
    async startPrivateConversation(userId1: string, userId2: string) {
        // Checking if conversation already exists
        // Find conversations where both users are participants
        const { data: existingParticipant, error: errCheck } = await supabase
            .from('conversation_participants')
            .select('conversation_id, conversations!inner(type)')
            .eq('user_id', userId1)
            .eq('conversations.type', 'PRIVATE');

        if (errCheck) console.error('Error checking existing conversation:', errCheck);

        if (existingParticipant && existingParticipant.length > 0) {
            const convIds = existingParticipant.map(p => p.conversation_id);

            // Check if userId2 is also a participant in any of these private conversations
            const { data: commonPart, error: errCommon } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .in('conversation_id', convIds)
                .eq('user_id', userId2)
                .single();

            if (commonPart) {
                return commonPart.conversation_id;
            }
        }

        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .insert({ type: 'PRIVATE' })
            .select()
            .single();

        if (convError) throw convError;

        await supabase.from('conversation_participants').insert([
            { conversation_id: conversation.id, user_id: userId1 },
            { conversation_id: conversation.id, user_id: userId2 }
        ]);

        return conversation.id;
    }

    /**
     * Get details of a single conversation with messages
     */
    async getConversationDetails(conversationId: string) {
        const { data, error } = await supabase
            .from('conversations')
            .select(`
                *,
                activities (
                    title,
                    npo:profiles!npo_id (
                        npo_name
                    )
                ),
                participants:conversation_participants (
                    user_id,
                    profiles (
                        name:full_name,
                        npo_name,
                        avatar:avatar_url,
                        role,
                        phone,
                        allow_calls,
                        last_seen_at
                    )
                ),
                messages (*)
            `)
            .eq('id', conversationId)
            .single();

        if (error) throw error;

        // Auto-sync participants for group chats when details are fetched
        if (data && data.type === 'ACTIVITY_GROUP' && data.activity_id) {
            this.startGroupConversation(data.activity_id, data.activities?.title || '');
        }

        return data;
    }

    /**
     * Send a message, running content filter checks first.
     * Throws ChatFilterError if blocked by spam/banned-word filter.
     */
    async sendMessage(conversationId: string, senderId: string, content: string, metadata: MessageMetadata = {}) {
        // ── Layer 1: Client-side filter (instant, no network) ──────────────
        const clientResult = filterMessage(content);
        if (clientResult.blocked) {
            throw new ChatFilterError(getFilterErrorMessage(clientResult));
        }

        // ── Layer 2: Server-side Edge Function (authoritative) ─────────────
        try {
            const { data: fnData, error: fnError } = await supabase.functions.invoke('chat-filter', {
                body: { message: content, userId: senderId },
            });
            if (!fnError && fnData && fnData.allowed === false) {
                const reasonMap: Record<string, string> = {
                    rate_limit: '🕐 Stai scrivendo troppo velocemente. Aspetta qualche secondo.',
                    banned_word: '⛔ Messaggio non consentito: contiene parole inappropriate.',
                    spam_url: '🔗 I link non sono consentiti in questa chat.',
                    spam_pattern: '⚠️ Messaggio bloccato: rilevato contenuto spam.',
                    missing_fields: '⛔ Messaggio non valido.',
                };
                throw new ChatFilterError(reasonMap[fnData.reason] ?? '⛔ Messaggio non inviato.');
            }
        } catch (e) {
            // Re-throw only ChatFilterErrors; network/server errors are fail-open
            if (e instanceof ChatFilterError) throw e;
            console.warn('chat-filter edge function unavailable, continuing:', e);
        }

        // ── Insert message ────────────────────────────────────────────────
        const { data, error } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_id: senderId,
                content,
                metadata
            })
            .select()
            .single();

        if (error) throw error;

        // Record successful send for rate-limit window
        recordMessageSent();

        // Update conversation preview
        await supabase
            .from('conversations')
            .update({
                last_message_content: content,
                last_message_at: data.created_at,
                last_message_sender_id: senderId
            })
            .eq('id', conversationId);

        return data;
    }

    /**
     * Mark conversation as read
     */
    async markAsRead(conversationId: string, userId: string) {
        const { error } = await supabase
            .from('conversation_participants')
            .update({ last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', userId);

        if (error) throw error;
    }

    /**
     * Get messages for a specific conversation
     */
    async getMessages(conversationId: string) {
        const { data, error } = await supabase
            .from('messages')
            .select(`
                *,
                profiles:sender_id (
                    name:full_name,
                    avatar:avatar_url
                )
            `)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }
    /**
     * Get NPOs available for chat (where user is participant/approved)
     */
    async getAvailableNpos(userId: string) {
        // Find NPOs where the user has applied
        const { data: applications, error } = await supabase
            .from('applications')
            .select('npo_id')
            .eq('volunteer_id', userId);

        if (error) throw error;

        // @ts-ignore - Handle nested object from join
        const npoIds = Array.from(new Set(applications?.map(app => app.npo_id).filter(id => !!id)));

        if (npoIds.length === 0) return { data: [] };

        const { data: npos, error: npoErr } = await supabase
            .from('profiles')
            .select('*')
            .in('id', npoIds);

        if (npoErr) throw npoErr;
        return { data: npos };
    }

    /**
     * Get available entities for an NPO to start a chat with
     */
    async getAvailableEntitiesForNPO(npoId: string) {
        // 1. Get Volunteers who have joined this NPO (from applications table)
        const { data: applications, error: appErr } = await supabase
            .from('applications')
            .select(`
                volunteer_id,
                volunteer:profiles!applications_volunteer_id_fkey (
                    id, 
                    name:full_name, 
                    npo_name,
                    avatar:avatar_url, 
                    role
                )
            `)
            .eq('npo_id', npoId)
        // .eq('status', 'APPROVED') // Se vogliamo solo quelli approvati

        if (appErr) {
            console.error('Error fetching NPO volunteers:', appErr);
            throw appErr;
        }

        const volunteersMap = new Map();
        applications?.forEach(app => {
            if (app.volunteer && !volunteersMap.has(app.volunteer_id)) {
                volunteersMap.set(app.volunteer_id, {
                    id: app.volunteer_id,
                    name: (app.volunteer as any).npo_name || (app.volunteer as any).name,
                    avatar: (app.volunteer as any).avatar,
                    type: 'VOLUNTEER',
                    isGroup: false
                });
            }
        });

        // 2. Get Activity Groups (activities created by this NPO)
        // We only want activities that have participants
        const { data: activities, error: aErr } = await supabase
            .from('activities')
            .select('id, title, activity_participants(count)')
            .eq('npo_id', npoId)
            .neq('status', 'CANCELLATA');

        if (aErr) throw aErr;

        const groups = activities
            ?.filter(a => (a.activity_participants as any)?.[0]?.count > 0)
            .map(a => ({
                id: a.id,
                name: a.title,
                type: 'ACTIVITY_GROUP',
                isGroup: true
            })) || [];

        return {
            volunteers: Array.from(volunteersMap.values()),
            groups: groups
        };
    }

    /**
     * Start or get an activity group conversation
     */
    async startGroupConversation(activityId: string, title: string, initiatorId?: string): Promise<string> {
        // ... (existing implementation)
        let convId: string;

        const { data: existing } = await supabase
            .from('conversations')
            .select('id')
            .eq('type', 'ACTIVITY_GROUP')
            .eq('activity_id', activityId)
            .single();

        if (existing) {
            convId = existing.id;
        } else {
            const { data: conversation, error: cErr } = await supabase
                .from('conversations')
                .insert({
                    type: 'ACTIVITY_GROUP',
                    activity_id: activityId
                })
                .select()
                .single();

            if (cErr) throw cErr;
            convId = conversation.id;
        }

        const { data: activityParts } = await supabase
            .from('activity_participants')
            .select('user_id')
            .eq('activity_id', activityId)
            .in('status', ['APPROVED', 'REGISTERED']);

        const participantIds = new Set((activityParts || []).map((p: any) => p.user_id));
        if (initiatorId) participantIds.add(initiatorId);

        if (participantIds.size > 0) {
            const upsertData = Array.from(participantIds).map(uid => ({
                conversation_id: convId,
                user_id: uid
            }));

            const { error: pErr } = await supabase
                .from('conversation_participants')
                .upsert(upsertData, { onConflict: 'conversation_id,user_id' });

            if (pErr) console.error("Error syncing participants to group conversation:", pErr);
        }

        return convId;
    }

    /**
     * Toggle notification muting for a specific conversation
     */
    async toggleNotifications(conversationId: string, userId: string, muted: boolean) {
        const { error } = await supabase
            .from('conversation_participants')
            .update({ notifications_muted: muted })
            .eq('conversation_id', conversationId)
            .eq('user_id', userId);

        if (error) throw error;
        return true;
    }
}

export default new ChatService();
