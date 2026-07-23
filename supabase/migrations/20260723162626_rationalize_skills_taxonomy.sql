-- Backfill per la nuova tassonomia competenze a 12 voci (constants/Skills.ts, 2026-07-23).
-- Prima di questa migration esistevano 3 formati diversi e incoerenti tra loro per lo stesso
-- concetto di "competenza": label lunghe storiche in user_skills/profiles.sought_skills
-- (es. "Educazione e Mentoring"), id/parole brevi eterogenee in activity_skills
-- (es. "educazione", "medical", "tech"), e il nuovo id-based taxonomy nel codice app.
-- Risultato: le competenze salvate dai volontari/NPO risultavano "deselezionate" nell'app perché
-- nessun valore combaciava più con SKILLS[].id. Questa migration rimappa tutti i valori legacy
-- sui 12 id canonici e scarta le voci corrispondenti a competenze eliminate
-- (Amministrazione, Logistica, Scrittura) o a valori sconosciuti/non mappabili.
--
-- Applicata su staging (pavnfiladmnwbptwlwpr, dati reali) e su prod (ibyjkqowokxrlormkwzw,
-- tabelle vuote al momento dell'applicazione — eseguita per parità di storico migrazioni).

CREATE TEMP TABLE _skill_migration_map (old_value text PRIMARY KEY, new_id text) ON COMMIT DROP;
INSERT INTO _skill_migration_map (old_value, new_id) VALUES
    ('Educazione e Mentoring', 'insegnamento'),
    ('Assistenza e Compagnia', 'assistenza-persona'),
    ('Supporto Sanitario e Soccorso', 'primo-soccorso'),
    ('Logistica e Distribuzione', NULL),
    ('Manutenzione e Ambiente', 'manualita'),
    ('Cucina e Mensa', 'cucina'),
    ('Creatività e Grafica', 'creativita'),
    ('Digital & Social Media', 'comunicazione-digitale'),
    ('Lingue e Traduzioni', 'lingue'),
    ('Scrittura e Storytelling', NULL),
    ('Sport per il Sociale', 'sport'),
    ('Tecnologia e IT', 'informatica'),
    ('Tutela Animali', 'cura-animali'),
    ('Amministrazione e Gestione', NULL),
    ('ambiente', 'manualita'),
    ('sanitario', 'primo-soccorso'),
    ('logistica', NULL),
    ('assistenza', 'assistenza-persona'),
    ('medical', 'primo-soccorso'),
    ('comms', 'comunicazione-digitale'),
    ('tech', 'informatica'),
    ('educazione', 'insegnamento'),
    ('scrittura', NULL),
    ('data', 'informatica'),
    ('digital', 'comunicazione-digitale');

-- ==== user_skills (competenze offerte dal volontario) ====
INSERT INTO public.user_skills (user_id, skill)
SELECT DISTINCT us.user_id, m.new_id
FROM public.user_skills us
JOIN _skill_migration_map m ON m.old_value = us.skill
WHERE m.new_id IS NOT NULL
ON CONFLICT (user_id, skill) DO NOTHING;

DELETE FROM public.user_skills
WHERE skill IN (SELECT old_value FROM _skill_migration_map)
   OR skill NOT IN (
        'assistenza-persona','primo-soccorso','insegnamento','manualita','cura-animali',
        'cucina','comunicazione-digitale','informatica','creativita','ascolto-compagnia',
        'lingue','sport'
   );

-- ==== activity_skills (competenze richieste da un'attività) ====
INSERT INTO public.activity_skills (activity_id, skill)
SELECT DISTINCT a.activity_id, m.new_id
FROM public.activity_skills a
JOIN _skill_migration_map m ON m.old_value = a.skill
WHERE m.new_id IS NOT NULL
ON CONFLICT (activity_id, skill) DO NOTHING;

DELETE FROM public.activity_skills
WHERE skill IN (SELECT old_value FROM _skill_migration_map)
   OR skill NOT IN (
        'assistenza-persona','primo-soccorso','insegnamento','manualita','cura-animali',
        'cucina','comunicazione-digitale','informatica','creativita','ascolto-compagnia',
        'lingue','sport'
   );

-- ==== profiles.sought_skills (competenze cercate dalla NPO, colonna array) ====
UPDATE public.profiles p
SET sought_skills = COALESCE(
    (
        SELECT array_agg(DISTINCT new_val)
        FROM (
            SELECT COALESCE(
                m.new_id,
                CASE WHEN s.val IN (
                    'assistenza-persona','primo-soccorso','insegnamento','manualita','cura-animali',
                    'cucina','comunicazione-digitale','informatica','creativita','ascolto-compagnia',
                    'lingue','sport'
                ) THEN s.val ELSE NULL END
            ) AS new_val
            FROM unnest(p.sought_skills) AS s(val)
            LEFT JOIN _skill_migration_map m ON m.old_value = s.val
        ) sub
        WHERE new_val IS NOT NULL
    ),
    '{}'::text[]
)
WHERE p.sought_skills IS NOT NULL AND p.sought_skills <> '{}';
