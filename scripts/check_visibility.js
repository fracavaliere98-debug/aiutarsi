
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://pavnfiladmnwbptwlwpr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkActivities() {
    console.log("--- Activity Status Check ---");

    // 1. Check statuses of the 3 activities in Naples
    const { data: activities, error: actError } = await supabase
        .from('activities')
        .select('id, title, status, location_lat, location_lng, is_urgent, slots_total')
        .in('title', ["Treppiede", "Raccolta Fondi Emergenza", "Distribuzione Pasti Solidali"]);

    if (actError) {
        console.error("Error fetching activities:", actError);
        return;
    }

    activities.forEach(a => {
        console.log(`Activity: "${a.title}" | Status: ${a.status} | Lat: ${a.location_lat} | Lng: ${a.location_lng}`);
    });

    // 2. Test the RPC with coordinates of Naples
    const naplesLat = 40.8491;
    const naplesLng = 14.2503;

    console.log(`\n--- Testing RPC at Naples (${naplesLat}, ${naplesLng}) ---`);
    const { data: nearMe, error: rpcError } = await supabase.rpc('get_activities_near_me', {
        user_lat: naplesLat,
        user_lng: naplesLng,
        radius_meters: 50000 // 50km
    });

    if (rpcError) {
        console.error("RPC Error:", rpcError);
        return;
    }

    console.log(`RPC found ${nearMe ? nearMe.length : 0} activities within 50km.`);
    if (nearMe) {
        nearMe.forEach(a => {
            console.log(`  Found: "${a.title}" (ID: ${a.id}) | Distance: ${Math.round(a.distance_meters)}m`);
        });
    }
}

checkActivities();
