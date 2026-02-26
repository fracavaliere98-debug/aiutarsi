// scripts/test_timezone_fix.js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Legge le chiavi env da Expo
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envContent.match(/EXPO_PUBLIC_SUPABASE_URL=([^ \r\n]+)/)[1];
const supabaseKey = envContent.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=([^ \r\n]+)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
    console.log("--- INIZIO TEST FUSO ORARIO ---");

    const nowLocal = new Date();
    // Facciamo finta che l'attività sia scaduta 1 minuto fa
    nowLocal.setMinutes(nowLocal.getMinutes() - 1);

    const year = nowLocal.getFullYear();
    const month = String(nowLocal.getMonth() + 1).padStart(2, '0');
    const day = String(nowLocal.getDate()).padStart(2, '0');
    const hours = String(nowLocal.getHours()).padStart(2, '0');
    const minutes = String(nowLocal.getMinutes()).padStart(2, '0');

    // Mimo i campi del form (senza la Z aggiuntiva usata prima del fix)
    const formDate = `${year}-${month}-${day}`;
    const formEndTime = `${hours}:${minutes}`;

    console.log(`[1] L'utente compila la fine attività: ${formDate} alle ${formEndTime} (Timezone locale app)`);

    // 2. L'app usa il fix per convertire con accuratezza matematica:
    const end = new Date(`${formDate}T${formEndTime}:00`);
    const dateEndISO = end.toISOString();
    console.log(`[2] L'app calcola e invia a Supabase la fine ISO (UTC reale corretto): ${dateEndISO}`);

    // Prendo una NPO random
    const { data: npos } = await supabase.from('profiles').select('id').eq('role', 'NPO').limit(1);
    const npoId = npos?.[0]?.id;

    // 3. Inserisco nel DB
    const testTitle = `Test Scadenza TZ ${Date.now()}`;
    const { data: inserted, error: insertError } = await supabase.from('activities').insert({
        npo_id: npoId,
        title: testTitle,
        description: "Test description",
        date_start: new Date(nowLocal.getTime() - 60 * 60 * 1000).toISOString(),
        date_end: dateEndISO,
        slots_total: 10,
        category: "Test",
        status: "IN_CORSO",
        location_address: "Test address",
        location_lat: 0,
        location_lng: 0,
        is_urgent: false
    }).select('id, title, date_end, status').single();

    if (insertError) {
        console.error("Errore di inserimento:", insertError);
        return;
    }
    console.log(`[3] Salvata nel DB l'attività '${inserted.title}' con scadenza a DB = ${inserted.date_end}`);

    // 4. Simulo il refreshActivityStates (backend check usato in tutta app)
    console.log(`[4] L'app (o un altro utente) ricarica la pagina e invoca refreshActivityStates()...`);
    const nowUTC = new Date().toISOString();
    console.log(`    -> Ora UTC Corrente: ${nowUTC}`);

    // Vediamo se la activity appena inserita soddisfa la query di completamento del database
    const { data: toComplete } = await supabase
        .from('activities')
        .select('id, title, date_end, status')
        .eq('id', inserted.id)
        .lte('date_end', nowUTC);

    if (toComplete && toComplete.length > 0) {
        console.log(`[SUCCESS] Il DB riconosce correttamente che '${inserted.title}' è SCADUTA e pronta per il Completamento!`);
        await supabase.from('activities').update({ status: 'COMPLETATA' }).eq('id', inserted.id);
        console.log(`[OK] Stato settato a COMPLETATA su Supabase in tempo reale come da attese.`);
        await supabase.from('activities').delete().eq('id', inserted.id);
        console.log(`[OK] Test completato con validazione positiva. Attività di prova ripulita dal database.`);
    } else {
        console.log(`[FAIL] Il DB non la vede ancora come scaduta! La query lte('date_end', nowUTC) ha fallito.`);
        await supabase.from('activities').delete().eq('id', inserted.id);
    }
}

runTest();
