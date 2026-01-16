import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// Try Service Role first (Admin), then Anon Key (Public)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ CRITICAL ERROR: Missing environment variables!');
    console.error('Required: SUPABASE_URL, and (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)');
} else {
    // Only warn if Service Role is missing but we have Anon
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('⚠️  Running with SUPABASE_ANON_KEY. Admin features will fail, but public reads will work.');
    }
}

// Use safe placeholders to prevent startup crash if env vars are missing
// This allows the server to start and return 500 JSON errors instead of crashing hard
const safeUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeKey = supabaseKey || 'placeholder-key';

export const supabase = createClient(safeUrl, safeKey);
