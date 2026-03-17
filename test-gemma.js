const supabaseUrl = "https://pavnfiladmnwbptwlwpr.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M";

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
