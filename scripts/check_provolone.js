const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envContent.match(/EXPO_PUBLIC_SUPABASE_URL=([^ \r\n]+)/)[1];
const supabaseKey = envContent.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=([^ \r\n]+)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProvolone() {
    console.log("Controllo DB per Provolone1...");
    const { data: acts, error: err } = await supabase
        .from('activities')
        .select('id, title, date_start, date_end, status')
        .ilike('title', '%Provolone%');

    if (err) {
        console.error("Errore lettura DB:", err.message);
        return;
    }

    if (!acts || acts.length === 0) {
        console.log("Nessuna attività provolone trovata.");
        return;
    }

    const nowUTC = new Date().toISOString();
    console.log(`Ora attuale (UTC per supabase): ${nowUTC}`);

    for (const act of acts) {
        console.log(`\nAttività ID: ${act.id}`);
        console.log(`Titolo: ${act.title}`);
        console.log(`Stato: ${act.status}`);
        console.log(`Inizio a DB: ${act.date_start}`);
        console.log(`Fine a DB: ${act.date_end}`);

        let isExpired = act.date_end <= nowUTC;
        console.log(`E' nel passato rispetto a NOW (UTC)? -> ${isExpired ? "SÌ (Dovrebbe essere IN_CORSO / COMPLETATA)" : "NO"}`);

        const locEnd = new Date(act.date_end).toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
        console.log(`Orario Fine mostrato all'utente (CET): ${locEnd}`);
    }

    // Refresh fittizio da backend point of view (se facessimo noi l'update come da server)
    const { data: toComplete } = await supabase
        .from('activities')
        .select('id, title, status, date_end')
        .in('status', ['APERTA', 'IN_CORSO'])
        .lte('date_end', nowUTC);

    console.log("\nActivities pronte per il completamento globale se innescato update nel db dal backend:");
    console.log(toComplete);
}
checkProvolone();
