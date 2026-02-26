const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pavnfiladmnwbptwlwpr.supabase.co';
// SERVICE ROLE KEY REQUIRED to inspect auth.users (I will try to use the anon key and login first to see what I get as the user, but unrelatedly I'll check public profiles)
// Since I don't have the service role key exposed, I'll log in as the user to see their own metadata.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUser() {
    const email = 'kekkoincomune@gmail.com';
    const password = 'password'; // Assuming connection to mock password or I can ask user. 
    // Wait, I can't know the password.
    // I will check `public.profiles` first which should be readable?

    console.log(`Checking public.profiles for ${email}...`);

    // 1. Check Public Profile
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email); // Assuming email is in profiles, or I need to specific ID?
    // If email is not in profiles, I might need to filter by something else if I can't search by email due to RLS.
    // But usually profiles are public.

    if (profileError) {
        console.error("Profile fetch error:", profileError);
    } else {
        console.log("Public Profile Data:", profiles);
    }

    // 2. Try Login (If I knew password, but I don't. The user said they logged in)
    // I can try to simulate what happens after login by manually checking the logic.

    // If I can't login, I can atleast check if the profile exists and has profile_completed = true.
}

debugUser();
