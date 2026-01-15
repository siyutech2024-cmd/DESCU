import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ CRITICAL ERROR: Missing environment variables!');
    console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    console.error('Current URL:', supabaseUrl ? 'Set' : 'Missing');
    console.error('Current KEY:', supabaseKey ? 'Set' : 'Missing');
    console.warn('⚠️  Without SUPABASE_SERVICE_ROLE_KEY, admin user management features will NOT work.');
} else {
    try {
        // 简单的JWT解码检查 (无需引入额外库)
        const parts = supabaseKey.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            console.log(`🔑 Supabase Key Role: [${payload.role}]`);

            if (payload.role !== 'service_role') {
                console.error('❌ CRITICAL CONFIG ERROR: The configured key is NOT a service_role key!');
                console.error(`   Detected Role: ${payload.role}`);
                console.error('   Please update SUPABASE_SERVICE_ROLE_KEY in Railway with the "service_role" secret from Supabase.');
            } else {
                console.log('✅ Service Role Key confirmed. Admin privileges active.');
            }
        }
    } catch (e) {
        console.warn('⚠️ Could not decode Supabase Key to verify role.');
    }
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');
