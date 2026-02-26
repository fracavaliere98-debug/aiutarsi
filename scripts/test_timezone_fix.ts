import { supabase } from '../utils/supabase';

async function runTest() {
    console.log("--- INIZIO TEST FUSO ORARIO ---");

    // 1. Simulo l'input dell'utente su create-activity.tsx
    // L'utente inserisce una data e ora corrispondente a 1 minuto fa locale.
    const nowLocal = new Date();
    nowLocal.setMinutes(nowLocal.getMinutes() - 1); // Scaduta da 1 minuto

    const year = nowLocal.getFullYear();
    const month = String(nowLocal.getMonth() + 1).padStart(2, '0');
    const day = String(nowLocal.getDate()).padStart(2, '0');
    const hours = String(nowLocal.getHours()).padStart(2, '0');
    const minutes = String(nowLocal.getMinutes()).padStart(2, '0');

    // Mimo i campi del form (senza la Z, come nella fix locale)
    const formDate = `${year}-${month}-${day}`;
    const formEndTime = `${hours}:${minutes}`;

    console.log(`[1] L'utente compila la fine attività: ${formDate} alle ${formEndTime} (Timezone locale app)`);

    // 2. Converto come fa l'app post-fix (usando la build in local timezone)
    const end = new Date(`${formDate}T${formEndTime}:00`);
    const dateEndISO = end.toISOString();
    console.log(`[2] L'app calcola e invia a Supabase la fine ISO (UTC reale corretto): ${dateEndISO}`);

    // Prendo una NPO random
    const { data: npos } = await supabase.from('profiles').select('id').eq('role', 'NPO').limit(1);
    const npoId = npos?.[0]?.id;

    if (!npoId) {
        console.error("Nessuna NPO trovata per il test");
        return;
    }

    // 3. Inserisco nel DB
    const testTitle = `Test Scadenza TZ ${Date.now()}`;
    const { data: inserted, error: insertError } = await supabase.from('activities').insert({
        npo_id: npoId,
        title: testTitle,
        description: "Test description",
        date_start: new Date(nowLocal.getTime() - 60 * 60 * 1000).toISOString(), // 1h before
        date_end: dateEndISO,
        slots_total: 10,
        category: "Test",
        status: "IN_CORSO", // Simulo che sia già iniziata
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

    // 4. Simulo il refreshActivityStates (backend check)
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
        console.log(`[SUCCESS] \x1b[32mIl DB riconosce correttamente che '${inserted.title}' è SCADUTA e pronta per il Completamento!\x1b[0m`);

        // Pulizia: Completa ed elimina
        await supabase.from('activities').update({ status: 'COMPLETATA' }).eq('id', inserted.id);
        console.log(`[OK] Stato settato a COMPLETATA su Supabase in tempo reale come da attese.`);

        await supabase.from('activities').delete().eq('id', inserted.id);
        console.log(`[OK] Test pulito con successo.`);
    } else {
        console.error(`[FAIL] \x1b[31mIl DB non la vede ancora come scaduta! La query lte('date_end', nowUTC) ha fallito.\x1b[0m`);
        await supabase.from('activities').delete().eq('id', inserted.id);
    }
}

runTest();
