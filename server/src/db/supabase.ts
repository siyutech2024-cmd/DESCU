import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// Try Service Role first (Admin), then Anon Key (Public)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ CRITICAL ERROR: Missing environment variables!');
    console.error('Required: SUPABASE_URL, and (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)');
    // We throw to stop execution with a clear message rather than crashing inside createClient
    throw new Error('Server Start Failed: Missing Supabase Environment Variables');
} else {
    // Only warn if Service Role is missing but we have Anon
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('⚠️  Running with SUPABASE_ANON_KEY. Admin features will fail, but public reads will work.');
    }
}

export const supabase = createClient(supabaseUrl, supabaseKey);
