import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/userAuth.js';

/**
 * User account routes: credit score, payout history, location, bank info, addresses.
 */
export const usersRouter = Router();
const router = usersRouter;

router.get('/api/users/:userId/credit', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase
            .from('credit_scores')
            .select('score')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        res.json({ score: data?.score || 500 }); // Default start score
    } catch (error: any) {
        console.error('Get credit score error:', error);
        res.status(500).json({ error: 'Failed to get credit score', message: error.message });
    }
});

// Get seller's payout history (user)
router.get('/api/users/payouts', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;

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
            .order('completed_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        // Calculate payout amounts
        const result = (payouts || []).map(p => ({
            ...p,
            payoutAmount: p.total_amount - (p.platform_fee || p.total_amount * 0.05),
            status: p.payout_status || 'pending'
        }));

        // Get summary
        const summary = {
            totalEarned: result.reduce((sum, p) => sum + p.payoutAmount, 0),
            pending: result.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.payoutAmount, 0),
            completed: result.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.payoutAmount, 0)
        };

        res.json({ payouts: result, summary });
    } catch (error: any) {
        console.error('Get user payouts error:', error);
        res.status(500).json({ error: 'Failed to get payouts', message: error.message });
    }
});

// Update user location
router.post('/api/users/update-location', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { country, city, countryName, lat, lng } = req.body;

        console.log('[UpdateLocation] Updating location for user:', userId, { country, city });

        const { error } = await supabase
            .from('users')
            .update({
                location_country: country,
                location_city: city,
                location_lat: lat || null,
                location_lng: lng || null,
                location_updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) {
            console.error('[UpdateLocation] Error:', error);
            throw error;
        }

        res.json({
            success: true,
            location: { country, city, countryName }
        });
    } catch (error: any) {
        console.error('Update location error:', error);
        res.status(500).json({
            error: 'Failed to update location',
            message: error.message
        });
    }
});


// Save seller bank info (simplified - no Stripe Connect)
router.post('/api/users/bank-info', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { bankName, clabe, holderName } = req.body;

        // Validate CLABE (18 digits)
        if (!clabe || clabe.length !== 18 || !/^\d+$/.test(clabe)) {
            return res.status(400).json({ error: 'CLABE must be 18 digits' });
        }

        if (!holderName || !bankName) {
            return res.status(400).json({ error: 'Bank name and holder name are required' });
        }

        console.log('[BankInfo] Saving bank info for user:', userId);

        // Upsert into sellers table
        const { error } = await supabase
            .from('sellers')
            .upsert({
                user_id: userId,
                bank_clabe: clabe,
                bank_name: bankName,
                bank_holder_name: holderName,
                bank_info_updated_at: new Date().toISOString(),
                onboarding_complete: true
            }, { onConflict: 'user_id' });

        if (error) {
            console.error('[BankInfo] Error:', error);
            throw error;
        }

        res.json({
            success: true,
            message: 'Bank info saved successfully'
        });
    } catch (error: any) {
        console.error('Save bank info error:', error);
        res.status(500).json({
            error: 'Failed to save bank info',
            message: error.message
        });
    }
});

// ------------------------------------------------------------------
// USER ADDRESS ROUTES
// ------------------------------------------------------------------
router.get('/api/users/addresses', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { data, error } = await supabase
            .from('user_addresses')
            .select('*')
            .eq('user_id', userId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ addresses: data || [] });
    } catch (error: any) {
        console.error('Fetch addresses error:', error);
        res.status(500).json({ error: 'Failed to fetch addresses', message: error.message });
    }
});

router.post('/api/users/addresses', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { recipient_name, phone_number, street_address, city, state, zip_code, country, is_default } = req.body;

        if (!recipient_name || !phone_number || !street_address || !city || !state || !zip_code) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (is_default) {
            await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', userId);
        }

        const { data, error } = await supabase
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

        if (error) throw error;
        res.json({ address: data });
    } catch (error: any) {
        console.error('Add address error:', error);
        res.status(500).json({ error: 'Failed to add address', message: error.message });
    }
});

router.put('/api/users/addresses/:id', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const updates = req.body;
        delete updates.user_id;
        delete updates.id;
        delete updates.created_at;

        if (updates.is_default) {
            await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', userId);
        }

        const { data, error } = await supabase
            .from('user_addresses')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        res.json({ address: data });
    } catch (error: any) {
        console.error('Update address error:', error);
        res.status(500).json({ error: 'Failed to update address', message: error.message });
    }
});

router.delete('/api/users/addresses/:id', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { error } = await supabase
            .from('user_addresses')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        console.error('Delete address error:', error);
        res.status(500).json({ error: 'Failed to delete address', message: error.message });
    }
});
