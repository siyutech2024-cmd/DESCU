import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { createClient } from '@supabase/supabase-js';
import { t } from '../utils/i18n.js';

export const createProduct = async (req: any, res: Response) => {
    try {
        const user = req.user; // Set by requireAuth
        const authHeader = req.headers.authorization;

        if (!user || !authHeader) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const {
            seller_name,
            seller_email,
            seller_avatar,
            seller_verified,
            title,
            description,
            price,
            currency,
            images,
            category,
            delivery_type,
            latitude,
            longitude,
            location_name,
            country,
            city,
            town,
            district,
            location_display_name
        } = req.body;

        // Validation
        if (!title || price === undefined) {
            return res.status(400).json({ error: 'Missing required fields (title, price)' });
        }

        const productData = {
            seller_id: user.id, // Enforce authenticated user ID
            seller_name: seller_name || 'Unknown',
            seller_email: seller_email || '',
            seller_avatar: seller_avatar || null,
            seller_verified: seller_verified || false,
            title,
            description: description || '',
            price: Number(price),
            currency: currency || 'MXN',
            images: images || [],
            category: category || 'other',
            delivery_type: delivery_type || 'both',
            latitude: latitude || 0,
            longitude: longitude || 0,
            location_name: location_name || '',
            country: country || 'MX',
            city: city || 'Unknown',
            town: town || null,
            district: district || null,
            location_display_name: location_display_name || null,
            status: 'pending_review',
            views_count: 0,
            reported_count: 0,
            is_promoted: false
        };

        console.log('[Product] Creating product with status:', productData.status);

        // Create a scoped Supabase client for this user to pass RLS
        const scopedSupabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_ANON_KEY!,
            {
                global: {
                    headers: {
                        Authorization: authHeader // Pass the Bearer token
                    }
                }
            }
        );

        const { data, error } = await scopedSupabase
            .from('products')
            .insert([productData])
            .select()
            .single();

        if (error) {
            console.error('Supabase insert error:', error);
            throw error;
        }

        res.status(201).json(data);
    } catch (error: any) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: error.message || 'Failed to create product' });
    }
};

import { translateBatch } from '../services/translationService.js';

// Health Check
export const productsHealthCheck = (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        message: 'Product controller loaded',
        env: {
            hasSupabaseUrl: !!process.env.SUPABASE_URL,
            hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
            hasViteSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
            hasGeminiKey: !!process.env.GEMINI_API_KEY
        }
    });
};

export const getProducts = async (req: Request, res: Response) => {
    try {
        const { lang, limit = '50', offset = '0', status, seller_id } = req.query; // Added limit/offset/status/seller_id support
        const authHeader = req.headers.authorization;

        let client = supabase;

        // If user is authenticated, use their context (for RLS)
        if (authHeader) {
            const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
            const sbKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

            if (sbUrl && sbKey) {
                client = createClient(
                    sbUrl,
                    sbKey,
                    {
                        global: {
                            headers: {
                                Authorization: authHeader
                            }
                        }
                    }
                );
            }
        }

        let query = client
            .from('products')
            .select('*')
            .is('deleted_at', null);

        // Filter by seller_id if provided
        if (seller_id) {
            query = query.eq('seller_id', seller_id);
        }

        // Status Logic:
        // Default to 'active' unless 'status' param is provided
        // Use 'all' to fetch all statuses (RLS policies will still apply)
        if (status) {
            if (status !== 'all') {
                query = query.eq('status', status);
            }
        } else {
            // Default behavior: Public feed only shows active products
            query = query.eq('status', 'active');
        }

        query = query.order('created_at', { ascending: false });

        // Apply Pagination (Range)
        const limitVal = parseInt(String(limit)) || 20;
        const offsetVal = parseInt(String(offset)) || 0;

        // Supabase range is inclusive [start, end]
        query = query.range(offsetVal, offsetVal + limitVal - 1);

        // Limit results if translating to avoid timeouts (but keep pagination working)
        if (lang && lang !== 'es' && limitVal > 20) {
            // If user requested > 20 translated items, cap it?
            // Actually, let's just trust the frontend to send limit=20
        }

        const { data, error } = await query;

        if (error) throw error;

        let products = data || [];

        // Apply Translation
        if (lang && typeof lang === 'string' && products.length > 0) {
            // Mapping target language codes
            const mapLang: Record<string, string> = {
                'zh': 'Chinese (Simplified)',
                'en': 'English',
                'es': 'Spanish'
            };

            const targetLang = mapLang[lang];

            if (targetLang && lang !== 'es') { // Assuming base is mostly ES, or just always translate if lang is specified and supported
                // Optimization: Only translate if no "cached" translation exists. 
                // For MVP, dynamic translation.
                const translatableItems = products.map(p => ({
                    id: p.id,
                    title: p.title,
                    description: p.description
                }));

                const translatedItems = await translateBatch(translatableItems, targetLang);

                // Merge back
                products = products.map(p => {
                    const trans = translatedItems.find(t => t.id === p.id);
                    if (trans) {
                        return { ...p, title: trans.title, description: trans.description };
                    }
                    return p;
                });
            }
        }

        res.json(products);
    } catch (error: any) {
        console.error("Error fetching products:", error);
        res.status(500).json({
            error: error.message || 'Failed to fetch products',
            stack: error.stack,
            envCheck: {
                hasSupabaseUrl: !!process.env.SUPABASE_URL,
                hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY
            }
        });
    }
};

// Get single product
export const getProductById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { lang } = req.query;

        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !product) {
            return res.status(404).json({ error: t(req, 'PRODUCT_NOT_FOUND') });
        }

        // Apply Translation if needed
        if (lang && typeof lang === 'string' && lang !== 'es') {
            const mapLang: Record<string, string> = {
                'zh': 'Chinese (Simplified)',
                'en': 'English',
                'es': 'Spanish'
            };
            const targetLang = mapLang[lang];

            if (targetLang) {
                const translatableItems = [{
                    id: product.id,
                    title: product.title,
                    description: product.description
                }];
                const translatedItems = await translateBatch(translatableItems, targetLang);
                if (translatedItems[0]) {
                    product.title = translatedItems[0].title;
                    product.description = translatedItems[0].description;
                }
            }
        }

        res.json(product);
    } catch (error: any) {
        console.error("Error fetching product:", error);
        res.status(500).json({ error: error.message });
    }
};
