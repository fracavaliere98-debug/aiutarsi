import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test credentials (must exist in your dev/staging environment)
const TEST_EMAIL = 'kekkoincomune@gmail.com';
const TEST_PASSWORD = 'password123';
const NEW_TEST_PASSWORD = 'newpassword456';

async function runTests() {
    console.log('🧪 Starting Auth Updates Regression Tests');

    let passed = 0;
    let failed = 0;

    async function test(name: string, fn: () => Promise<void>) {
        try {
            process.stdout.write(`TEST: ${name}... `);
            await fn();
            console.log('✅ PASS');
            passed++;
        } catch (error: any) {
            console.log('❌ FAIL');
            console.error(`   Error: ${error.message || error}`);
            failed++;
        }
    }

    // 1. Setup: Sign in
    await test('Setup: Sign in with current credentials', async () => {
        const { error } = await supabase.auth.signInWithPassword({
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });
        if (error) throw error;
    });

    // 2. Regression: Invalid Email Format
    await test('[Regression] Update with invalid email format', async () => {
        const { error } = await supabase.auth.updateUser({ email: 'invalid-email' });
        if (!error) throw new Error('Should have failed for invalid email format');
    });

    // 3. Regression: Current Password Check (Simulation)
    // Note: Supabase updateUser({password}) doesn't strictly require old password via API, 
    // but our AuthService DOES verify it by signing in again.
    await test('[Regression] Change password with WRONG current password (via AuthService logic)', async () => {
        // Simulating AuthService.updatePassword logic:
        const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: TEST_EMAIL,
            password: 'wrong_password'
        });
        if (!signInErr) throw new Error('Verification of old password should have failed');
    });

    // 4. Update Password (and Rollback)
    await test('Update Password to new one', async () => {
        const { error } = await supabase.auth.updateUser({ password: NEW_TEST_PASSWORD });
        if (error) throw error;
        
        // Verify we can sign in with new password
        await supabase.auth.signOut();
        const { error: newSignInErr } = await supabase.auth.signInWithPassword({
            email: TEST_EMAIL,
            password: NEW_TEST_PASSWORD
        });
        if (newSignInErr) throw new Error('Failed to sign in with NEW password');
    });

    // ROLLBACK Password
    await test('Rollback: Restore original password', async () => {
        const { error } = await supabase.auth.updateUser({ password: TEST_PASSWORD });
        if (error) throw error;
    });

    // 5. Update Email (Simulation - won't complete without confirmation but tests API call)
    await test('Update Email API call', async () => {
        const tempEmail = `test_${Date.now()}@gmail.com`;
        const { error } = await supabase.auth.updateUser({ email: tempEmail });
        if (error) {
            // Log full error for debugging
            console.error('   Supabase detail:', error);
            if (!error.message.includes('already in progress')) throw error;
        }
    });

    console.log(`\n🎉 Auth Tests Complete. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) process.exit(1);
    process.exit(0);
}

runTests();
