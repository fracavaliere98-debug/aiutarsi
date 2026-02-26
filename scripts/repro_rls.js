const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pavnfiladmnwbptwlwpr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCreateActivity() {
    console.log("1. Signing in as NPO (npo@test.com)...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'npo@test.com',
        password: 'password123'
    });

    if (authError) {
        console.error("Login failed:", authError.message);
        return;
    }

    const userId = authData.user?.id;
    console.log("Logged in user ID:", userId);

    console.log("2. Attempting to create activity...");
    const { data, error } = await supabase
        .from('activities')
        .insert({
            npo_id: userId,
            title: "Test Activity RLS JS",
            description: "Debugging RLS policies JS",
            date_start: new Date().toISOString(),
            date_end: new Date(Date.now() + 86400000).toISOString(),
            location_address: "Test St",
            location_lat: 0,
            location_lng: 0,
            slots_total: 10,
            category: "Sociale",
            status: "APERTA",
            match_percentage: 100
        })
        .select()
        .single();

    if (error) {
        console.error("INSERT Error:", error);
    } else {
        console.log("INSERT Success:", data);
    }
}

testCreateActivity();
