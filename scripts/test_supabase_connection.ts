
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pavnfiladmnwbptwlwpr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    console.log("Testing Supabase Connection...");
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));

    try {
        const start = Date.now();
        const { data, error } = await Promise.race([
            supabase.from('profiles').select('count', { count: 'exact', head: true }),
            timeout
        ]) as any;

        const duration = Date.now() - start;

        if (error) {
            console.error("Connection Failed:", error.message);
        } else {
            console.log(`Connection Successful! (Took ${duration}ms)`);
            console.log("Data:", data);
        }
    } catch (e: any) {
        console.error("Connection Error:", e.message);
    }
}

testConnection();
