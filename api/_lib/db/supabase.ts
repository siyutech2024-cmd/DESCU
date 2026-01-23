import { createClient } from '@supabase/supabase-js';

// Production environment variables (no VITE_* fallback)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    const errorMsg = '❌ CRITICAL ERROR: Missing required environment variables!\n' +
        'Required:\n' +
        '  - SUPABASE_URL: ' + (supabaseUrl ? '✓' : '✗ MISSING') + '\n' +
        '  - SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY: ' + (supabaseKey ? '✓' : '✗ MISSING') + '\n' +
        'Please configure these in your Vercel project settings.';

    console.error(errorMsg);
    throw new Error(errorMsg);
}

// Log which key type is being used (without exposing the actual key)
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('✓ Supabase initialized with SERVICE_ROLE_KEY (admin access)');
} else {
    console.log('✓ Supabase initialized with ANON_KEY (public access only)');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
