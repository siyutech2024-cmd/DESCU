import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variable validation with fallback to VITE_* for backward compatibility
// Production should use SUPABASE_URL, but we support VITE_* to prevent deployment breaks
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

// Log environment status at module load (for debugging)
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ CRITICAL: Missing SUPABASE environment variables!');
    console.error('  SUPABASE_URL:', supabaseUrl ? '✓' : '✗ MISSING');
    console.error('  SUPABASE_KEY:', supabaseKey ? '✓' : '✗ MISSING');
    console.warn('⚠️  Using placeholder values to prevent module crash. API calls will fail.');
} else {
    // Log which variables are being used
    if (process.env.VITE_SUPABASE_URL && !process.env.SUPABASE_URL) {
        console.warn('⚠️  Using VITE_SUPABASE_URL (deprecated for backend). Consider adding SUPABASE_URL to environment variables.');
    }
    const keyType = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE_KEY' :
        (process.env.SUPABASE_ANON_KEY ? 'ANON_KEY' : 'VITE_ANON_KEY');
    console.log(`✓ Supabase ready with ${keyType}`);
}

// Create client with safe defaults to prevent module load crash
// Individual API calls will fail with clear errors if env vars missing
const safeUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeKey = supabaseKey || 'placeholder-key';

let _instance: SupabaseClient | null = null;

// Lazy initialization with validation
export const getSupabase = (): SupabaseClient => {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase not configured: Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel');
    }
    if (!_instance) {
        _instance = createClient(supabaseUrl, supabaseKey);
    }
    return _instance;
};

// For backwards compatibility - module-level export
// This allows the module to load without crashing
export const supabase = createClient(safeUrl, safeKey);

// Helper to check if properly configured
export const isSupabaseConfigured = (): boolean => {
    return !!(supabaseUrl && supabaseKey);
};

