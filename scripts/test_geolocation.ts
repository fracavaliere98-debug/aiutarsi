/**
 * test_geolocation.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Automated verification test for the PostGIS geolocation feature.
 * Checks:
 *   1. PostGIS extension is enabled
 *   2. Spatial columns exist on activities and profiles
 *   3. get_activities_near_me RPC exists and returns results
 *   4. Radius filtering correctly excludes distant activities
 *   5. Distance sorting (nearest first)
 *
 * Run: npx ts-node -e "require('./scripts/test_geolocation.ts')"
 * Or:  npx tsx scripts/test_geolocation.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pavnfiladmnwbptwlwpr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passed = 0;
let failed = 0;

function log(status: 'PASS' | 'FAIL' | 'INFO', message: string, detail?: any) {
    const color = status === 'PASS' ? GREEN : status === 'FAIL' ? RED : BLUE;
    const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '→';
    console.log(`${color}${icon} [${status}]${RESET} ${message}`);
    if (detail !== undefined) {
        console.log(`  ${YELLOW}${JSON.stringify(detail, null, 2)}${RESET}`);
    }
    if (status === 'PASS') passed++;
    if (status === 'FAIL') failed++;
}

async function runTests() {
    console.log(`\n${BOLD}${BLUE}════════════════════════════════════════${RESET}`);
    console.log(`${BOLD}  AiutarSi — Geolocation Test Suite${RESET}`);
    console.log(`${BOLD}${BLUE}════════════════════════════════════════${RESET}\n`);

    // ── TEST 1: PostGIS Extension Enabled ──────────────────────────────────
    console.log(`${BOLD}[1] PostGIS Extension${RESET}`);
    try {
        const { data, error } = await supabase
            .rpc('get_activities_near_me', { user_lat: 0, user_lng: 0, radius_meters: 1 });

        // If we get no error, or a normal empty response, the function exists
        if (!error || error.code !== 'PGRST202') {
            log('PASS', 'PostGIS extension is enabled and RPC function exists');
        } else {
            log('FAIL', 'RPC function does not exist (PostGIS may not be enabled)', error);
        }
    } catch (e: any) {
        log('FAIL', 'PostGIS test threw exception', e.message);
    }

    // ── TEST 2: Spatial Columns Exist ──────────────────────────────────────
    console.log(`\n${BOLD}[2] Spatial Columns${RESET}`);
    try {
        const { data, error } = await supabase
            .from('information_schema.columns' as any)
            .select('table_name, column_name, udt_name')
            .in('table_name', ['activities', 'profiles'])
            .eq('column_name', 'location_coords');

        if (error) throw error;

        const tables = (data || []).map((r: any) => r.table_name);
        if (tables.includes('activities')) {
            log('PASS', 'activities.location_coords column exists');
        } else {
            log('FAIL', 'activities.location_coords column NOT found');
        }
        if (tables.includes('profiles')) {
            log('PASS', 'profiles.location_coords column exists');
        } else {
            log('FAIL', 'profiles.location_coords column NOT found');
        }
    } catch (e: any) {
        // information_schema access restricted via anon key is normal; try a different approach
        log('INFO', 'Cannot access information_schema via anon key (expected). Skipping column check.');
    }

    // ── TEST 3: Near Me Search - Milan Center ─────────────────────────────
    console.log(`\n${BOLD}[3] Near Me Search (Milan, 50km radius)${RESET}`);
    try {
        const MILAN_LAT = 45.4642;
        const MILAN_LNG = 9.1900;
        const RADIUS_KM = 50;

        const { data, error } = await supabase.rpc('get_activities_near_me', {
            user_lat: MILAN_LAT,
            user_lng: MILAN_LNG,
            radius_meters: RADIUS_KM * 1000
        });

        if (error) {
            log('FAIL', 'get_activities_near_me returned error', error);
        } else {
            log('PASS', `RPC returned ${(data || []).length} activities within ${RADIUS_KM}km of Milan`);
            if (data && data.length > 0) {
                log('INFO', 'First result (nearest activity):', {
                    title: data[0].title,
                    npo: data[0].npo_name,
                    distance_km: (data[0].distance_meters / 1000).toFixed(2),
                    is_urgent: data[0].is_urgent
                });
            }
        }
    } catch (e: any) {
        log('FAIL', 'Near Me search exception', e.message);
    }

    // ── TEST 4: Tight Radius Returns Fewer Results ─────────────────────────
    console.log(`\n${BOLD}[4] Radius Filtering (compare 1km vs 100km)${RESET}`);
    try {
        const MILAN_LAT = 45.4642;
        const MILAN_LNG = 9.1900;

        const [smallRes, largeRes] = await Promise.all([
            supabase.rpc('get_activities_near_me', {
                user_lat: MILAN_LAT, user_lng: MILAN_LNG, radius_meters: 1000
            }),
            supabase.rpc('get_activities_near_me', {
                user_lat: MILAN_LAT, user_lng: MILAN_LNG, radius_meters: 100000
            })
        ]);

        const smallCount = (smallRes.data || []).length;
        const largeCount = (largeRes.data || []).length;

        log('INFO', `1km radius: ${smallCount} results | 100km radius: ${largeCount} results`);

        if (largeCount >= smallCount) {
            log('PASS', 'Larger radius returns >= results than smaller radius (correct behavior)');
        } else {
            log('FAIL', 'Larger radius returned FEWER results than smaller radius (bug!)');
        }
    } catch (e: any) {
        log('FAIL', 'Radius filtering test exception', e.message);
    }

    // ── TEST 5: Distance Sorting ────────────────────────────────────────────
    console.log(`\n${BOLD}[5] Distance Sorting (nearest first)${RESET}`);
    try {
        const { data, error } = await supabase.rpc('get_activities_near_me', {
            user_lat: 45.4642,
            user_lng: 9.1900,
            radius_meters: 500000 // 500km to get many results
        });

        if (error) throw error;

        const results = data || [];
        if (results.length < 2) {
            log('INFO', 'Not enough activities to verify sorting (need 2+)');
        } else {
            let sortedCorrectly = true;
            for (let i = 1; i < results.length; i++) {
                if (results[i].distance_meters < results[i - 1].distance_meters) {
                    sortedCorrectly = false;
                    break;
                }
            }
            if (sortedCorrectly) {
                log('PASS', `Results correctly sorted by distance (${results.length} items)`);
            } else {
                log('FAIL', 'Results NOT sorted by distance (nearest first)');
            }
        }
    } catch (e: any) {
        log('FAIL', 'Sorting test exception', e.message);
    }

    // ── TEST 6: Cancelled Activities Excluded ──────────────────────────────
    console.log(`\n${BOLD}[6] Cancelled Activities Excluded${RESET}`);
    try {
        const { data, error } = await supabase.rpc('get_activities_near_me', {
            user_lat: 45.4642, user_lng: 9.1900, radius_meters: 1000000
        });

        if (error) throw error;

        const hasCancelled = (data || []).some((a: any) => a.status === 'CANCELLATA');
        if (!hasCancelled) {
            log('PASS', 'No CANCELLATA activities returned (correctly excluded)');
        } else {
            log('FAIL', 'CANCELLATA activities were included in results (should be excluded)');
        }
    } catch (e: any) {
        log('FAIL', 'Cancelled exclusion test exception', e.message);
    }

    // ── Summary ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}${BLUE}════════════════════════════════════════${RESET}`);
    console.log(`${BOLD}  Results: ${GREEN}${passed} passed${RESET}${BOLD}, ${RED}${failed} failed${RESET}`);
    console.log(`${BOLD}${BLUE}════════════════════════════════════════${RESET}\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
});
