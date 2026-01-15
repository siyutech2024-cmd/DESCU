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

export const getProducts = async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .is('deleted_at', null)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(data || []);
    } catch (error: any) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: error.message || 'Failed to fetch products' });
    }
};
