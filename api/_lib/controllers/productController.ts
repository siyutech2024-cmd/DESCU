import type { Request } from 'express';
import { supabase } from '../db/supabase.js';
import { createClient } from '@supabase/supabase-js';
import { t } from '../utils/i18n.js';
import { asyncHandler, conflict, forbidden, notFound, parseBody, parseParams, parseQuery, unauthorized } from '../lib/http.js';
import type { AuthenticatedRequest } from '../middleware/userAuth.js';
import { CreateProductSchema, ListProductsQuerySchema, ProductIdParamSchema, UpdateOwnProductStatusSchema } from '../schemas/products.js';

/** Supabase client scoped to the caller's JWT so RLS applies (anon key + Bearer token). */
const scopedClient = (authHeader: string) => {
    const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!sbUrl || !sbKey) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be configured');
    return createClient(sbUrl, sbKey, { global: { headers: { Authorization: authHeader } } });
};

export const createProduct = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const user = req.user; // Set by requireAuth
    const authHeader = req.headers.authorization;
    if (!user || !authHeader) throw unauthorized();

    const body = parseBody(CreateProductSchema, req.body);

    const productData = {
        seller_id: user.id, // Enforce authenticated user ID
        seller_name: body.seller_name?.trim() || user.email?.split('@')[0] || 'Unknown',
        // Email comes from the verified auth user, never from the request body
        seller_email: user.email || '',
        seller_avatar: typeof body.seller_avatar === 'string' ? body.seller_avatar : null,
        // Verification is an admin-granted attribute; clients cannot self-award it
        seller_verified: false,
        title: body.title,
        description: body.description || '',
        price: body.price,
        currency: body.currency || 'MXN',
        images: body.images || [],
        category: body.category || 'other',
        subcategory: body.subcategory || null,
        source_language: body.source_language || 'es',
        delivery_type: body.delivery_type || 'both',
        latitude: body.latitude || 0,
        longitude: body.longitude || 0,
        location_name: body.location_name || '',
        country: body.country || 'MX',
        city: body.city || 'Unknown',
        town: body.town || null,
        district: body.district || null,
        location_display_name: body.location_display_name || null,
        status: 'pending_review',
        views_count: 0,
        reported_count: 0,
        is_promoted: false,
    };

    console.log('[Product] Creating product with status:', productData.status);

    // Insert through a client scoped to this user so the RLS insert policy applies.
    const { data, error } = await scopedClient(authHeader)
        .from('products')
        .insert([productData])
        .select()
        .single();
    if (error) throw error;

    // 异步通知搜索引擎新产品（不阻塞响应）
    if (data?.id) {
        import('./seoController.js').then(({ notifyIndexNow, pingGoogleSitemap }) => {
            const productUrl = `https://descu.ai/product/${data.id}`;
            notifyIndexNow([productUrl, 'https://descu.ai/']).catch(() => { });
            pingGoogleSitemap().catch(() => { });
        }).catch(() => { });
    }

    res.status(201).json(data);
});

export const getProducts = asyncHandler<Request>(async (req, res) => {
    const { limit, offset, status, seller_id } = parseQuery(ListProductsQuerySchema, req.query);
    const authHeader = req.headers.authorization;

    // If user is authenticated, use their context (for RLS)
    const client = authHeader ? scopedClient(authHeader) : supabase;

    let query = client
        .from('products')
        .select('*')
        .is('deleted_at', null);

    // Filter by seller_id if provided
    if (seller_id) query = query.eq('seller_id', seller_id);

    // Status Logic: default to 'active' unless 'status' is provided; 'all' fetches every
    // status (RLS policies still apply).
    if (status) {
        if (status !== 'all') query = query.eq('status', status);
    } else {
        // Default behavior: Public feed only shows active products
        query = query.eq('status', 'active');
    }

    // Supabase range is inclusive [start, end]
    const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) throw error;

    // 翻译已通过预翻译字段实现，前端根据语言读取对应字段
    res.json(data || []);
});

// Get single product
export const getProductById = asyncHandler<Request>(async (req, res) => {
    const { id } = req.params;

    const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
    if (error || !product) throw notFound(t(req, 'PRODUCT_NOT_FOUND'));

    // 翻译已通过预翻译字段实现，前端根据语言读取对应字段
    res.json(product);
});

/**
 * PATCH /api/products/:id/status — the seller marks their own listing sold, or relists it.
 * A relisted item goes back to `pending_review` (same path as a new listing) — never straight to active.
 */
export const updateOwnProductStatus = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.user!.id;
    const { id } = parseParams(ProductIdParamSchema, req.params);
    const { status } = parseBody(UpdateOwnProductStatusSchema, req.body);

    const { data: product, error } = await supabase
        .from('products')
        .select('id, seller_id, status, deleted_at')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    if (!product || product.deleted_at) throw notFound(t(req, 'PRODUCT_NOT_FOUND'));
    if (product.seller_id !== userId) throw forbidden('Only the seller can change this listing');

    const nextStatus = status === 'sold' ? 'sold' : 'pending_review';
    // Conditional on the current status so a stale button cannot flip an admin decision.
    const allowedFrom = status === 'sold' ? ['active', 'pending_review'] : ['sold', 'inactive'];
    if (!allowedFrom.includes(product.status)) {
        throw conflict(`Listing is ${product.status}; cannot set it to ${nextStatus}`);
    }
    const { data: updated, error: updateError } = await supabase
        .from('products')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('seller_id', userId)
        .in('status', allowedFrom)
        .select('id, status')
        .single();
    if (updateError) throw updateError;
    res.json({ success: true, product: updated });
});
