
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pavnfiladmnwbptwlwpr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runIntegrityTest() {
    console.log("🚀 Starting Data Integrity Test...");
    let passed = 0;
    let failed = 0;

    // 1. Check Profiles Count
    try {
        process.stdout.write(`TEST: Check Profiles exist... `);
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;
        if (count === null || count === 0) throw new Error("No profiles found (expected at least seeded users)");

        console.log(`✅ PASS (${count} profiles)`);
        passed++;
    } catch (e: any) {
        console.log('❌ FAIL');
        console.error('   Error:', e.message);
        failed++;
    }

    // 2. Check Activities Linked to Valid NPOs
    try {
        process.stdout.write(`TEST: Check Activity NPO links... `);
        const { data: activities, error } = await supabase
            .from('activities')
            .select('id, npo_id');

        if (error) throw error;

        // For each activity, check if npo_id exists in profiles
        // (This is implicitly enforced by FK, but good to check access)
        if (activities && activities.length > 0) {
            const npoIds = [...new Set(activities.map(a => a.npo_id))];
            const { count: npoCount, error: npoError } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .in('id', npoIds);

            if (npoError) throw npoError;
            if (npoCount !== npoIds.length) throw new Error(`Found orphans: ${npoIds.length} NPO IDs used, but only ${npoCount} found in profiles`);
        }

        console.log('✅ PASS');
        passed++;
    } catch (e: any) {
        console.log('❌ FAIL');
        console.error('   Error:', e.message);
        failed++;
    }

    console.log(`\n\n🎉 Integrity Test Complete: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
}

runIntegrityTest();
