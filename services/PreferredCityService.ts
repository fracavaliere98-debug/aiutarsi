import { supabase } from '../utils/supabase';
import { withTimeout } from '../utils/withTimeout';

/**
 * P11 — "Posizione preferita" del volontario: un capoluogo di provincia scelto da lui, mai rilevato dal telefono.
 * La visibilita' e' decisa dal server (RLS su volunteer_preferred_city): gli altri utenti ricevono la riga solo se
 * is_public = true. La posizione attuale (coordinate) non passa di qui ed e' usata solo lato server.
 */
export interface ProvincialCapital {
    code: string;
    name: string;
    provinceCode: string;
    region: string;
}

export interface PreferredCity extends ProvincialCapital {
    isPublic: boolean;
}

export type SetPreferredCityStatus = 'ok' | 'cleared' | 'unknown_city' | 'not_volunteer';

type CapitalRow = { code: string; name: string; province_code: string; region: string };

const toCapital = (row: CapitalRow): ProvincialCapital => ({
    code: row.code,
    name: row.name,
    provinceCode: row.province_code,
    region: row.region,
});

class PreferredCityService {
    async getCapitals(): Promise<ProvincialCapital[]> {
        const { data, error } = await withTimeout(
            supabase.from('italian_provincial_capitals').select('code, name, province_code, region').order('name'),
            'preferredCity.getCapitals',
            8000
        );
        if (error) {
            console.error('Error loading provincial capitals:', error);
            throw new Error("Impossibile caricare l'elenco delle città.");
        }
        return ((data ?? []) as CapitalRow[]).map(toCapital);
    }

    /** Della persona stessa sempre; di un altro utente solo se l'ha resa pubblica (altrimenti null). */
    async getPreferredCity(userId: string): Promise<PreferredCity | null> {
        const { data, error } = await withTimeout(
            supabase
                .from('volunteer_preferred_city')
                .select('is_public, italian_provincial_capitals(code, name, province_code, region)')
                .eq('user_id', userId)
                .maybeSingle(),
            'preferredCity.getPreferredCity',
            8000
        );
        if (error) {
            console.error('Error loading preferred city:', error);
            throw new Error('Impossibile caricare la posizione preferita.');
        }
        const row = data as { is_public: boolean; italian_provincial_capitals: CapitalRow | CapitalRow[] | null } | null;
        const capital = Array.isArray(row?.italian_provincial_capitals)
            ? row?.italian_provincial_capitals[0]
            : row?.italian_provincial_capitals;
        if (!row || !capital) return null;
        return { ...toCapital(capital), isPublic: !!row.is_public };
    }

    /** cityCode null = nessuna preferenza (cancella). Il server verifica ruolo e codice. */
    async setMyPreferredCity(cityCode: string | null, isPublic: boolean): Promise<SetPreferredCityStatus> {
        const { data, error } = await withTimeout(
            supabase.rpc('set_my_preferred_city', { p_city_code: cityCode, p_is_public: isPublic }),
            'preferredCity.setMyPreferredCity',
            8000
        );
        if (error) {
            console.error('Error saving preferred city:', error);
            throw new Error('Impossibile salvare la posizione preferita.');
        }
        return ((data as { status?: SetPreferredCityStatus } | null)?.status ?? 'unknown_city') as SetPreferredCityStatus;
    }
}

export const preferredCityService = new PreferredCityService();
