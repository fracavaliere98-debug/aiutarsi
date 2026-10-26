import { supabase } from '../utils/supabase';
import { withTimeout } from '../utils/withTimeout';

/**
 * Notifiche manuali dell'admin (esito verifica ente, esito segnalazione).
 * Passano dalla RPC admin_send_notification: il DB verifica che il chiamante sia ADMIN
 * e limita i tipi a INFO / SUCCESS / URGENT. Nessun insert diretto su notifications.
 */
class AdminNotificationService {
    /**
     * A31: chiusura di una segnalazione (archivia / ammonisci / risolvi / banna) in un'unica
     * transazione lato server. La RPC admin_resolve_report verifica che il chiamante sia ADMIN,
     * applica il ban sul profilo segnalato (che il client non puo' scrivere: RLS + trigger di
     * protezione) e scrive l'audit log. Se qualcosa fallisce non cambia nulla.
     */
    async resolveReport(
        reportId: string,
        action: 'dismissed' | 'warned' | 'resolved' | 'banned',
        reason: string,
        userAgent?: string
    ): Promise<{ report_id: string; action: string; reported_id: string | null; reporter_id: string | null }> {
        const { data, error } = await withTimeout(
            supabase.rpc('admin_resolve_report', {
                p_report_id: reportId,
                p_action: action,
                p_reason: reason || null,
                p_user_agent: userAgent || null,
            }),
            'admin.resolveReport',
            10000
        );
        if (error) throw error;
        return data as any;
    }

    /** Sorgenti dell'inbox admin: segnalazioni e verifiche pendenti + notifiche personali dell'admin. */
    async fetchInboxSources(userId?: string): Promise<{ reports: any[]; verifications: any[]; personalNotifications: any[] }> {
        const [reportsRes, verificationsRes, personalRes] = await withTimeout(
            Promise.all([
                supabase
                    .from('reports')
                    .select('id, reason, content_type, created_at, status, reporter:profiles!reports_reporter_id_fkey(full_name), reported:profiles!reports_reported_id_fkey(full_name)')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(8),
                supabase
                    .from('verification_requests')
                    .select('id, created_at, status, npo_details, profiles:user_id(full_name, npo_name)')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(8),
                userId
                    ? supabase
                          .from('notifications')
                          .select('id, title, message, created_at, is_read')
                          .eq('user_id', userId)
                          .order('created_at', { ascending: false })
                          .limit(10)
                    : Promise.resolve({ data: [], error: null } as any),
            ]),
            'admin.fetchInbox',
            10000
        );
        if (reportsRes.error) throw reportsRes.error;
        if (verificationsRes.error) throw verificationsRes.error;
        if (personalRes.error) throw personalRes.error;
        return {
            reports: (reportsRes.data as any[]) || [],
            verifications: (verificationsRes.data as any[]) || [],
            personalNotifications: (personalRes.data as any[]) || [],
        };
    }

    async notifyUser(
        userId: string,
        type: 'INFO' | 'SUCCESS' | 'URGENT',
        title: string,
        message: string
    ): Promise<void> {
        const { error } = await withTimeout(
            supabase.rpc('admin_send_notification', {
                p_user_id: userId,
                p_type: type,
                p_title: title,
                p_message: message,
            }),
            'admin.sendNotification',
            8000
        );
        if (error) throw error;
    }
}

export const adminNotificationService = new AdminNotificationService();
