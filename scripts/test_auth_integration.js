
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

// Config
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pavnfiladmnwbptwlwpr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTest() {
    console.log("=== STARTING AUTH INTEGRATION TEST (JS) ===");

    const TEST_EMAIL = "test_auto_" + Date.now() + "@example.com";
    const TEST_PASSWORD = "password123";

    try {
        // 1. SIGN UP
        console.log(`\n[1] Creating User: ${TEST_EMAIL}...`);
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
        });

        if (signUpError) throw new Error("SignUp Failed: " + signUpError.message);
        if (!signUpData.user) throw new Error("SignUp: No user returned");
        const userId = signUpData.user.id;
        console.log("✅ User Created:", userId);

        // 2. SIMULATE ONBOARDING UPDATE (The "Deferred" Logic)
        console.log("\n[2] Simulating Deferred Onboarding Update...");

        const updates = {
            interests: ["Automated", "Testing"],
            skills: ["Debugging"],
            isVerified: true,
            bio: "I am a robot.",
            profileCompleted: true
        };

        // A. Auth Metadata Update
        console.log("-> Updating Auth Metadata...");
        const { error: updateError } = await supabase.auth.updateUser({
            data: updates
        });

        if (updateError) console.warn("⚠️ Auth Update Warning (Simulated Timeout/Fail):", updateError.message);
        else console.log("✅ Auth Metadata Updated");

        // B. Public Profile Upsert (The Critical Fix)
        console.log("-> Upserting Public Profile (Self-Healing)...");
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                updated_at: new Date().toISOString(),
                full_name: "Test Bot",
                avatar_url: null,
                bio: updates.bio,
                role: "VOLUNTEER", // Default
                email: TEST_EMAIL
            })
            .select();

        if (profileError) throw new Error("Profile Upsert Failed: " + profileError.message);
        console.log("✅ Public Profile Upserted");

        // 3. LOGOUT
        console.log("\n[3] Logging Out...");
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw new Error("SignOut Failed: " + signOutError.message);
        console.log("✅ Logged Out");

        // 4. RE-LOGIN (The "Zombie" Check)
        console.log("\n[4] Re-Logging In...");
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });

        if (loginError) throw new Error("Login Failed: " + loginError.message);
        if (!loginData.session) throw new Error("Login: No session returned");
        console.log("✅ Re-Login Successful");

        // 5. VERIFY DATA PERSISTENCE
        console.log("\n[5] Verifying Data...");
        const { data: userCheck } = await supabase.auth.getUser();
        const metadata = userCheck.user?.user_metadata;

        if (metadata?.profileCompleted !== true) {
            throw new Error("❌ Validation Failed: profileCompleted is not true in metadata");
        }
        if (metadata?.interests?.[0] !== "Automated") {
            throw new Error("❌ Validation Failed: interests not saved in metadata");
        }

        console.log("✅ Data Persisted Correctly in Metadata");
        console.log("\nSUCCESS: All Auth Flows Verified! 🚀");

    } catch (e) {
        console.error("\n❌ TEST FAILED:", e.message);
        process.exit(1);
    }
}

runTest();
