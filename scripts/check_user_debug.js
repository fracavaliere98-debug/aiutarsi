require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser(email) {
    console.log(`Checking user: ${email}`);
    const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
            id,
            email,
            user_skills (skill),
            user_interests (interest)
        `)
        .ilike('email', `%${email}%`)
        .maybeSingle();

    if (error) {
        console.error("Error fetching profile:", error);
        return;
    }

    if (!profile) {
        console.log("No profile found.");
        return;
    }

    console.log("Profile ID:", profile.id);
    console.log("Email:", profile.email);
    console.log("Skills in DB:", profile.user_skills.map(s => s.skill));
    console.log("Interests in DB:", profile.user_interests.map(i => i.interest));
}

checkUser('lalal@b.ut');
