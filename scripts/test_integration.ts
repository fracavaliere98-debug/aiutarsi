import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

async function runIntegrationTest() {
    console.log('🌐 Starting Production Integration Verification...');
    console.log(`📍 URL: ${supabaseUrl}`);

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('❌ Error: Supabase URL or Anon Key missing in .env');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let passed = 0;
    let failed = 0;

    async function test(name: string, fn: () => Promise<void>) {
        try {
            process.stdout.write(`INTEGRATION: ${name}... `);
            await fn();
            console.log('✅ PASS');
            passed++;
        } catch (error: any) {
            console.log('❌ FAIL');
            console.error(`   Error: ${error.message || error}`);
            failed++;
        }
    }

    // 1. Connectivity Test
    await test('Supabase Connection & Public Table Read', async () => {
        const { data, error } = await supabase
            .from('activities')
            .select('id')
            .limit(1);

        if (error) throw error;
        if (!data) throw new Error('No data returned from activities table');
        console.log(` (Found ${data.length} activities)`);
    });

    // 2. Auth API reachability
    await test('Supabase Auth API Reachability', async () => {
        const { error } = await supabase.auth.signInWithPassword({
            email: 'connectivity-test@example.com',
            password: 'wrong-password-on-purpose'
        });

        // We expect "Invalid login credentials", which confirms API is reachable and working
        if (error && error.message !== 'Invalid login credentials') {
            throw error;
        }
    });

    // 3. Health Check
    await test('Supabase System Health (REST)', async () => {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: { 'apikey': supabaseAnonKey }
        });
        if (!response.ok) throw new Error(`Health check failed with status ${response.status}`);
    });

    console.log(`\n🎉 Integration Complete: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
}

runIntegrationTest().catch(err => {
    console.error('💥 Critical Integration Error:', err);
    process.exit(1);
});
