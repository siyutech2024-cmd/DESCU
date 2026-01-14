import { Request, Response } from 'express';
import { supabase } from '../index';

export const createProduct = async (req: Request, res: Response) => {
    try {
        const productData = req.body;

        // Basic validation
        if (!productData.title || !productData.seller) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data, error } = await supabase
            .from('products')
            .insert([productData])
            .select();

        if (error) {
            throw error;
        }

        res.status(201).json(data[0]);
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
            .order('createdAt', { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (error: any) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: error.message });
    }
};
