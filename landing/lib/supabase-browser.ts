import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export function hasBrowserSupabaseConfig() {
  return !!supabaseUrl && !!supabaseAnonKey;
}

export function getBrowserSupabase() {
  if (!hasBrowserSupabaseConfig()) {
    throw new Error("Variabili Supabase mancanti. Configura NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY su Vercel.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
