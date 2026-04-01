require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !anonKey) {
  throw new Error("Missing Supabase env vars: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

async function testGemma() {
  console.log("Testing deployed gemma-help-assistant...");
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/gemma-help-assistant`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Ciao, potresti spiegarmi come funziona il sistema XP?",
      }),
    });

    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(`Risposta: ${data.answer || data.error}`);
  } catch (error) {
    console.log(`Exception: ${error.message}`);
  }
}

testGemma();
