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

async function runTests() {
    console.log('🤖 Starting Automated Tests: Non-Regression + Chat Flow');

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

    // --- NON-REGRESSION TESTS ---
    // We can run these unauthenticated if public, or authenticated.
    await test('[Non-Regression] Fetch Activities', async () => {
        const { data, error } = await supabase.from('activities').select('id, title, status').limit(5);
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No activities found in DB.');
    });

    await test('[Non-Regression] Fetch Gamification State', async () => {
        const { data, error } = await supabase.from('gamification_state').select('*').limit(1);
        if (error) throw error; // Even if empty, it shouldn't error out entirely
    });

    // --- CHAT FEATURE TESTS ---
    let conversationId: string | null = null;
    let volunteerId: string | null = null;
    let npoId: string | null = null;

    await test('Setup: Sign in as Volunteer & Get IDs', async () => {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: 'kekkoincomune@gmail.com',
            password: 'password123'
        });
        if (signInErr) throw signInErr;

        const { data: vData } = await supabase.from('profiles').select('id').eq('email', 'kekkoincomune@gmail.com').single();
        const { data: nData } = await supabase.from('profiles').select('id').eq('email', 'npo@test.com').single();

        volunteerId = vData?.id || '970c4f0a-47e7-4014-8e51-0b4accbf5a8e';
        npoId = nData?.id || '564c4db5-63a9-4663-a163-16864293c017';
    });

    if (volunteerId && npoId) {
        await test('[Chat - Volunteer] Create a PRIVATE Conversation', async () => {
            const { data: conv, error: convErr } = await supabase
                .from('conversations')
                .insert({ type: 'PRIVATE' })
                .select()
                .single();
            if (convErr) throw convErr;
            conversationId = conv.id;

            const { error: partErr } = await supabase
                .from('conversation_participants')
                .insert([
                    { conversation_id: conversationId, user_id: volunteerId },
                    { conversation_id: conversationId, user_id: npoId }
                ]);
            if (partErr) throw partErr;
        });

        if (conversationId) {
            await test('Setup: Sign in as NPO to reply', async () => {
                await supabase.auth.signOut();
                const { error: signInErr } = await supabase.auth.signInWithPassword({
                    email: 'npo@test.com',
                    password: 'password123'
                });
                if (signInErr) throw signInErr;
            });

            await test('[Chat - NPO] Send a message to Volunteer', async () => {
                const { error: msgErr } = await supabase
                    .from('messages')
                    .insert({
                        conversation_id: conversationId,
                        sender_id: npoId,
                        content: 'Ciao! Grazie per il tuo interesse nella nostra attività.'
                    });
                if (msgErr) throw msgErr;
            });

            await test('Setup: Sign back in as Volunteer', async () => {
                await supabase.auth.signOut();
                const { error: signInErr } = await supabase.auth.signInWithPassword({
                    email: 'kekkoincomune@gmail.com',
                    password: 'password123'
                });
                if (signInErr) throw signInErr;
            });

            await test('[Chat - Volunteer] Verify Unread Count increases', async () => {
                const { data: unreadData, error: viewErr } = await supabase
                    .from('unread_message_counts')
                    .select('unread_count')
                    .eq('conversation_id', conversationId)
                    .eq('user_id', volunteerId)
                    .single();

                if (viewErr) throw viewErr;
                if (!unreadData || unreadData.unread_count < 1) {
                    throw new Error(`Expected unread_count >= 1, got ${unreadData?.unread_count}`);
                }
            });

            await test('[Chat - Volunteer] Mark as read drops Unread Count', async () => {
                const { error: updErr } = await supabase
                    .from('conversation_participants')
                    .update({ last_read_at: new Date().toISOString() })
                    .eq('conversation_id', conversationId)
                    .eq('user_id', volunteerId);
                if (updErr) throw updErr;

                const { data: unreadData, error: viewErr } = await supabase
                    .from('unread_message_counts')
                    .select('unread_count')
                    .eq('conversation_id', conversationId)
                    .eq('user_id', volunteerId)
                    .maybeSingle();

                if (viewErr) throw viewErr;
                if (unreadData && unreadData.unread_count > 0) {
                    throw new Error(`Expected unread_count=0, got ${unreadData.unread_count}`);
                }
            });

            await test('[Chat - Cleanup] Remove conversation', async () => {
                const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
                if (error) throw error;
            });
        }
    }

    console.log(`\n🎉 Tests Complete. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) process.exit(1);
}

runTests();
