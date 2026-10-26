import { supabase } from '../utils/supabase';
import { withTimeout } from '../utils/withTimeout';
import type { MyReportOutcome } from '../utils/reportCategory';

/**
 * A40 — Segnalazioni fatte dall'utente corrente, con l'esito che puo' vedere.
 * La tabella reports e' leggibile solo dall'admin: si passa dalla RPC get_my_reports, che restituisce
 * solo le righe dell'utente e un esito neutro (pending | action_taken | no_violation), mai la sanzione.
 */
export interface MyReport {
    id: string;
    contentType: string | null;
    reason: string;
    createdAt: string;
    resolutionDate: string | null;
    outcome: MyReportOutcome;
}

type MyReportRow = {
    id: string;
    content_type: string | null;
    reason: string | null;
    created_at: string;
    resolution_date: string | null;
    outcome: string | null;
};

const toOutcome = (value: string | null): MyReportOutcome =>
    value === 'action_taken' || value === 'no_violation' ? value : 'pending';

class MyReportsService {
    async getMyReports(): Promise<MyReport[]> {
        const { data, error } = await withTimeout(
            supabase.rpc('get_my_reports'),
            'myReports.list',
            8000
        );
        if (error) {
            console.error('Error loading my reports:', error);
            throw new Error('Impossibile caricare le tue segnalazioni.');
        }
        return ((data ?? []) as MyReportRow[]).map((row) => ({
            id: row.id,
            contentType: row.content_type,
            reason: row.reason ?? '',
            createdAt: row.created_at,
            resolutionDate: row.resolution_date,
            outcome: toOutcome(row.outcome),
        }));
    }
}

export const myReportsService = new MyReportsService();
