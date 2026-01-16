import { Request, Response } from 'express';
import { supabase } from '../db/supabase';

export const createProduct = async (req: Request, res: Response) => {
    try {
        const {
            seller_id,
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
            location_name
        } = req.body;

        // 验证必填字段
        console.log('Received product data:', { seller_id, title, price, category });

        if (!seller_id || !title) {
            console.error('Validation failed: missing seller_id or title');
            return res.status(400).json({ error: 'Missing or invalid required fields' });
        }

        if (price === undefined || price === null) {
            console.error('Validation failed: price is missing');
            return res.status(400).json({ error: 'Missing or invalid required fields' });
        }

        // 准备数据
        const productData = {
            seller_id,
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
            status: 'active',
            views_count: 0,
            reported_count: 0,
            is_promoted: false
        };

        const { data, error } = await supabase
            .from('products')
            .insert([productData])
            .select()
            .single();

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
};

import { translateBatch } from '../services/translationService';

export const getProducts = async (req: Request, res: Response) => {
    try {
        const { lang, limit = '50', offset = '0' } = req.query; // Added limit/offset support

        let query = supabase
            .from('products')
            .select('*')
            .is('deleted_at', null)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        // Apply Limit (Defaut 50 to prevent slow load)
        const limitVal = parseInt(String(limit));
        if (!isNaN(limitVal) && limitVal > 0) {
            query = query.limit(limitVal);
        }

        // Limit results if translating to avoid timeouts (override if lang is set)
        if (lang && lang !== 'es') {
            query = query.limit(20);
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
        res.status(500).json({ error: error.message || 'Failed to fetch products' });
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
            return res.status(404).json({ error: 'Product not found' });
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
