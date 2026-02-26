const { supabase } = require('./utils/supabase');

async function test() {
    const { data, error } = await supabase.from('activities').select('*').ilike('title', '%Provolone%');
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));

    const now = new Date().toISOString();
    console.log('Current UTC now:', now);

    const { data: toComplete } = await supabase
        .from('activities')
        .select('id, title, date_end, status')
        .in('status', ['APERTA', 'IN_CORSO'])
        .lte('date_end', now);
    console.log('Would Complete:', toComplete);
}
test();
