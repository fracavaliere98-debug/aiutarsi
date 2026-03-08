import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

interface StorageEvent {
    type: string;
    name: string;
    bucketId: string;
    metadata: Record<string, any>;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
    try {
        const event: StorageEvent = await req.json();

        if (event.type !== 'ObjectCreated:Put') {
            return new Response(JSON.stringify({ message: 'Ignoring non-creation event' }));
        }

        // Previeni loop infiniti (non processare ciò che è già ottimizzato)
        if (event.name.includes('_optimized')) {
            return new Response(JSON.stringify({ message: 'Already optimized' }));
        }

        console.log(`[Optimizer] Processing image: ${event.name} in bucket ${event.bucketId}`);

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Scarica l'immagine originale
        const { data: originalBlob, error: downloadError } = await supabase.storage
            .from(event.bucketId)
            .download(event.name);

        if (downloadError) throw downloadError;

        // 2. LOGICA DI OTTIMIZZAZIONE
        // NOTA: In Deno Edge Functions, per una vera rielaborazione pixel-by-pixel
        // si consiglia l'uso di librerie WASM come ImageMagick o chiamate a API esterne.
        // Esempio skeleton per integrazione futura:

        console.log(`[Optimizer] Original size: ${originalBlob.size} bytes`);

        // Simuliamo l'invio a un servizio di ottimizzazione o trasformazione WASM
        // Per questo esempio, ci limitiamo a caricare una versione "marcata" 
        // per dimostrare il flusso.

        const optimizedBlob = originalBlob; // Placeholder per la trasformazione reale
        const optimizedName = event.name.replace(/\.[^/.]+$/, "") + "_optimized.webp";

        // 3. Carica la versione ottimizzata
        const { error: uploadError } = await supabase.storage
            .from(event.bucketId)
            .upload(optimizedName, optimizedBlob, {
                contentType: 'image/webp',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // 4. Opzionale: Rimuovi l'originale pesante o aggiorna il riferimento nel DB
        // await supabase.storage.from(event.bucketId).remove([event.name]);

        return new Response(JSON.stringify({
            success: true,
            original: event.name,
            optimized: optimizedName
        }), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('[Optimizer Error]', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
});
