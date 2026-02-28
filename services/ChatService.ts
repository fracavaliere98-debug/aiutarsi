import { supabase } from '../utils/supabase';
import { Conversation, Message, ConversationParticipant, MessageMetadata } from '../types/chat';

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
                conversations (
                    id,
                    type,
                    activity_id,
                    created_at,
                    participants:conversation_participants (
                        user_id,
                        profiles (
                            full_name,
                            npo_name,
                            avatar_url
                        )
                    ),
                    messages (
                        id,
                        sender_id,
                        content,
                        created_at
                    )
                )
            `)
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching conversations:', error);
            throw error;
        }

        // The query returns nested messages. We handle this in UI layer or sort them.
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
                        full_name,
                        npo_name,
                        avatar_url,
                        role
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
     * Send a message
     */
    async sendMessage(conversationId: string, senderId: string, content: string, metadata: MessageMetadata = {}) {
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
                    full_name, 
                    avatar_url, 
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
                    name: (app.volunteer as any).full_name,
                    avatar: (app.volunteer as any).avatar_url,
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
    async startGroupConversation(activityId: string, title: string, initiatorId?: string) {
        let convId: string;

        const { data: existing, error: eErr } = await supabase
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

        // 3. Sync activity participants to conversation participants
        // Get all approved/registered volunteers for this activity
        const { data: activityParts } = await supabase
            .from('activity_participants')
            .select('user_id')
            .eq('activity_id', activityId)
            .in('status', ['APPROVED', 'REGISTERED']);

        const participantIds = new Set((activityParts || []).map(p => p.user_id));
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
}

export default new ChatService();
