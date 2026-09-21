import { supabase } from '../utils/supabase';
import { withTimeout } from '../utils/withTimeout';

/**
 * Notifiche manuali dell'admin (esito verifica ente, esito segnalazione).
 * Passano dalla RPC admin_send_notification: il DB verifica che il chiamante sia ADMIN
 * e limita i tipi a INFO / SUCCESS / URGENT. Nessun insert diretto su notifications.
 */
class AdminNotificationService {
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
