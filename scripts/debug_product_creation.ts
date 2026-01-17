
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCreate() {
    console.log('Testing Product Creation...');

    const productData = {
        seller_id: 'test-user-id',
        seller_name: 'Debug Bot',
        seller_email: 'debug@example.com',
        title: 'Debug Product ' + Date.now(),
        description: 'Testing status persistence',
        price: 100,
        currency: 'MXN',
        category: 'other',
        delivery_type: 'both',
        latitude: 0,
        longitude: 0,
        location_name: 'Debug Land',
        status: 'pending_review', // EXPLICITLY SETTING THIS
        views_count: 0,
        reported_count: 0,
        is_promoted: false
    };

    console.log('Inserting data with status:', productData.status);

    const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .single();

    if (error) {
        console.error('Insert Error:', error);
    } else {
        console.log('Insert Success!');
        console.log('Resulting ID:', data.id);
        console.log('Resulting Status:', data.status);

        if (data.status !== 'pending_review') {
            console.error('❌ CRITICAL: Status Mismatch! Expected pending_review, got', data.status);
            console.error('This indicates a Database Trigger is overriding the value.');
        } else {
            console.log('✅ SUCCESS: Status persisted correctly as pending_review.');
            console.log('This indicates the DB is fine, and the issue is likely outdated deployment code.');

            // Clean up
            await supabase.from('products').delete().eq('id', data.id);
        }
    }
}

testCreate();
