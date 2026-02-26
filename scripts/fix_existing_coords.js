
const { createClient } = require('@supabase/supabase-js');

// Config - using the same ones as in the app context
const SUPABASE_URL = "https://pavnfiladmnwbptwlwpr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULT_LAT = 45.464;
const DEFAULT_LNG = 9.190;

async function geocode(address) {
    try {
        // Node 18+ has builtin fetch
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=it`,
            { headers: { 'User-Agent': 'AiutarSiCleanup/1.0' } }
        );
        const data = await res.json();
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
    } catch (e) {
        console.error(`Geocoding failed for: ${address}`, e.message);
    }
    return null;
}

async function runCleanup() {
    console.log("--- Starting Geo-Cleanup ---");

    // 1. Find affected activities
    const { data: affected, error } = await supabase
        .from('activities')
        .select('id, title, location_address, location_lat, location_lng')
        .eq('location_lat', DEFAULT_LAT)
        .eq('location_lng', DEFAULT_LNG);

    if (error) {
        console.error("Error fetching activities:", error);
        return;
    }

    console.log(`Found ${affected.length} activities with default coordinates.`);

    for (const act of affected) {
        console.log(`Processing: "${act.title}" - ${act.location_address}`);

        const coords = await geocode(act.location_address);

        if (coords) {
            console.log(`  New coords found: ${coords.lat}, ${coords.lng}`);

            const { error: updateError } = await supabase
                .from('activities')
                .update({
                    location_lat: coords.lat,
                    location_lng: coords.lng
                })
                .eq('id', act.id);

            if (updateError) {
                console.error(`  Failed to update ${act.id}:`, updateError.message);
            } else {
                console.log(`  Successfully updated!`);
            }
        } else {
            console.warn(`  Could not find coordinates for this address.`);
        }

        // Respect Nominatim usage policy (1 request per second)
        await new Promise(r => setTimeout(r, 1100));
    }

    console.log("--- Cleanup Finished ---");
}

runCleanup();
