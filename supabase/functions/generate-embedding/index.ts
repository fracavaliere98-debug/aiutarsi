import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
    try {
        const payload = await req.json();
        const { table, record, type } = payload;

        console.log(`[Payload] Table: ${table}, Record ID: ${record.id}, Type: ${type}`);

        let textToEmbed = "";
        if (table === "activities") {
            const { data: actSkillsData } = await supabase
                .from('activity_skills')
                .select('skill')
                .eq('activity_id', record.id);

            const actSkills = (actSkillsData || []).map((s: any) => s.skill).join(", ");
            textToEmbed = `Titolo: ${record.title}. Categoria: ${record.category || "Generale"}. Descrizione: ${record.description || ""}. Competenze richieste: ${actSkills}`;
        } else if (table === "profiles") {
            const [skillsRes, interestsRes] = await Promise.all([
                supabase.from('user_skills').select('skill').eq('user_id', record.id),
                supabase.from('user_interests').select('interest').eq('user_id', record.id)
            ]);

            const skills = (skillsRes.data || []).map((s: any) => s.skill).join(", ");
            const interests = (interestsRes.data || []).map((i: any) => i.interest).join(", ");

            textToEmbed = `Bio: ${record.bio || ""}. Interessi: ${interests}. Competenze: ${skills}`;
        }

        textToEmbed = textToEmbed.trim();
        if (!textToEmbed) {
            console.log("No content to embed, skipping.");
            return new Response("No content to embed", { status: 200 });
        }

        console.log(`Generating embedding via HF Inference for model sentence-transformers/all-MiniLM-L6-v2...`);

        const hfResponse = await fetch(
            `https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2`,
            {
                headers: {
                    Authorization: `Bearer ${Deno.env.get("HUGGING_FACE_TOKEN")}`,
                    "Content-Type": "application/json",
                    "x-wait-for-model": "true",
                },
                method: "POST",
                body: JSON.stringify({
                    inputs: textToEmbed
                }),
            }
        );

        if (!hfResponse.ok) {
            const errorText = await hfResponse.text();
            console.error(`Hugging Face API Error: ${hfResponse.status} - ${errorText}`);
            throw new Error(`HF API Error: ${hfResponse.status} - ${errorText}`);
        }

        const result = await hfResponse.json();

        // Handle both [...] and [[...]]
        const embedding = Array.isArray(result[0]) ? result[0] : result;

        console.log(`Embedding generated. Length: ${embedding.length}, Sample: ${embedding.slice(0, 3)}`);

        if (embedding.length !== 384) {
            console.error(`Invalid embedding length: ${embedding.length}. Expected 384.`);
            throw new Error(`Invalid embedding length: ${embedding.length}`);
        }

        const { error: updateError } = await supabase
            .from(table)
            .update({ embedding })
            .eq("id", record.id);

        if (updateError) throw updateError;

        console.log(`Successfully updated ${table} record ${record.id}`);

        return new Response(JSON.stringify({ success: true, message: "Embedding updated" }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err: any) {
        console.error("Embedding Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
});
