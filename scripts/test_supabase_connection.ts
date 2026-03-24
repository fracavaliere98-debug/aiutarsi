import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing connection to:', supabaseUrl);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  try {
    // Try to fetch something simple. Profiles is a common table.
    const { data, error, status } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });

    if (error) {
      if (status === 401 || status === 403) {
        console.log('✅ Connection successful (URL and Key are valid), but access to "profiles" is restricted/forbidden (expected if RLS is on).');
      } else if (status === 404) {
        console.log('✅ Connection successful, but table "profiles" was not found (status 404).');
      } else {
        console.error('❌ API Error:', error.message, '(Status:', status, ')');
      }
    } else {
      console.log('✅ Successfully connected and queried "profiles" table!');
    }
  } catch (err) {
    console.error('❌ Connection failed:', err);
  }
}

test();
