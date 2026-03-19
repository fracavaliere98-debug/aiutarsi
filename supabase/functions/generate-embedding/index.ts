import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

Deno.serve(async (req) => {
    try {
        const payload = await req.json();
        const { table, record, type } = payload;

        console.log(`[Payload] Table: ${table}, Record ID: ${record.id}, Type: ${type}`);

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        console.log(`[Config] URL: ${!!supabaseUrl}, KEY: ${!!serviceRoleKey}`);

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error(`Missing vars: URL=${!!supabaseUrl}, KEY=${!!serviceRoleKey}`);
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Fetch HF API Key from database
        const { data: secretData, error: secretError } = await supabase
            .from('internal_secrets')
            .select('value')
            .eq('key', 'HUGGINGFACE_API_KEY')
            .single();

        if (secretError) {
            console.error(`[Error] Secret fetch failed: ${secretError.message}`);
        }

        const hfToken = secretData?.value || Deno.env.get("HUGGINGFACE_API_KEY") || Deno.env.get("HUGGING_FACE_TOKEN");
        console.log(`[Step] HF Token found: ${!!hfToken}`);

        if (!hfToken) {
            throw new Error("Hugging Face Token not found in DB or Env");
        }

        let textToEmbed = "";
        console.log(`[Step] Processing table: ${table}...`);
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

        console.log(`Generating embedding for: ${textToEmbed.substring(0, 50)}...`);

        const hfResponse = await fetch(
            `https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction`,
            {
                headers: {
                    Authorization: `Bearer ${hfToken}`,
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
            console.error(`HF Error (${hfResponse.status}): ${errorText}`);
            throw new Error(`HF API Error: ${hfResponse.status} - ${errorText}`);
        }

        const result = await hfResponse.json();
        const embedding = Array.isArray(result[0]) ? result[0] : result;

        console.log(`Embedding success. Length: ${embedding.length}`);

        if (embedding.length !== 384) {
            throw new Error(`Invalid embedding length: ${embedding.length}`);
        }

        const { error: updateError } = await supabase
            .from(table)
            .update({ embedding })
            .eq("id", record.id);

        if (updateError) throw updateError;

        console.log(`Successfully updated ${table} record ${record.id}`);

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err: any) {
        console.error("Critical Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
});
