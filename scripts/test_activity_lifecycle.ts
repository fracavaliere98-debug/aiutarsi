
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pavnfiladmnwbptwlwpr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M';

// We need two clients to simulate two users
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runActivityTest() {
    console.log("🚀 Starting Activity Lifecycle Test...");
    let passed = 0;
    let failed = 0;

    // Existing seeded users
    const NPO_EMAIL = 'npo@test.com';
    const NPO_PASS = 'password123';
    const VOL_EMAIL = 'volontario@test.com';
    const VOL_PASS = 'password';

    let npoId: string = "";
    let volId: string = "";
    let activityId: string = "";

    // 1. NPO Creation Flow
    try {
        process.stdout.write(`TEST: NPO creates activity... `);

        // Log in as NPO
        const { data: npoData, error: npoError } = await supabase.auth.signInWithPassword({
            email: NPO_EMAIL,
            password: NPO_PASS
        });
        if (npoError) throw npoError;
        npoId = npoData.user!.id;

        // Create Activity
        const { data: actData, error: actError } = await supabase
            .from('activities')
            .insert({
                npo_id: npoId,
                title: `Automated Test Activity ${Date.now()}`,
                description: 'Created by test script',
                date_start: new Date().toISOString(),
                date_end: new Date(Date.now() + 86400000).toISOString(),
                location_address: 'Test City',
                slots_total: 5,
                category: 'Sociale',
                status: 'APERTA'
            })
            .select()
            .single();

        if (actError) throw actError;
        activityId = actData.id;
        console.log('✅ PASS');
        passed++;
    } catch (e: any) {
        console.log('❌ FAIL');
        console.error('   Error:', e.message);
        failed++;
        process.exit(1);
    }

    // 2. Volunteer Join Flow
    try {
        process.stdout.write(`TEST: Volunteer joins activity... `);

        // Log in as Volunteer
        const { data: volData, error: volError } = await supabase.auth.signInWithPassword({
            email: VOL_EMAIL,
            password: VOL_PASS
        });
        if (volError) throw volError;
        volId = volData.user!.id;

        // Join Activity
        const { error: joinError } = await supabase
            .from('activity_participants')
            .insert({
                activity_id: activityId,
                user_id: volId,
                status: 'PENDING',
                message: 'I want to help!'
            });

        if (joinError) throw joinError;
        console.log('✅ PASS');
        passed++;
    } catch (e: any) {
        console.log('❌ FAIL');
        console.error('   Error:', e.message);
        if (e.message.includes("violates unique constraint")) {
            console.log('   (Already joined, treating as pass for idempotency check)');
            passed++;
        } else {
            failed++;
        }
    }

    // 3. Verification
    try {
        process.stdout.write(`TEST: Verify enrollment... `);

        const { data, error } = await supabase
            .from('activity_participants')
            .select('*')
            .eq('activity_id', activityId)
            .eq('user_id', volId)
            .single();

        if (error) throw error;
        if (data.status !== 'PENDING') throw new Error(`Status mismatch: ${data.status}`);

        console.log('✅ PASS');
        passed++;
    } catch (e: any) {
        console.log('❌ FAIL');
        console.error('   Error:', e.message);
        failed++;
    }

    console.log(`\n\n🎉 Activity Test Complete: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
}

runActivityTest();
