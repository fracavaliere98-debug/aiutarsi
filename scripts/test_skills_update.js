const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pavnfiladmnwbptwlwpr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdateSkills() {
    console.log("1. Signing in as NPO...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'npo@test.com',
        password: 'password123'
    });

    if (authError) {
        console.error("Login failed:", authError.message);
        return;
    }
    const userId = authData.user.id;
    console.log("Logged in:", userId);

    // 1. Create a temp activity
    console.log("2. Creating temp activity...");
    const { data: act, error: createError } = await supabase
        .from('activities')
        .insert({
            npo_id: userId,
            title: "Skill Test Activity",
            description: "Testing skill updates",
            date_start: new Date().toISOString(),
            date_end: new Date(Date.now() + 3600000).toISOString(),
            location_address: "Test Lab",
            location_lat: 0,
            location_lng: 0,
            slots_total: 5,
            category: "Test",
            status: "APERTA"
        })
        .select()
        .single();

    if (createError) {
        console.error("Create failed:", createError);
        return;
    }
    const activityId = act.id;
    console.log("Activity Created:", activityId);

    // 2. Insert Initial Skills (A, B)
    console.log("3. Inserting initial skills [A, B]...");
    await supabase.from('activity_skills').insert([
        { activity_id: activityId, skill: 'A' },
        { activity_id: activityId, skill: 'B' }
    ]);

    // 3. Perform "Update" Logic (Simulating Service)
    console.log("4. Simulating Update to [B, C]...");
    // Fetch Current
    const { data: currentData } = await supabase.from('activity_skills').select('skill').eq('activity_id', activityId);
    const currentSkills = currentData.map(r => r.skill);
    const newSkills = ['B', 'C'];

    const skillsToAdd = newSkills.filter(s => !currentSkills.includes(s));
    const skillsToRemove = currentSkills.filter(s => !newSkills.includes(s));

    console.log(`Diff -> Add: ${skillsToAdd}, Remove: ${skillsToRemove}`);

    if (skillsToRemove.length > 0) {
        await supabase.from('activity_skills').delete().eq('activity_id', activityId).in('skill', skillsToRemove);
    }

    if (skillsToAdd.length > 0) {
        await supabase.from('activity_skills').insert(skillsToAdd.map(s => ({ activity_id: activityId, skill: s })));
    }

    // 4. Verify Result
    console.log("5. Verifying final skills...");
    const { data: finalData } = await supabase.from('activity_skills').select('skill').eq('activity_id', activityId);
    const finalSkills = finalData.map(r => r.skill).sort(); // Sort for comparison
    console.log("Final Skills in DB:", finalSkills);

    if (JSON.stringify(finalSkills) === JSON.stringify(['B', 'C'])) {
        console.log("✅ SUCCESS: Skills updated correctly.");
    } else {
        console.error("❌ FAILURE: Skills do not match expected [B, C].");
    }

    // Cleanup
    console.log("6. Cleaning up...");
    await supabase.from('activities').delete().eq('id', activityId);
}

testUpdateSkills();
