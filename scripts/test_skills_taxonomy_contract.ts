/**
 * Regression/contract test per la tassonomia competenze/categorie.
 *
 * Fix originale (2026-07-23): prima esistevano 3 formati diversi per lo stesso concetto di
 * "competenza" (label lunghe storiche in DB, id/parole brevi eterogenee in activity_skills, un
 * elenco diverso ancora nel codice app) — le competenze salvate da un volontario non risultavano
 * mai selezionate quando riapriva la schermata, e "competenza richiesta da un'attività" non
 * combaciava mai con "competenza offerta da un volontario" (confronto per label invece che id).
 * Il fix ha introdotto un'unica tassonomia id-based (12 competenze) usata ovunque nell'app.
 *
 * Fix successivo (2026-09-23): l'unica copia rimasta a mano era in
 * supabase/functions/activity-curator-ai/index.ts (SKILL_IDS/CATEGORY_LABELS), perché quella
 * edge function Deno non può importare constants/Skills.ts (che importa icone da
 * lucide-react-native, a sua volta react-native). Gli id/label puri sono stati estratti in
 * shared/skillsTaxonomy.ts e shared/categoriesTaxonomy.ts (nessun import di icone/react-native),
 * fonte unica letta sia da constants/Skills.ts e constants/Interests.ts (che ci attaccano sopra
 * la parte visuale, solo-app) sia dalla edge function — stesso pattern già in uso in questo repo
 * per shared/helpCenterContent.ts. Le 12 competenze restano distinte dalle 6 categorie/settori in
 * cui una NPO dichiara di operare (shared/categoriesTaxonomy.ts) — nessuna sovrapposizione di
 * id/label tra le due liste. Un backfill SQL
 * (supabase/migrations/*_rationalize_skills_taxonomy.sql) ha rimappato i valori legacy già
 * salvati sui 12 id canonici.
 *
 * Sono controlli statici sul codice sorgente (no Metro, no rendering React Native, no Deno, no
 * DB), stesso approccio di scripts/test_settings_structure_contract.ts.
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

function testSharedSkillsTaxonomyHas12CanonicalIds() {
  console.log("\n[shared/skillsTaxonomy.ts] 12 competenze canoniche, id-based, fonte unica");

  const source = readSource("shared/skillsTaxonomy.ts");
  const block = extractIdBlock(source, "export const SKILL_TAXONOMY: SkillTaxonomyItem[] = [");

  const idMatches = [...block.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert(idMatches.length === 12, `SKILL_TAXONOMY deve avere esattamente 12 voci, trovate ${idMatches.length}`);
  pass("SKILL_TAXONOMY ha esattamente 12 voci");

  const uniqueIds = new Set(idMatches);
  assert(uniqueIds.size === idMatches.length, "SKILL_TAXONOMY contiene id duplicati");
  pass("nessun id duplicato in SKILL_TAXONOMY");

  for (const id of EXPECTED_SKILL_IDS) {
    assert(idMatches.includes(id), `SKILL_TAXONOMY deve contenere l'id "${id}"`);
  }
  pass("tutti i 12 id attesi sono presenti");

  for (const id of REMOVED_SKILL_IDS) {
    assert(!idMatches.includes(id), `REGRESSIONE: SKILL_TAXONOMY non deve più contenere "${id}" (rimosso su richiesta esplicita)`);
  }
  pass("Amministrazione, Logistica e Scrittura non sono più presenti come competenze");

  assert(idMatches.includes("ascolto-compagnia"), "SKILL_TAXONOMY deve contenere la nuova soft skill 'ascolto-compagnia' al posto di Scrittura");
  assert(block.includes('label: "Ascolto e compagnia"'), "la label di 'ascolto-compagnia' deve essere 'Ascolto e compagnia'");
  pass("la soft skill relazionale 'Ascolto e compagnia' sostituisce Scrittura");
}

function testSkillsConstantDerivesFromSharedTaxonomy() {
  console.log("\n[constants/Skills.ts] deriva da shared/skillsTaxonomy.ts, nessuna copia id/label a mano");

  const source = readSource("constants/Skills.ts");

  assert(
    /import\s*\{\s*SKILL_TAXONOMY\s*\}\s*from\s*['"]\.\.\/shared\/skillsTaxonomy['"]/.test(source),
    "constants/Skills.ts deve importare SKILL_TAXONOMY da ../shared/skillsTaxonomy"
  );
  assert(
    /SKILL_TAXONOMY\.map\(/.test(source),
    "constants/Skills.ts deve derivare SKILLS da SKILL_TAXONOMY.map(...), non da una lista scritta a mano"
  );
  assert(
    !/export const SKILLS: SkillItem\[\] = \[\s*\n\s*\{\s*id:/.test(source),
    "REGRESSIONE: constants/Skills.ts torna a definire SKILLS come lista letterale — deve derivarla da SKILL_TAXONOMY"
  );
  pass("SKILLS è derivato da SKILL_TAXONOMY, nessuna copia letterale di id/label");

  assert(source.includes("export const getSkillLabel"), "constants/Skills.ts deve esportare getSkillLabel()");
  pass("getSkillLabel() è esportato");
}

function testNoOverlapBetweenSkillsAndCategories() {
  console.log("\n[shared/skillsTaxonomy.ts vs shared/categoriesTaxonomy.ts] nessun doppione competenza/categoria");

  const skillsSource = readSource("shared/skillsTaxonomy.ts");
  const skillsBlock = extractIdBlock(skillsSource, "export const SKILL_TAXONOMY: SkillTaxonomyItem[] = [");
  const skillIds = [...skillsBlock.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
  const skillLabels = [...skillsBlock.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);

  for (const catId of CATEGORY_IDS) {
    assert(!skillIds.includes(catId), `REGRESSIONE: l'id competenza "${catId}" duplica un id categoria di CATEGORY_TAXONOMY`);
  }
  for (const catLabel of CATEGORY_LABELS) {
    assert(
      !skillLabels.some((l) => l.toLowerCase() === catLabel.toLowerCase()),
      `REGRESSIONE: la label competenza "${catLabel}" duplica letteralmente una categoria di CATEGORY_TAXONOMY`
    );
  }
  pass("nessun id/label di SKILL_TAXONOMY combacia con un id/label di CATEGORY_TAXONOMY");
}

function testSharedTaxonomyFilesAreDenoSafe() {
  console.log("\n[shared/*Taxonomy.ts] nessun import react-native — devono restare importabili da Deno");

  for (const path of ["shared/skillsTaxonomy.ts", "shared/categoriesTaxonomy.ts"]) {
    const source = readSource(path);
    assert(
      !/from ['"]react-native['"]/.test(source) && !/from ['"]lucide-react-native['"]/.test(source),
      `REGRESSIONE: ${path} importa react-native/lucide-react-native — activity-curator-ai (Deno) non potrebbe più importarlo`
    );
  }
  pass("shared/skillsTaxonomy.ts e shared/categoriesTaxonomy.ts contengono solo dati puri, nessun import RN");
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

function testActivityCuratorAiUsesSharedTaxonomy() {
  console.log("\n[activity-curator-ai] usa shared/skillsTaxonomy.ts e shared/categoriesTaxonomy.ts, nessuna copia a mano");

  const source = readSource("supabase/functions/activity-curator-ai/index.ts");

  assert(
    /import\s*\{\s*SKILL_TAXONOMY\s*\}\s*from\s*["']\.\.\/\.\.\/\.\.\/shared\/skillsTaxonomy\.ts["']/.test(source),
    "activity-curator-ai deve importare SKILL_TAXONOMY da ../../../shared/skillsTaxonomy.ts"
  );
  assert(
    /import\s*\{\s*CATEGORY_TAXONOMY\s*\}\s*from\s*["']\.\.\/\.\.\/\.\.\/shared\/categoriesTaxonomy\.ts["']/.test(source),
    "activity-curator-ai deve importare CATEGORY_TAXONOMY da ../../../shared/categoriesTaxonomy.ts"
  );
  assert(
    /const SKILL_IDS = SKILL_TAXONOMY\.map\(/.test(source),
    "SKILL_IDS deve essere derivato da SKILL_TAXONOMY.map(...), non da una lista scritta a mano"
  );
  assert(
    /const CATEGORY_LABELS = CATEGORY_TAXONOMY\.map\(/.test(source),
    "CATEGORY_LABELS deve essere derivato da CATEGORY_TAXONOMY.map(...), non da una lista scritta a mano"
  );
  assert(
    !/const SKILL_IDS = \[/.test(source),
    "REGRESSIONE: activity-curator-ai torna a definire SKILL_IDS come lista letterale scritta a mano"
  );
  assert(
    !/const CATEGORY_LABELS = \[/.test(source),
    "REGRESSIONE: activity-curator-ai torna a definire CATEGORY_LABELS come lista letterale scritta a mano"
  );
  pass("SKILL_IDS/CATEGORY_LABELS derivati da shared/*Taxonomy.ts, nessuna copia letterale");

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
  console.log("Skills taxonomy contract tests");
  console.log("─".repeat(60));

  testSharedSkillsTaxonomyHas12CanonicalIds();
  testSkillsConstantDerivesFromSharedTaxonomy();
  testNoOverlapBetweenSkillsAndCategories();
  testSharedTaxonomyFilesAreDenoSafe();
  testOnboardingAndSettingsUseSkillIds();
  testDisplaySectionsUseGetSkillLabel();
  testActivityCuratorAiUsesSharedTaxonomy();
  testBackfillMigrationExists();

  console.log("\n" + "─".repeat(60));
  console.log("Tutti i controlli sulla tassonomia competenze sono passati ✓");
}

run();
