const token = "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";
const text = "Titolo: Aiutare i gatti. Categoria: Animali.";

async function testEmbedding() {
    console.log("Testing Embedding API...");
    const url = "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction";
    
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "x-wait-for-model": "true"
            },
            body: JSON.stringify({ inputs: text })
        });
        
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        if (res.ok) {
            console.log(`Success! Array length: ${data.length}`);
            console.log(`Sample: ${data.slice(0, 3)}`);
        } else {
            console.log(`Error: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        console.log(`Exception: ${e.message}`);
    }
}

testEmbedding();
