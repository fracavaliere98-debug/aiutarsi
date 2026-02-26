
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pavnfiladmnwbptwlwpr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M';

// Simple polyfill required for supabase-js in some node envs if fetch is missing (Node 18+ has fetch)
if (!global.fetch) {
    console.warn("Fetch not found, this script requires Node 18+");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    console.log("Testing Supabase Connection (JS)...");
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));

    try {
        const start = Date.now();
        // Just pinging a public endpoint or checking health would be better, but selecting from a table is a good integration test.
        // We know 'profiles' exists or should exist.
        const { data, error } = await Promise.race([
            supabase.from('profiles').select('count', { count: 'exact', head: true }),
            timeout
        ]);

        const duration = Date.now() - start;

        if (error) {
            console.error("Connection Failed:", error.message);
            if (error.cause) console.error("Cause:", error.cause);
        } else {
            console.log(`Connection Successful! (Took ${duration}ms)`);
            console.log("Data:", data);
        }
    } catch (e) {
        console.error("Connection Error:", e.message);
        if (e.cause) console.error("Cause:", e.cause);
    }
}

testConnection();
