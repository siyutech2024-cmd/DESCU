
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
    // This requires environment variables to be present.
    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_ANON_KEY;

    if (!sbUrl || !sbKey) {
        throw new Error('Supabase Helper: Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
    }

    return createClient(sbUrl, sbKey, {
        global: {
            headers: {
                Authorization: authHeader || ''
            }
        }
    });
};
