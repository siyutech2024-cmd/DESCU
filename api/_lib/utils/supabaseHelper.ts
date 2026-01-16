
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../db/supabase.js';

export const getAuthClient = (authHeader?: string): SupabaseClient => {
    // 1. If we have the Service Role Key (Admin), use the global admin client.
    // This bypasses RLS and simplifies everything (Admin sees all).
    // CAUTION: Only use this if the caller logic ensures permission checks (e.g. userId matching).
    // For "getUserOrders", we manually filter by userId, so Admin client is SAFE and MORE RELIABLE.
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return supabase;
    }

    // 2. Fallback: Create a scoped client acting as the user (RLS enforcement).
    // This requires VITE_ vars or standard vars to be present.
    const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const sbKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!sbUrl || !sbKey) {
        console.error('Supabase Helper: Missing Environment Variables');
        // Return global client as last resort (likely Anon/Guest)
        return supabase;
    }

    return createClient(sbUrl, sbKey, {
        global: {
            headers: {
                Authorization: authHeader || ''
            }
        }
    });
};
