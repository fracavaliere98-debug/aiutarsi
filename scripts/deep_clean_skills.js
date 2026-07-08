require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const validSkills = [
  "Assistenza e Compagnia",
  "Supporto Sanitario e Soccorso",
  "Educazione e Mentoring",
  "Logistica e Distribuzione",
  "Manutenzione e Ambiente",
  "Cucina e Mensa",
  "Digital & Social Media",
  "Creatività e Grafica",
  "Scrittura e Storytelling",
  "Amministrazione e Gestione",
  "Tecnologia e IT",
  "Lingue e Traduzioni",
  "Tutela Animali",
  "Sport per il Sociale"
];

const validInterests = [
  "Sociale",
  "Ambiente",
  "Educazione",
  "Animali",
  "Arte & Cultura",
  "Salute"
];

async function run() {
  console.log("Starting deep clean...");

  // Clean user_skills
  console.log("Cleaning user_skills...");
  const { data: skills, error: skillsError } = await supabase.from('user_skills').select('user_id, skill');
  if (skillsError) {
    console.error("Error fetching skills:", skillsError);
  } else {
    const toDelete = skills.filter(s => !validSkills.includes(s.skill));
    console.log(`Found ${toDelete.length} invalid skills.`);
    
    for (const item of toDelete) {
        process.stdout.write(`.`);
        await supabase.from('user_skills').delete().match({ user_id: item.user_id, skill: item.skill });
    }
    console.log("\nSkills clean done.");
  }

  // Clean user_interests
  console.log("Cleaning user_interests...");
  const { data: interests, error: interestsError } = await supabase.from('user_interests').select('user_id, interest');
  if (interestsError) {
    console.error("Error fetching interests:", interestsError);
  } else {
    const toDelete = interests.filter(i => !validInterests.includes(i.interest));
    console.log(`Found ${toDelete.length} invalid interests.`);
    
    for (const item of toDelete) {
        process.stdout.write(`.`);
        await supabase.from('user_interests').delete().match({ user_id: item.user_id, interest: item.interest });
    }
    console.log("\nInterests clean done.");
  }

  // Final verification for lalal@b.ut
  console.log("Final verification for lalal@b.ut...");
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, user_skills(skill)')
    .ilike('email', '%lalal@b.ut%')
    .single();
    
  if (profile) {
    console.log(`User ${profile.email} now has skills:`, profile.user_skills.map(s => s.skill));
  }

  console.log("All done.");
}

run();
