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
    console.log('✅ Supabase client initialized with Service Role Key.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');
