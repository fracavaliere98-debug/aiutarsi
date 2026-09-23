/**
 * FONTE DI VERITA' per gli id/label delle 6 categorie/settori canonici — letta sia dall'app
 * (constants/Interests.ts ci attacca sopra icona/emoji/descrizione/immagine) sia dalla edge
 * function Deno activity-curator-ai (supabase/functions/activity-curator-ai/index.ts), che prima
 * teneva una copia scritta a mano tenuta in sync manualmente. Stesso pattern già in uso in questo
 * repo per shared/helpCenterContent.ts.
 *
 * Solo dati puri (id/label): NON aggiungere qui import di icone o di qualsiasi modulo React
 * Native — vedi shared/skillsTaxonomy.ts per il motivo.
 *
 * Usata per: interessi personali del volontario, settori in cui opera una NPO (stessa tabella
 * user_interests, stessa lista — vedi constants/Interests.ts) e categoria di un'attività
 * (activities.category). Nessuna sovrapposizione di id/label con SKILL_TAXONOMY — verificato da
 * scripts/test_skills_taxonomy_contract.ts.
 */
export interface CategoryTaxonomyItem {
    id: string;
    label: string;
}

export const CATEGORY_TAXONOMY: CategoryTaxonomyItem[] = [
    { id: "ambiente", label: "Ambiente" },
    { id: "sociale", label: "Sociale" },
    { id: "educazione", label: "Educazione" },
    { id: "animali", label: "Animali" },
    { id: "arte", label: "Arte & Cultura" },
    { id: "salute", label: "Salute" },
];
