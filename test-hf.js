const token = process.env.HUGGINGFACE_API_KEY || "";
if (!token) { console.error("HUGGINGFACE_API_KEY is not set"); process.exit(1); }
const systemPrompt = "Sei Gemma, l'assistente ufficiale di AiutarSì. Rispondi in italiano.";
const userQuestion = "Ciao, come funziona il sistema XP?";

const testUrl = async (url, model, name) => {
  console.log(`\nTesting ${name}`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userQuestion }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    if (res.ok) {
        try {
            const data = JSON.parse(text);
            console.log(`Risposta:\n${data.choices?.[0]?.message?.content || JSON.stringify(data)}`);
            return true;
        } catch(e) { console.log(text); }
    } else {
        console.log(`Error body: ${text}`);
    }
  } catch(e) {
      console.log(`Exception: ${e.message}`);
  }
  return false;
};

async function main() {
    await testUrl("https://router.huggingface.co/v1/chat/completions", "mistralai/Mixtral-8x7B-Instruct-v0.1", "Mixtral 8x7B");
    await testUrl("https://router.huggingface.co/v1/chat/completions", "meta-llama/Meta-Llama-3-8B-Instruct", "Llama 3 8B");
    await testUrl("https://router.huggingface.co/v1/chat/completions", "meta-llama/Llama-3.1-8B-Instruct", "Llama 3.1 8B");
}

main();
