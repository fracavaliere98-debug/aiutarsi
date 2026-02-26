/**
 * Full Audit Script — AiutarSi
 * Tests: Supabase connection, all tables, RLS, RPC, Storage buckets, Gemini API
 * Run with: node scripts/test_full_audit.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://pavnfiladmnwbptwlwpr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M';
const GEMINI_API_KEY = 'AIzaSyA-Lnv-b-hU0HHio22xz75RzjMhYEec2T8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let passed = 0;
let failed = 0;
const issues = [];

function ok(name, detail = '') {
    console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`);
    passed++;
}

function fail(name, detail = '') {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
    issues.push({ test: name, detail });
}

function warn(name, detail = '') {
    console.log(`  ⚠️  ${name}${detail ? ' — ' + detail : ''}`);
    issues.push({ test: `[WARN] ${name}`, detail });
}

function section(title) {
    console.log(`\n══════════════════════════════════════`);
    console.log(` ${title}`);
    console.log(`══════════════════════════════════════`);
}

// ─── 1. SUPABASE BASIC CONNECTION ───────────────────────────────────────────
async function testConnection() {
    section('1. SUPABASE CONNECTION');
    const t = Date.now();
    try {
        const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) fail('Connection ping', error.message);
        else ok('Connection ping', `${Date.now() - t}ms`);
    } catch (e) { fail('Connection ping', e.message); }
}

// ─── 2. TABLE ACCESS (anon read) ────────────────────────────────────────────
async function testTables() {
    section('2. TABLES (anon read)');

    const tables = [
        { name: 'profiles', col: 'id' },
        { name: 'activities', col: 'id' },
        { name: 'activity_skills', col: 'activity_id' },
        { name: 'activity_participants', col: 'activity_id' },
        { name: 'reviews', col: 'id' },
        { name: 'notifications', col: 'id' },
        { name: 'applications', col: 'id' },
        { name: 'npo_followers', col: 'npo_id' },
        { name: 'user_skills', col: 'user_id' },
        { name: 'user_interests', col: 'user_id' },
    ];

    for (const t of tables) {
        try {
            const { data, error } = await supabase.from(t.name).select(t.col).limit(1);
            if (error) {
                // RLS can block anon reads — distinguish "RLS blocked" from "table missing"
                if (error.code === 'PGRST116' || error.message.includes('permission') || error.message.includes('policy') || error.code === '42501') {
                    warn(`${t.name}`, `RLS blocks anon reads (expected for protected tables) — code: ${error.code}`);
                } else if (error.code === '42P01') {
                    fail(`${t.name}`, `TABLE DOES NOT EXIST — ${error.message}`);
                } else {
                    fail(`${t.name}`, error.message);
                }
            } else {
                ok(`${t.name}`, `${data?.length ?? 0} row(s) returned`);
            }
        } catch (e) { fail(t.name, e.message); }
    }
}

// ─── 3. DATA INTEGRITY ──────────────────────────────────────────────────────
async function testDataIntegrity() {
    section('3. DATA INTEGRITY');

    // Check activities exist
    try {
        const { data, error, count } = await supabase
            .from('activities')
            .select('id, title, status, location_lat, location_lng, date_start, date_end, slots_total', { count: 'exact' });

        if (error) { fail('Activities fetch', error.message); }
        else {
            ok('Activities readable', `${count} total`);

            // Check for activities with missing coords
            const noCoordsCount = (data || []).filter(a => !a.location_lat || !a.location_lng).length;
            if (noCoordsCount > 0) warn('Activities with missing coords', `${noCoordsCount}/${data.length} activities have lat=0 or lng=0`);
            else ok('Activity coordinates', 'All have non-zero coords');

            // Check for missing date_end
            const noEnd = (data || []).filter(a => !a.date_end).length;
            if (noEnd > 0) warn('Activities missing date_end', `${noEnd} activities`);
            else ok('Activity date_end', 'All present');

            // Check for unrealistically old/future dates
            const now = Date.now();
            const veryOld = (data || []).filter(a => new Date(a.date_start).getTime() < now - 365 * 24 * 3600 * 1000).length;
            if (veryOld > 0) warn('Old activities', `${veryOld} activities date_start > 1 year ago (may be stale)`);

            // Check slots
            const noSlots = (data || []).filter(a => !a.slots_total || a.slots_total < 1).length;
            if (noSlots > 0) warn('Activities with slots_total < 1', `${noSlots} activities`);
            else ok('Activity slots_total', 'All ≥ 1');
        }
    } catch (e) { fail('Activities - exception', e.message); }

    // Check profiles
    try {
        const { data, error, count } = await supabase
            .from('profiles')
            .select('id, role, full_name, email', { count: 'exact' });
        if (error) { fail('Profiles fetch', error.message); }
        else {
            ok('Profiles readable', `${count} total`);
            const noName = (data || []).filter(p => !p.full_name).length;
            if (noName > 0) warn('Profiles with null full_name', `${noName}`);
            else ok('Profile full_name', 'All present');

            const noEmail = (data || []).filter(p => !p.email).length;
            if (noEmail > 0) warn('Profiles with null email', `${noEmail}`);
            else ok('Profile email', 'All present');

            const roles = [...new Set((data || []).map(p => p.role))];
            ok('Profile roles found', roles.join(', '));
        }
    } catch (e) { fail('Profiles - exception', e.message); }

    // Orphan check: activity_participants referencing missing activities
    try {
        const { data: parts, error: pe } = await supabase.from('activity_participants').select('activity_id');
        const { data: acts, error: ae } = await supabase.from('activities').select('id');
        if (!pe && !ae) {
            const actIds = new Set((acts || []).map(a => a.id));
            const orphans = (parts || []).filter(p => !actIds.has(p.activity_id));
            if (orphans.length > 0) fail('Orphan activity_participants', `${orphans.length} rows reference non-existent activities`);
            else ok('activity_participants FK integrity', 'No orphans found');
        }
    } catch (e) { warn('Orphan check - exception', e.message); }

    // Duplicate join check (same user + activity)
    try {
        const { data, error } = await supabase.from('activity_participants').select('activity_id, user_id');
        if (!error && data) {
            const seen = new Set();
            let dupes = 0;
            for (const r of data) {
                const key = `${r.activity_id}_${r.user_id}`;
                if (seen.has(key)) dupes++;
                seen.add(key);
            }
            if (dupes > 0) warn('Duplicate activity_participants', `${dupes} duplicate (activity_id, user_id) pairs`);
            else ok('activity_participants uniqueness', 'No duplicates');
        }
    } catch (e) { warn('Duplicate check - exception', e.message); }
}

// ─── 4. RPC: get_activities_near_me ─────────────────────────────────────────
async function testRPC() {
    section('4. RPC FUNCTIONS');

    // Milan coords as test point
    try {
        const { data, error } = await supabase.rpc('get_activities_near_me', {
            user_lat: 45.4642,
            user_lng: 9.1900,
            radius_meters: 50000  // 50km
        });
        if (error) {
            if (error.message.includes('function') && error.message.includes('exist')) {
                fail('RPC get_activities_near_me', 'FUNCTION NOT FOUND — geospatial search will be broken');
            } else {
                fail('RPC get_activities_near_me', error.message);
            }
        } else {
            ok('RPC get_activities_near_me', `${(data || []).length} activities within 50km of Milan`);

            // Check RPC result schema
            if (data && data.length > 0) {
                const row = data[0];
                const requiredFields = ['id', 'title', 'location_lat', 'location_lng', 'distance_meters'];
                const missing = requiredFields.filter(f => !(f in row));
                if (missing.length > 0) fail('RPC schema', `Missing fields: ${missing.join(', ')}`);
                else ok('RPC result schema', `All expected fields present`);

                // Check for activities with impossibly large distances
                const tooFar = data.filter(r => r.distance_meters > 50000);
                if (tooFar.length > 0) warn('RPC radius filter', `${tooFar.length} results exceed requested radius (possible RPC bug)`);
            }
        }
    } catch (e) { fail('RPC get_activities_near_me - exception', e.message); }
}

// ─── 5. NOTIFICATIONS TABLE ─────────────────────────────────────────────────
async function testNotifications() {
    section('5. NOTIFICATIONS');

    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('id, type, user_id, title, read, created_at')
            .limit(5);

        if (error) {
            if (error.code === '42501' || error.message.includes('permission') || error.message.includes('policy')) {
                warn('notifications table', 'RLS blocks anon access (expected — needs auth)');
            } else {
                fail('notifications table', error.message);
            }
        } else {
            ok('notifications readable', `${data?.length ?? 0} rows (anon)`);
            const types = [...new Set((data || []).map(n => n.type))];
            if (types.length > 0) ok('notification types found', types.join(', '));
        }
    } catch (e) { fail('notifications - exception', e.message); }
}

// ─── 6. STORAGE BUCKETS ─────────────────────────────────────────────────────
async function testStorage() {
    section('6. STORAGE BUCKETS');

    const buckets = ['avatars', 'activities'];
    for (const bucket of buckets) {
        try {
            const { data, error } = await supabase.storage.from(bucket).list('', { limit: 1 });
            if (error) {
                if (error.message.includes('not found') || error.message.includes('does not exist')) {
                    fail(`Bucket "${bucket}"`, 'DOES NOT EXIST');
                } else if (error.message.includes('permission') || error.message.includes('policy') || error.status === 400) {
                    warn(`Bucket "${bucket}"`, `RLS/anon restriction (${error.message})`);
                } else {
                    fail(`Bucket "${bucket}"`, error.message);
                }
            } else {
                ok(`Bucket "${bucket}" accessible`, `${data?.length ?? 0} files (root)`);
            }
        } catch (e) { fail(`Bucket "${bucket}" - exception`, e.message); }
    }

    // Test public URL generation (does not require auth)
    try {
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl('test/nonexistent.jpg');
        if (publicUrl && publicUrl.includes('supabase.co')) ok('Public URL generation', publicUrl.substring(0, 60) + '...');
        else warn('Public URL generation', 'URL looks malformed: ' + publicUrl);
    } catch (e) { fail('Public URL generation - exception', e.message); }
}

// ─── 7. GEMINI API ──────────────────────────────────────────────────────────
async function testGemini() {
    section('7. GEMINI API');

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
        const body = JSON.stringify({
            contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }]
        });

        const t = Date.now();
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });

        const responseTime = Date.now() - t;
        const json = await res.json();

        if (res.status === 429) {
            const msg = json?.error?.message || '';
            if (msg.includes('limit: 0') || msg.includes('PerDay')) {
                warn('Gemini API', 'Daily quota exhausted — SmartMatch will show quota message (handled in UI)');
            } else {
                warn('Gemini API', `Rate limited (per-minute, retries OK) — ${msg.substring(0, 80)}`);
            }
        } else if (!res.ok) {
            const errMsg = json?.error?.message || res.statusText;
            if (res.status === 400 && errMsg.includes('API_KEY')) {
                fail('Gemini API key', 'INVALID API KEY');
            } else {
                fail('Gemini API', `HTTP ${res.status} — ${errMsg.substring(0, 100)}`);
            }
        } else {
            const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            ok('Gemini API reachable', `${responseTime}ms — model: gemini-2.0-flash-lite`);
            ok('Gemini response parsed', `Reply: "${text.trim().substring(0, 40)}"`);
        }
    } catch (e) { fail('Gemini API - exception', e.message); }
}

// ─── 8. REVIEWS TABLE ───────────────────────────────────────────────────────
async function testReviews() {
    section('8. REVIEWS');
    try {
        const { data, error, count } = await supabase
            .from('reviews')
            .select('id, activity_id, stars, volunteer_id', { count: 'exact' });

        if (error) fail('reviews table', error.message);
        else {
            ok('reviews readable', `${count} total`);
            const invalid = (data || []).filter(r => r.stars < 1 || r.stars > 5);
            if (invalid.length > 0) warn('review stars out of range', `${invalid.length} reviews with stars outside [1-5]`);
            else ok('review stars range', 'All in [1-5]');
        }
    } catch (e) { fail('reviews - exception', e.message); }
}

// ─── 9. npo_followers integrity ─────────────────────────────────────────────
async function testNPOFollowers() {
    section('9. NPO_FOLLOWERS');
    try {
        const { data, error, count } = await supabase
            .from('npo_followers')
            .select('npo_id, follower_id', { count: 'exact' });

        if (error) {
            if (error.code === '42501') warn('npo_followers', 'RLS blocks anon — expected');
            else fail('npo_followers', error.message);
        } else {
            ok('npo_followers readable', `${count} rows`);
            // Check for self-follows
            const selfFollow = (data || []).filter(r => r.npo_id === r.follower_id);
            if (selfFollow.length > 0) warn('Self-follow detected', `${selfFollow.length} rows where npo_id === follower_id`);
            else ok('No self-follows', 'Clean');
        }
    } catch (e) { fail('npo_followers - exception', e.message); }
}

// ─── 10. AUTH check (session-less) ──────────────────────────────────────────
async function testAuth() {
    section('10. AUTH CONFIG');
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) fail('Auth getSession', error.message);
        else ok('Auth getSession', 'No active session (expected for anon test)');

        // Attempt a fake login to confirm auth endpoint is reachable (should fail with 400)
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email: 'audit_test@test.invalid', password: 'wrongpass' });
        if (loginErr) {
            if (loginErr.message.includes('Invalid login credentials') || loginErr.status === 400) {
                ok('Auth endpoint reachable', 'Returns 400 for invalid credentials (expected)');
            } else {
                warn('Auth endpoint', `Unexpected error: ${loginErr.message}`);
            }
        }
    } catch (e) { fail('Auth - exception', e.message); }
}

// ─── SUMMARY ────────────────────────────────────────────────────────────────
async function runAll() {
    console.log('\n🔍 AiutarSi — Full API & Supabase Audit');
    console.log('=========================================');
    console.log(`Timestamp: ${new Date().toISOString()}`);

    await testConnection();
    await testTables();
    await testDataIntegrity();
    await testRPC();
    await testNotifications();
    await testStorage();
    await testGemini();
    await testReviews();
    await testNPOFollowers();
    await testAuth();

    console.log('\n\n══════════════════════════════════════');
    console.log(' AUDIT SUMMARY');
    console.log('══════════════════════════════════════');
    console.log(`Total: ${passed + failed + issues.filter(i => i.test.startsWith('[WARN]')).length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${issues.filter(i => i.test.startsWith('[WARN]')).length}`);

    if (issues.length > 0) {
        console.log('\n── Issues ──');
        for (const i of issues) {
            const icon = i.test.startsWith('[WARN]') ? '⚠️ ' : '❌';
            console.log(`${icon} ${i.test}: ${i.detail}`);
        }
    }

    if (failed === 0) {
        console.log('\n✨ No failures detected. All critical checks passed.');
    } else {
        console.log(`\n🚨 ${failed} failures require attention. See details above.`);
    }
}

runAll().catch(e => {
    console.error('Audit script crashed:', e);
    process.exit(1);
});
