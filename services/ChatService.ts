import { supabase } from '../utils/supabase';
import { profileRest } from '../utils/profileRest';
import { authService } from './AuthService';
import { MessageMetadata } from '../types/chat';
import { filterMessage, recordMessageSent, getFilterErrorMessage } from '../utils/chatFilter';

/** Thrown when a message is blocked by the content filter */
export class ChatFilterError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ChatFilterError';
    }
}

class ChatService {
    private async _withTimeout<T>(promise: Promise<T>, label: string, timeoutMs: number): Promise<T> {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        try {
            return await Promise.race([
                promise,
                new Promise<T>((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
                }),
            ]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    private async _getAccessToken(): Promise<string> {
        const cached = authService.getCachedAccessToken();
        if (cached) return cached;

        const { data } = await Promise.race([
            supabase.auth.getSession(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('auth.getSession timeout after 1500ms')), 1500))
        ]) as any;

        const token = data?.session?.access_token;
        if (!token) {
            throw new Error('Sessione assente o token utente non disponibile');
        }
        authService.setCachedAccessToken(token);
        return token;
    }

    /**
     * Fetch all conversations for a specific user
     */
    async getConversations(userId: string) {
        const accessToken = await this._getAccessToken();
        const data = await profileRest.getChatInbox(userId, accessToken);

        const visibleConversations = (data || []).map((row: any) => ({
            conversation_id: row.conversation_id,
            last_read_at: row.last_read_at,
            inbox_visible_at: row.inbox_visible_at,
            unread_count: row.unread_count || 0,
            inbox_title: row.title,
            inbox_avatar_url: row.avatar_url,
            other_user_id: row.other_user_id,
            conversations: {
                id: row.conversation_id,
                type: row.conversation_type,
                activity_id: row.activity_id,
                created_at: row.created_at,
                last_message_content: row.last_message_content,
                last_message_at: row.last_message_at,
                last_message_sender_id: row.last_message_sender_id,
                activities: row.conversation_type === 'ACTIVITY_GROUP' ? { title: row.title } : null,
                participants: row.other_user_id ? [{
                    user_id: row.other_user_id,
                    profiles: {
                        name: row.title,
                        npo_name: row.title,
                        avatar: row.avatar_url,
                    }
                }] : [],
            }
        }));

        // Filter out conversations with blocked users
        try {
            const blockedIds = await this.getBlockedUserIds(userId);
            if (blockedIds.length > 0) {
                return visibleConversations.filter((p: any) => {
                    if (p.conversations?.type === 'PRIVATE') {
                        const other = p.conversations.participants?.find((part: any) => part.user_id !== userId);
                        if (other && blockedIds.includes(other.user_id)) {
                            return false;
                        }
                    }
                    return true;
                });
            }
        } catch (e) {
            console.error('Error filtering blocked users in conversations:', e);
        }

        return visibleConversations.sort((a: any, b: any) => {
            const aConv = a.conversations;
            const bConv = b.conversations;
            const aTime = new Date(aConv?.last_message_at || a.inbox_visible_at || aConv?.created_at || 0).getTime();
            const bTime = new Date(bConv?.last_message_at || b.inbox_visible_at || bConv?.created_at || 0).getTime();
            return bTime - aTime;
        });
    }

    /**
     * Start a private conversation between two users
     */
    async startPrivateConversation(userId1: string, userId2: string) {
        const accessToken = await this._getAccessToken();
        const conversationId = await profileRest.startPrivateConversationBetween(userId1, userId2, accessToken);
        if (!conversationId) {
            throw new Error('Impossibile creare la conversazione privata');
        }

        return conversationId;
    }

    /**
     * Get details of a single conversation with messages
     */
    async getConversationDetails(conversationId: string) {
        const accessToken = await this._getAccessToken();
        const rows = await profileRest.getConversationMetadata(conversationId, accessToken);
        const data = Array.isArray(rows) ? rows[0] : rows;
        if (!data) throw new Error('Conversazione non trovata');

        // Auto-sync participants for group chats when details are fetched
        if (data && data.type === 'ACTIVITY_GROUP' && data.activity_id) {
            this.startGroupConversation(data.activity_id, data.activities?.title || '');
        }

        return data;
    }

    async getConversationMetadata(conversationId: string) {
        const accessToken = await this._getAccessToken();
        const rows = await profileRest.getConversationMetadata(conversationId, accessToken);
        const data = Array.isArray(rows) ? rows[0] : rows;
        if (!data) throw new Error('Conversazione non trovata');
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

        // ── Insert message ────────────────────────────────────────────────
        const accessToken = authService.getCachedAccessToken();
        if (!accessToken) {
            throw new Error('Token utente non disponibile per inviare il messaggio');
        }

        console.log('[DEBUG] ChatService: sendMessage rpc start', {
            conversationId,
            senderId,
            contentLength: content.length,
        });

        const rows = await profileRest.sendMessage({
            conversation_id: conversationId,
            sender_id: senderId,
            content,
            metadata,
        }, accessToken);

        const data = Array.isArray(rows) ? rows[0] : rows;
        if (!data) {
            throw new Error('Messaggio inviato ma risposta vuota');
        }

        console.log('[DEBUG] ChatService: sendMessage rpc completed', {
            conversationId,
            messageId: data.id,
        });

        // Record successful send for rate-limit window
        recordMessageSent();

        // Best-effort server-side moderation after send: never blocks delivery.
        void this._withTimeout(
            supabase.functions.invoke('chat-filter', {
                body: { message: content, userId: senderId },
            }),
            'chat-filter invoke background',
            1500
        ).catch((e) => {
            console.warn('chat-filter edge function unavailable after send:', e);
        });

        return data;
    }

    /**
     * Mark conversation as read
     */
    async markAsRead(conversationId: string, userId: string) {
        const accessToken = await this._getAccessToken();
        await profileRest.markConversationRead(conversationId, userId, accessToken);
    }

    async getMessages(conversationId: string, before?: string, limit: number = 20) {
        const accessToken = await this._getAccessToken();
        const data = await profileRest.getMessages(conversationId, before, limit, accessToken);
        return data;
    }

    /** Delete a single message. Only the sender can delete. Enforces a 2-minute window. */
    async deleteMessage(messageId: string, senderId: string) {
        // First verify ownership and time constraint client-side
        const { data: msg, error: fetchErr } = await supabase
            .from('messages')
            .select('id, sender_id, created_at')
            .eq('id', messageId)
            .single();

        if (fetchErr || !msg) throw new Error('Messaggio non trovato');
        if (msg.sender_id !== senderId) throw new Error('Non puoi eliminare messaggi altrui');

        const ageMs = Date.now() - new Date(msg.created_at).getTime();
        if (ageMs > 2 * 60 * 1000) throw new Error('Puoi eliminare solo messaggi inviati negli ultimi 2 minuti');

        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', messageId);

        if (error) throw error;
    }

    /** Hide the current user from a conversation inbox without destroying membership */
    async leaveConversation(conversationId: string, userId: string) {
        const accessToken = await this._getAccessToken();
        await profileRest.hideConversation(conversationId, userId, accessToken);
    }

    /**
     * Get NPOs available for chat (where user is participant/approved)
     */
    async getAvailableNpos(userId: string) {
        const accessToken = await this._getAccessToken();
        const [applications, followers, activityNpos] = await Promise.all([
            profileRest.listVolunteerChatApplications(userId, accessToken),
            profileRest.listVolunteerFollowedNpos(userId, accessToken),
            profileRest.listVolunteerActivityNpos(userId, accessToken),
        ]);

        const npoIds = Array.from(new Set([
            ...(applications || []).map((app: any) => app.npo_id),
            ...(followers || []).map((row: any) => row.npo_id),
            ...(activityNpos || []).map((row: any) => row.activities?.npo_id).filter(Boolean),
        ].filter(Boolean)));

        if (npoIds.length === 0) return { data: [] };

        const npos = await profileRest.getBasicProfiles(npoIds, accessToken);
        return { data: npos };
    }

    /**
     * Get available entities for an NPO to start a chat with
     */
    async getAvailableEntitiesForNPO(npoId: string) {
        const accessToken = await this._getAccessToken();
        const applications = await profileRest.listNpoApplications(npoId, accessToken);

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

        const activities = await profileRest.listNpoActivities(npoId, accessToken);
        const activityParticipants = await profileRest.listActivityParticipants((activities || []).map((a: any) => a.id), accessToken);
        const participantIds = Array.from(new Set((activityParticipants || []).map((p: any) => p.user_id).filter(Boolean)));
        const participantProfiles = await profileRest.getBasicProfiles(participantIds, accessToken);

        participantProfiles.forEach((profile: any) => {
            if (profile?.role === 'VOLUNTEER' && !volunteersMap.has(profile.id)) {
                volunteersMap.set(profile.id, {
                    id: profile.id,
                    name: profile.full_name || 'Volontario',
                    avatar: profile.avatar_url || undefined,
                    type: 'VOLUNTEER',
                    isGroup: false
                });
            }
        });

        const groups = activities
            ?.filter((a: any) => (activityParticipants || []).some((p: any) => p.activity_id === a.id))
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

            if (cErr) {
                const { data: fallbackExisting, error: fallbackErr } = await supabase
                    .from('conversations')
                    .select('id')
                    .eq('type', 'ACTIVITY_GROUP')
                    .eq('activity_id', activityId)
                    .single();

                if (fallbackErr || !fallbackExisting) throw cErr;
                convId = fallbackExisting.id;
            } else {
                convId = conversation.id;
            }
        }

        const { data: activityParts } = await supabase
            .from('activity_participants')
            .select('user_id')
            .eq('activity_id', activityId)
            .in('status', ['APPROVED', 'REGISTERED']);

        const participantIds = new Set((activityParts || []).map((p: any) => p.user_id));
        if (initiatorId) participantIds.add(initiatorId);

        if (participantIds.size > 0) {
            const { error: pErr } = await supabase.rpc('sync_group_conversation_participants', {
                p_conversation_id: convId,
                p_activity_id: activityId,
                p_initiator_id: initiatorId || null
            });

            if (pErr) console.error("Error syncing participants to group conversation via RPC:", pErr);
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

    /** Block a user. Inserts into blocked_users. */
    async blockUser(blockerId: string, targetId: string) {
        const { error } = await supabase
            .from('blocked_users')
            .insert({ blocker_id: blockerId, blocked_id: targetId });
        if (error) throw error;
    }

    /** Unblock a user. */
    async unblockUser(blockerId: string, targetId: string) {
        const { error } = await supabase
            .from('blocked_users')
            .delete()
            .eq('blocker_id', blockerId)
            .eq('blocked_id', targetId);
        if (error) throw error;
    }

    /**
     * Get all user IDs to filter out — both directions:
     * - users I blocked (I don't see them)
     * - users who blocked me (they don't see me)
     */
    async getBlockedUserIds(userId: string): Promise<string[]> {
        const [{ data: iBlocked }, { data: blockedMe }] = await Promise.all([
            supabase.from('blocked_users').select('blocked_id').eq('blocker_id', userId),
            supabase.from('blocked_users').select('blocker_id').eq('blocked_id', userId),
        ]);
        const ids = new Set<string>();
        iBlocked?.forEach((r: any) => ids.add(r.blocked_id));
        blockedMe?.forEach((r: any) => ids.add(r.blocker_id));
        return Array.from(ids);
    }
}

export default new ChatService();
