/**
 * Regression/contract test per la razionalizzazione della tassonomia competenze (2026-07-23).
 *
 * Prima di questo fix esistevano 3 formati diversi per lo stesso concetto di "competenza":
 *  - label lunghe storiche già salvate in DB (user_skills, profiles.sought_skills), es.
 *    "Educazione e Mentoring"
 *  - id/parole brevi eterogenee in activity_skills, es. "educazione", "medical", "tech"
 *  - un elenco di label brevi nel codice app, diverso da entrambi
 * Il codice onboarding/settings confrontava per label, quindi le competenze salvate da un
 * volontario non risultavano mai selezionate quando riapriva la schermata, e "competenza
 * richiesta da un'attività" non combaciava mai con "competenza offerta da un volontario"
 * (vedi hooks/smart-match/selectors.ts, confronto stringa letterale).
 *
 * Il fix introduce un'unica tassonomia id-based (12 voci, constants/Skills.ts) usata ovunque:
 * onboarding NPO e volontario, settings NPO e volontario, form attività, dettaglio attività,
 * profilo, activity-curator-ai. Le 12 voci sono competenze reali di una persona, distinte dalle
 * 6 categorie/settori in cui una NPO dichiara di operare (constants/Interests.ts) — nessuna
 * sovrapposizione di id/label tra le due liste. Un backfill SQL
 * (supabase/migrations/*_rationalize_skills_taxonomy.sql) ha rimappato i valori legacy già
 * salvati sui 12 id canonici.
 *
 * Sono controlli statici sul codice sorgente (no Metro, no rendering React Native, no DB),
 * stesso approccio di scripts/test_settings_structure_contract.ts.
 *
 * Run: npx tsx scripts/test_skills_taxonomy_contract.ts
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

const REPO_ROOT = join(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

const EXPECTED_SKILL_IDS = [
  "assistenza-persona",
  "primo-soccorso",
  "insegnamento",
  "manualita",
  "cura-animali",
  "cucina",
  "comunicazione-digitale",
  "informatica",
  "creativita",
  "ascolto-compagnia",
  "lingue",
  "sport",
];

const REMOVED_SKILL_IDS = ["amministrazione", "logistica", "scrittura"];

const CATEGORY_IDS = ["ambiente", "sociale", "educazione", "animali", "arte", "salute"];
const CATEGORY_LABELS = ["Ambiente", "Sociale", "Educazione", "Animali", "Arte & Cultura", "Salute"];

function extractIdBlock(source: string, arrayStartMarker: string): string {
  const start = source.indexOf(arrayStartMarker);
  assert(start !== -1, `marker "${arrayStartMarker}" non trovato`);
  const end = source.indexOf("\n];", start);
  assert(end !== -1, `fine array non trovata dopo "${arrayStartMarker}"`);
  return source.slice(start, end);
}

function testSkillsConstantHas12CanonicalIds() {
  console.log("\n[constants/Skills.ts] 12 competenze canoniche, id-based");

  const source = readSource("constants/Skills.ts");
  const block = extractIdBlock(source, "export const SKILLS: SkillItem[] = [");

  const idMatches = [...block.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert(idMatches.length === 12, `SKILLS deve avere esattamente 12 voci, trovate ${idMatches.length}`);
  pass("SKILLS ha esattamente 12 voci");

  const uniqueIds = new Set(idMatches);
  assert(uniqueIds.size === idMatches.length, "SKILLS contiene id duplicati");
  pass("nessun id duplicato in SKILLS");

  for (const id of EXPECTED_SKILL_IDS) {
    assert(idMatches.includes(id), `SKILLS deve contenere l'id "${id}"`);
  }
  pass("tutti i 12 id attesi sono presenti");

  for (const id of REMOVED_SKILL_IDS) {
    assert(!idMatches.includes(id), `REGRESSIONE: SKILLS non deve più contenere "${id}" (rimosso su richiesta esplicita)`);
  }
  pass("Amministrazione, Logistica e Scrittura non sono più presenti come competenze");

  assert(idMatches.includes("ascolto-compagnia"), "SKILLS deve contenere la nuova soft skill 'ascolto-compagnia' al posto di Scrittura");
  assert(block.includes('label: "Ascolto e compagnia"'), "la label di 'ascolto-compagnia' deve essere 'Ascolto e compagnia'");
  pass("la soft skill relazionale 'Ascolto e compagnia' sostituisce Scrittura");

  assert(source.includes("export const getSkillLabel"), "constants/Skills.ts deve esportare getSkillLabel()");
  pass("getSkillLabel() è esportato");
}

function testNoOverlapBetweenSkillsAndCategories() {
  console.log("\n[constants/Skills.ts vs constants/Interests.ts] nessun doppione competenza/categoria");

  const skillsSource = readSource("constants/Skills.ts");
  const block = extractIdBlock(skillsSource, "export const SKILLS: SkillItem[] = [");
  const skillIds = [...block.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
  const skillLabels = [...block.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);

  for (const catId of CATEGORY_IDS) {
    assert(!skillIds.includes(catId), `REGRESSIONE: l'id competenza "${catId}" duplica un id categoria di INTERESTS`);
  }
  for (const catLabel of CATEGORY_LABELS) {
    assert(
      !skillLabels.some((l) => l.toLowerCase() === catLabel.toLowerCase()),
      `REGRESSIONE: la label competenza "${catLabel}" duplica letteralmente una categoria di INTERESTS`
    );
  }
  pass("nessun id/label di SKILLS combacia con un id/label di INTERESTS (categorie/settori NPO)");
}

function testOnboardingAndSettingsUseSkillIds() {
  console.log("\n[Onboarding + Settings] toggle competenze basato su id, non su label");

  const filesWithToggleSkill = [
    "app/onboarding/npo-skills.tsx",
    "app/onboarding/skills.tsx",
    "app/(volunteer)/interests-skills.tsx",
    "app/(npo)/interests-skills.tsx",
  ];

  for (const path of filesWithToggleSkill) {
    const source = readSource(path);

    // Scoperto solo il blocco che renderizza SKILLS.map: i file interests-skills.tsx renderizzano
    // ANCHE INTERESTS.map, che legittimamente confronta/salva per item.label (le categorie non
    // sono state toccate da questa razionalizzazione) — non vogliamo un falso positivo su quello.
    const skillsBlockStart = source.indexOf("SKILLS.map");
    assert(skillsBlockStart !== -1, `${path} deve renderizzare SKILLS.map`);
    const skillsBlock = source.slice(skillsBlockStart);

    assert(
      /toggleSkill\(item\.id\)/.test(skillsBlock),
      `${path} deve chiamare toggleSkill(item.id), non toggleSkill(item.label)`
    );
    assert(
      !/toggleSkill\(item\.label\)/.test(skillsBlock),
      `REGRESSIONE: ${path} chiama ancora toggleSkill(item.label) — le competenze devono essere salvate per id`
    );
    assert(
      /\.includes\(item\.id\)/.test(skillsBlock),
      `${path} deve confrontare la selezione con item.id (es. selected.includes(item.id)), non item.label`
    );
    assert(
      !/\.includes\(item\.label\)/.test(skillsBlock),
      `REGRESSIONE: ${path} confronta ancora la selezione competenze con item.label`
    );
  }
  pass("onboarding NPO/volontario e settings NPO/volontario usano tutti item.id per selezionare le competenze");
}

function testDisplaySectionsUseGetSkillLabel() {
  console.log("\n[Profilo + Anteprima NPO] le competenze sono mostrate con getSkillLabel(), non come id grezzo");

  const skillInterestSection = readSource("components/profile/SkillInterestSection.tsx");
  assert(
    skillInterestSection.includes('import { getSkillLabel } from "../../constants/Skills"'),
    "SkillInterestSection.tsx deve importare getSkillLabel"
  );
  assert(
    skillInterestSection.includes("{getSkillLabel(skill)}"),
    "SkillInterestSection.tsx deve renderizzare {getSkillLabel(skill)}, non {skill} grezzo"
  );
  pass("components/profile/SkillInterestSection.tsx usa getSkillLabel() per le chip competenze");

  const npoPreview = readSource("app/onboarding/npo-preview.tsx");
  assert(
    /import\s*\{\s*getSkillLabel\s*\}\s*from\s*['"].*constants\/Skills['"]/.test(npoPreview),
    "app/onboarding/npo-preview.tsx deve importare getSkillLabel da constants/Skills (altrimenti tsc fallisce: 'Cannot find name getSkillLabel')"
  );
  assert(
    npoPreview.includes("{getSkillLabel(skill)}"),
    "REGRESSIONE: app/onboarding/npo-preview.tsx deve renderizzare {getSkillLabel(skill)} nella sezione 'Skill ricercate', non l'id grezzo {skill}"
  );
  pass("app/onboarding/npo-preview.tsx mostra le skill ricercate tramite getSkillLabel()");
}

function testActivityCuratorAiInSyncWithCanonicalSkillIds() {
  console.log("\n[activity-curator-ai] SKILL_IDS della edge function allineati a constants/Skills.ts");

  const source = readSource("supabase/functions/activity-curator-ai/index.ts");
  const match = source.match(/const SKILL_IDS = \[([\s\S]*?)\];/);
  assert(match, "supabase/functions/activity-curator-ai/index.ts deve definire const SKILL_IDS = [...]");

  const ids = [...match![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert(ids.length === 12, `SKILL_IDS della edge function deve avere 12 voci, trovate ${ids.length}`);

  const sortedIds = [...ids].sort();
  const sortedExpected = [...EXPECTED_SKILL_IDS].sort();
  assert(
    JSON.stringify(sortedIds) === JSON.stringify(sortedExpected),
    `SKILL_IDS della edge function (${sortedIds.join(", ")}) deve combaciare esattamente con i 12 id di constants/Skills.ts (${sortedExpected.join(", ")})`
  );
  pass("SKILL_IDS in activity-curator-ai combacia esattamente con i 12 id canonici");

  assert(
    source.includes("suggestedSkills: []"),
    "il fallback della edge function deve restituire suggestedSkills: [] invece di inventare competenze senza chiamata AI riuscita"
  );
  assert(
    source.includes(".filter((id) => SKILL_IDS.includes(id))"),
    "la edge function deve validare/filtrare lato server la risposta AI contro SKILL_IDS prima di restituirla al client"
  );
  pass("fallback sicuro (nessuna competenza inventata) e validazione server-side della risposta AI");
}

function testBackfillMigrationExists() {
  console.log("\n[Migration] backfill dati legacy applicato");

  const migrationsDir = join(REPO_ROOT, "supabase/migrations");
  const files: string[] = readdirSync(migrationsDir);
  const backfillFile = files.find((f: string) => f.includes("rationalize_skills_taxonomy"));
  assert(backfillFile, "deve esistere una migration *rationalize_skills_taxonomy*.sql per il backfill dei valori legacy");

  const migrationSource = readSource(`supabase/migrations/${backfillFile}`);
  assert(migrationSource.includes("user_skills"), "la migration di backfill deve toccare user_skills");
  assert(migrationSource.includes("activity_skills"), "la migration di backfill deve toccare activity_skills");
  assert(migrationSource.includes("sought_skills"), "la migration di backfill deve toccare profiles.sought_skills");
  for (const id of EXPECTED_SKILL_IDS) {
    assert(migrationSource.includes(id), `la migration di backfill deve referenziare l'id canonico "${id}"`);
  }
  pass("la migration di backfill esiste e copre user_skills, activity_skills e profiles.sought_skills");
}

function run() {
  console.log("Skills taxonomy contract tests (2026-07-23)");
  console.log("─".repeat(60));

  testSkillsConstantHas12CanonicalIds();
  testNoOverlapBetweenSkillsAndCategories();
  testOnboardingAndSettingsUseSkillIds();
  testDisplaySectionsUseGetSkillLabel();
  testActivityCuratorAiInSyncWithCanonicalSkillIds();
  testBackfillMigrationExists();

  console.log("\n" + "─".repeat(60));
  console.log("Tutti i controlli sulla tassonomia competenze sono passati ✓");
}

run();
