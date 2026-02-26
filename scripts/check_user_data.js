
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pavnfiladmnwbptwlwpr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is missing in .env (needed to read auth.users)");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkUser(email) {
    console.log(`Checking user: ${email}`);

    // 1. Get Auth User (Metadata)
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error("Auth list error:", authError);
        return;
    }

    const user = users.find(u => u.email === email);
    if (!user) {
        console.error("User not found in Auth.");
    } else {
        console.log("\n--- AUTH METADATA ---");
        console.log("ID:", user.id);
        console.log("Metadata:", JSON.stringify(user.user_metadata, null, 2));
    }

    if (user) {
        // 2. Get Public Profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error("\n❌ Profile fetch error:", profileError.message);
        } else {
            console.log("\n--- PUBLIC PROFILE ---");
            console.log(JSON.stringify(profile, null, 2));
        }

        // Comparison
        if (user && profile) {
            const meta = user.user_metadata || {};
            console.log("\n--- COMPARISON ---");
            console.log(`Metadata Completed: ${meta.profileCompleted}`);
            console.log(`Profile Completed:  ${profile.profile_completed}`);

            if (meta.profileCompleted !== profile.profile_completed) {
                console.log("⚠️  MISMATCH DETECTED!");
            } else {
                console.log("✅ statuses match.");
            }
        }
    }
}

checkUser("kekkoincomune@gmail.com");
