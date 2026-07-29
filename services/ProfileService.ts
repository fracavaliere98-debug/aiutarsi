import { supabase } from '../utils/supabase';
import { authService } from './AuthService';
import { withTimeout } from '../utils/withTimeout';

export class ProfileService {
    /**
     * Request account deletion (sets deletion_requested_at to now)
     */
    async requestAccountDeletion(userId: string): Promise<void> {
        const { error } = await withTimeout(
            supabase
                .from('profiles')
                .update({ deletion_requested_at: new Date().toISOString() })
                .eq('id', userId),
            'profile.requestAccountDeletion',
            8000
        );

        if (error) {
            console.error('Error requesting account deletion:', error);
            throw new Error('Impossibile richiedere l\'eliminazione dell\'account.');
        }

        // Sync local user state
        await authService.getCurrentUser();
    }

    /**
     * Cancel account deletion (sets deletion_requested_at to null)
     */
    async cancelAccountDeletion(userId: string): Promise<void> {
        const { error } = await withTimeout(
            supabase
                .from('profiles')
                .update({ deletion_requested_at: null })
                .eq('id', userId),
            'profile.cancelAccountDeletion',
            8000
        );

        if (error) {
            console.error('Error cancelling account deletion:', error);
            throw new Error('Impossibile annullare la richiesta di eliminazione.');
        }

        // Sync local user state
        await authService.getCurrentUser();
    }
}

export const profileService = new ProfileService();
