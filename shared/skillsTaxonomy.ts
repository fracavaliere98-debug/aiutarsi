/**
 * FONTE DI VERITA' per gli id/label delle 12 competenze canoniche — letta sia dall'app
 * (constants/Skills.ts ci attacca sopra icona/emoji) sia dalla edge function Deno
 * activity-curator-ai (supabase/functions/activity-curator-ai/index.ts), che prima teneva una
 * copia scritta a mano tenuta in sync manualmente. Stesso pattern già in uso in questo repo per
 * shared/helpCenterContent.ts (letto sia da app/help-center.tsx che da
 * supabase/functions/gemma-help-assistant/index.ts).
 *
 * Solo dati puri (id/label): NON aggiungere qui import di icone o di qualsiasi modulo React
 * Native (es. lucide-react-native) — è esattamente quello che impedirebbe a Deno di importare
 * questo file. Le icone restano in constants/Skills.ts, solo-app.
 *
 * L'id è la chiave stabile usata ovunque per salvare/confrontare le competenze (profilo
 * volontario, competenze cercate da un ente, competenze richieste da un'attività, Smart Match):
 * MAI la label, che può cambiare copy senza rompere i confronti. Rinominata il 2026-07-23 — vedi
 * supabase/migrations/20260723162626_rationalize_skills_taxonomy.sql per il backfill dei valori
 * legacy già salvati in user_skills/sought_skills/activity_skills. Verificato da
 * scripts/test_skills_taxonomy_contract.ts.
 */
export interface SkillTaxonomyItem {
    id: string;
    label: string;
}

export const SKILL_TAXONOMY: SkillTaxonomyItem[] = [
    { id: "assistenza-persona", label: "Assistenza alla persona" },
    { id: "primo-soccorso", label: "Primo soccorso" },
    { id: "insegnamento", label: "Insegnamento e tutoraggio" },
    { id: "manualita", label: "Manualità e lavori pratici" },
    { id: "cura-animali", label: "Cura degli animali" },
    { id: "cucina", label: "Cucina" },
    { id: "comunicazione-digitale", label: "Comunicazione e social media" },
    { id: "informatica", label: "Competenze informatiche" },
    { id: "creativita", label: "Creatività e grafica" },
    { id: "ascolto-compagnia", label: "Ascolto e compagnia" },
    { id: "lingue", label: "Lingue straniere" },
    { id: "sport", label: "Sport" },
];
