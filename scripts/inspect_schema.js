
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://pavnfiladmnwbptwlwpr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSchema() {
    console.log("--- Inspecting Activity Schema ---");
    const { data, error } = await supabase
        .from('activities')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Columns found:", Object.keys(data[0]));
        console.log("Sample Data:", JSON.stringify(data[0], null, 2));
    } else {
        console.log("No activities found.");
    }
}

inspectSchema();
