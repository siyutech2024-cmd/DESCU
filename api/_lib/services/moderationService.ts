import { supabase } from '../db/supabase.js';

/**
 * User-to-user blocks.
 *
 * A block is directional (blocker → blocked) but its *effect* is symmetric: once either
 * party has blocked the other, neither can open a conversation or send messages.
 *
 * The `blocks` table is created by database/migrations/2026-09-04_week1.sql. Until that
 * migration has run in an environment, the table is missing (Postgres 42P01); we treat
 * that as "no blocks" and log, so a code deploy never has to wait on the schema.
 */

const MISSING_TABLE = '42P01';

export const isBlockedBetween = async (userA: string, userB: string): Promise<boolean> => {
    const { data, error } = await supabase
        .from('blocks')
        .select('blocker_id')
        .or(`and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`)
        .limit(1);
    if (error) {
        if (error.code !== MISSING_TABLE) console.error('[moderation] blocks lookup failed:', error.message);
        return false;
    }
    return (data?.length ?? 0) > 0;
};

/** Ids of users the given user has blocked (empty when the table does not exist yet). */
export const listBlockedIds = async (blockerId: string): Promise<string[]> => {
    const { data, error } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', blockerId);
    if (error) {
        if (error.code !== MISSING_TABLE) console.error('[moderation] blocks list failed:', error.message);
        return [];
    }
    return (data ?? []).map(row => row.blocked_id as string);
};
