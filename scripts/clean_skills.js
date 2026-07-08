require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

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
  console.log("Fetching all user skills...");
  const { data: skills, error: skillsError } = await supabase.from('user_skills').select('*');
  if (skillsError) {
    console.error("Error fetching skills:", skillsError);
  } else {
    let toDeleteSkills = [];
    for (const row of skills) {
        if (!validSkills.includes(row.skill)) {
            toDeleteSkills.push(row);
        }
    }
    
    if (toDeleteSkills.length > 0) {
        console.log(`Found ${toDeleteSkills.length} outdated skills to remove.`);
        
        for (const row of toDeleteSkills) {
            console.log(`Removing skill: ${row.skill} for user ${row.user_id}`);
            await supabase.from('user_skills').delete().eq('user_id', row.user_id).eq('skill', row.skill);
        }
    } else {
        console.log("No outdated skills found.");
    }
  }

  console.log("Fetching all user interests...");
  const { data: interests, error: interestsError } = await supabase.from('user_interests').select('*');
  if (interestsError) {
    console.error("Error fetching interests:", interestsError);
  } else {
    let toDeleteInterests = [];
    for (const row of interests) {
        if (!validInterests.includes(row.interest)) {
            toDeleteInterests.push(row);
        }
    }
    
    if (toDeleteInterests.length > 0) {
        console.log(`Found ${toDeleteInterests.length} outdated interests to remove.`);
        
        for (const row of toDeleteInterests) {
            console.log(`Removing interest: ${row.interest} for user ${row.user_id}`);
            await supabase.from('user_interests').delete().eq('user_id', row.user_id).eq('interest', row.interest);
        }
    } else {
        console.log("No outdated interests found.");
    }
  }

  console.log("Done.");
}

run();
