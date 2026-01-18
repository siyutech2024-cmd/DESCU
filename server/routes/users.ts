import express from 'express';
import { supabase } from '../src/db/supabase';
import { requireAuth as authenticateToken } from '../src/middleware/userAuth';

const router = express.Router();

/**
 * GET /api/users/addresses
 * 获取用户所有收货地址
 */
router.get('/addresses', authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id; // Corrected to use type assertion

        const { data: addresses, error } = await supabase
            .from('user_addresses')
            .select('*')
            .eq('user_id', userId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Fetch addresses error:', error);
            return res.status(500).json({ error: 'Failed to fetch addresses' });
        }

        res.json({ addresses: addresses || [] });
    } catch (error) {
        console.error('Server error fetch addresses:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/users/addresses
 * 添加新地址
 */
router.post('/addresses', authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const { recipient_name, phone_number, street_address, city, state, zip_code, country, is_default } = req.body;

        if (!recipient_name || !phone_number || !street_address || !city || !state || !zip_code) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data: address, error } = await supabase
            .from('user_addresses')
            .insert({
                user_id: userId,
                recipient_name,
                phone_number,
                street_address,
                city,
                state,
                zip_code,
                country: country || 'MX',
                is_default: is_default || false
            })
            .select()
            .single();

        if (error) {
            console.error('Add address error:', error);
            return res.status(500).json({ error: 'Failed to add address' });
        }

        res.json({ address });
    } catch (error) {
        console.error('Server error add address:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/users/addresses/:id
 * 更新地址
 */
router.put('/addresses/:id', authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;
        const updates = req.body;

        // Prevent updating critical fields like user_id or id
        delete updates.user_id;
        delete updates.id;
        delete updates.created_at;

        const { data: address, error } = await supabase
            .from('user_addresses')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId) // Security check
            .select()
            .single();

        if (error) {
            console.error('Update address error:', error);
            return res.status(500).json({ error: 'Failed to update address' });
        }

        res.json({ address });
    } catch (error) {
        console.error('Server error update address:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/users/addresses/:id
 * 删除地址
 */
router.delete('/addresses/:id', authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;

        const { error } = await supabase
            .from('user_addresses')
            .delete()
            .eq('id', id)
            .eq('user_id', userId); // Security check

        if (error) {
            console.error('Delete address error:', error);
            return res.status(500).json({ error: 'Failed to delete address' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Server error delete address:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/users/:id/credit
 * 获取用户信用分
 */
router.get('/:id/credit', async (req, res) => {
    try {
        const { id } = req.params;
        const { getCreditScore } = await import('../src/services/creditService');
        const score = await getCreditScore(id);
        res.json({ score });
    } catch (error) {
        console.error('Get credit score error:', error);
        res.status(500).json({ error: 'Failed to fetch credit score' });
    }
});

export default router;
