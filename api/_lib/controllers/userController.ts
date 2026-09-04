import { supabase } from '../db/supabase.js';
import { asyncHandler, notFound, parseBody, parseParams } from '../lib/http.js';
import type { AuthenticatedRequest } from '../middleware/userAuth.js';
import {
    AddressIdParamSchema,
    BankInfoSchema,
    CreateAddressSchema,
    UpdateAddressSchema,
    UpdateLocationSchema,
    UserIdParamSchema,
    SyncProfileSchema,
    FavoriteProductParamSchema,
} from '../schemas/users.js';

/**
 * User account handlers: credit score, seller payout history, location, bank info, addresses.
 * Every write is scoped to `req.user.id` — a user can only touch their own rows.
 */

const DEFAULT_CREDIT_SCORE = 500;
const PGRST_NO_ROWS = 'PGRST116';

/** Public: a seller's credit score (defaults when no row exists yet). */
export const getCreditScore = asyncHandler(async (req, res) => {
    const { userId } = parseParams(UserIdParamSchema, req.params);

    const { data, error } = await supabase
        .from('credit_scores')
        .select('score')
        .eq('user_id', userId)
        .single();
    if (error && error.code !== PGRST_NO_ROWS) throw error;

    res.json({ score: data?.score || DEFAULT_CREDIT_SCORE });
});

/** Seller's own payout history for captured online orders, with an earnings summary. */
export const getUserPayouts = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;

    const { data: payouts, error } = await supabase
        .from('orders')
        .select(`
            id,
            total_amount,
            platform_fee,
            payout_status,
            payout_at,
            payout_reference,
            completed_at,
            products:product_id(id, title, images)
        `)
        .eq('seller_id', userId)
        .in('status', ['completed', 'delivered'])
        .eq('payment_method', 'online')
        .eq('payment_captured', true)
        .order('completed_at', { ascending: false })
        .limit(50);
    if (error) throw error;

    const result = (payouts || []).map(p => ({
        ...p,
        payoutAmount: p.total_amount - (p.platform_fee || p.total_amount * 0.05),
        status: p.payout_status || 'pending',
    }));

    const sum = (rows: typeof result) => rows.reduce((acc, p) => acc + p.payoutAmount, 0);
    const summary = {
        totalEarned: sum(result),
        pending: sum(result.filter(p => p.status === 'pending')),
        completed: sum(result.filter(p => p.status === 'completed')),
    };

    res.json({ payouts: result, summary });
});

export const updateLocation = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const { country, city, countryName, lat, lng } = parseBody(UpdateLocationSchema, req.body);

    const { error } = await supabase
        .from('users')
        .update({
            location_country: country,
            location_city: city,
            location_lat: lat ?? null,
            location_lng: lng ?? null,
            location_updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    if (error) throw error;

    res.json({ success: true, location: { country, city, countryName } });
});

/** Save seller bank details (manual payouts — no Stripe Connect). Upserts the caller's sellers row. */
/** The caller's own SPEI bank details (null when none saved yet). */
export const getBankInfo = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { data, error } = await supabase
        .from('sellers')
        .select('bank_clabe, bank_name, bank_holder_name, bank_info_updated_at')
        .eq('user_id', req.user!.id)
        .maybeSingle();
    if (error && error.code !== '42P01') throw error; // table may not exist in a fresh environment
    res.json({ bankInfo: data?.bank_clabe ? data : null });
});

export const saveBankInfo = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const { bankName, clabe, holderName } = parseBody(BankInfoSchema, req.body);

    const { error } = await supabase
        .from('sellers')
        .upsert({
            user_id: userId,
            bank_clabe: clabe,
            bank_name: bankName,
            bank_holder_name: holderName,
            bank_info_updated_at: new Date().toISOString(),
            onboarding_complete: true,
        }, { onConflict: 'user_id' });
    if (error) throw error;

    res.json({ success: true, message: 'Bank info saved successfully' });
});

// ------------------------------------------------------------------
// Addresses
// ------------------------------------------------------------------

/** Clear the caller's current default so the incoming row becomes the only default. */
const clearDefaultAddress = async (userId: string) => {
    const { error } = await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', userId);
    if (error) throw error;
};

export const listAddresses = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;

    const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
    if (error) throw error;

    res.json({ addresses: data || [] });
});

export const createAddress = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const address = parseBody(CreateAddressSchema, req.body);

    if (address.is_default) await clearDefaultAddress(userId);

    const { data, error } = await supabase
        .from('user_addresses')
        .insert({ user_id: userId, ...address })
        .select()
        .single();
    if (error) throw error;

    res.json({ address: data });
});

/** Only the owner's row is matched (`user_id = caller`); a foreign/missing id surfaces as 404. */
export const updateAddress = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const { id } = parseParams(AddressIdParamSchema, req.params);
    const updates = parseBody(UpdateAddressSchema, req.body);

    if (updates.is_default) await clearDefaultAddress(userId);

    const { data, error } = await supabase
        .from('user_addresses')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
    if (error) throw error;

    res.json({ address: data });
});

export const deleteAddress = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const { id } = parseParams(AddressIdParamSchema, req.params);

    const { error } = await supabase
        .from('user_addresses')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
    if (error) throw error;

    res.json({ success: true });
});

/** Columns of public.users that anyone may see (the row also holds email/phone/location — never returned here). */
const PUBLIC_USER_COLUMNS = 'id, name, avatar_url, created_at';

/** Public: another user's profile card. */
export const getPublicUser = asyncHandler(async (req, res) => {
    const { userId } = parseParams(UserIdParamSchema, req.params);
    const { data, error } = await supabase.from('users').select(PUBLIC_USER_COLUMNS).eq('id', userId).maybeSingle();
    if (error) throw error;
    if (!data) throw notFound('User not found');
    res.json({ user: data });
});

/** Upsert the caller's own public.users row from their auth session (called after sign-in). */
export const syncOwnProfile = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { id, email } = req.user!;
    const body = parseBody(SyncProfileSchema, req.body);
    const { data, error } = await supabase
        .from('users')
        .upsert({ id, name: body.name, avatar_url: body.avatar_url ?? null, email: email ?? null, updated_at: new Date().toISOString() }, { onConflict: 'id' })
        .select(PUBLIC_USER_COLUMNS)
        .single();
    if (error) throw error;
    res.json({ user: data });
});

/** The caller's favourite product ids. */
export const listFavorites = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { data, error } = await supabase.from('favorites').select('product_id').eq('user_id', req.user!.id);
    if (error) throw error;
    res.json({ productIds: (data ?? []).map(f => f.product_id) });
});

/** Toggle a favourite; returns the resulting state. */
export const toggleFavorite = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const { productId } = parseParams(FavoriteProductParamSchema, req.params);
    const { data: existing, error } = await supabase
        .from('favorites').select('id').eq('user_id', userId).eq('product_id', productId).maybeSingle();
    if (error) throw error;
    if (existing) {
        const { error: delError } = await supabase.from('favorites').delete().eq('id', existing.id).eq('user_id', userId);
        if (delError) throw delError;
        return res.json({ favorited: false });
    }
    const { error: insError } = await supabase.from('favorites').insert({ user_id: userId, product_id: productId });
    if (insError && insError.code !== '23505') throw insError; // a concurrent double-tap already added it
    res.json({ favorited: true });
});
