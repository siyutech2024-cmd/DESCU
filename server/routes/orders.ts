import express from 'express';
import { supabase } from '../config/supabase';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/orders/create
 * 创建订单
 */
router.post('/create', authenticateToken, async (req, res) => {
    try {
        const {
            productId,
            orderType, // 'meetup' | 'shipping'
            paymentMethod, // 'online' | 'cash'
            shippingAddress, // 仅物流交易
            meetupLocation, // 仅当面交易
            meetupTime, // 仅当面交易
        } = req.body;

        const buyerId = req.user.id;

        // 1. 获取产品信息
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('*, seller:users!seller_id(*)')
            .eq('id', productId)
            .single();

        if (productError || !product) {
            return res.status(404).json({ error: '产品不存在' });
        }

        // 2. 验证不能购买自己的商品
        if (product.seller_id === buyerId) {
            return res.status(400).json({ error: '不能购买自己的商品' });
        }

        // 3. 计算金额
        const productAmount = product.price;
        let shippingFee = 0;
        let platformFee = 0;

        if (orderType === 'shipping') {
            // 简化：固定运费$50，实际应根据距离计算
            shippingFee = 50;
        }

        if (paymentMethod === 'online') {
            // 平台手续费3%
            platformFee = productAmount * 0.03;
        }

        const totalAmount = productAmount + shippingFee + platformFee;

        // 4. 创建订单
        const orderData: any = {
            product_id: productId,
            buyer_id: buyerId,
            seller_id: product.seller_id,
            order_type: orderType,
            payment_method: paymentMethod,
            product_amount: productAmount,
            shipping_fee: shippingFee,
            platform_fee: platformFee,
            total_amount: totalAmount,
            currency: 'MXN',
            status: paymentMethod === 'cash' ? 'paid' : 'pending_payment',
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
        };

        if (orderType === 'shipping') {
            orderData.shipping_address = shippingAddress;
        }

        if (orderType === 'meetup' && meetupLocation) {
            orderData.meetup_location = meetupLocation;
            orderData.meetup_time = meetupTime;
        }

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert(orderData)
            .select()
            .single();

        if (orderError) {
            console.error('创建订单失败:', orderError);
            return res.status(500).json({ error: '创建订单失败' });
        }

        // 5. 记录订单事件
        await supabase.from('order_timeline').insert({
            order_id: order.id,
            event_type: 'created',
            description: `订单创建 - ${orderType === 'meetup' ? '当面交易' : '物流配送'}`,
            created_by: buyerId,
            metadata: { order_type: orderType, payment_method: paymentMethod },
        });

        // 6. 如果是线上支付，返回支付所需信息
        if (paymentMethod === 'online') {
            // TODO: 创建Stripe Payment Intent (Week 2实现)
            return res.json({
                order,
                requiresPayment: true,
                // clientSecret: paymentIntent.client_secret
            });
        }

        // 7. 当面付款直接创建对话
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .select()
            .eq('product_id', productId)
            .eq('buyer_id', buyerId)
            .eq('seller_id', product.seller_id)
            .single();

        if (!conversation) {
            await supabase.from('conversations').insert({
                product_id: productId,
                buyer_id: buyerId,
                seller_id: product.seller_id,
            });
        }

        res.json({ order, success: true });
    } catch (error) {
        console.error('创建订单错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * GET /api/orders
 * 获取订单列表
 * Query: role=buyer | role=seller
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { role } = req.query;
        const userId = req.user.id;

        let query = supabase
            .from('orders')
            .select(`
        *,
        product:products(*),
        buyer:users!buyer_id(id, name, avatar, email),
        seller:users!seller_id(id, name, avatar, email)
      `)
            .order('created_at', { ascending: false });

        if (role === 'buyer') {
            query = query.eq('buyer_id', userId);
        } else if (role === 'seller') {
            query = query.eq('seller_id', userId);
        } else {
            // 返回所有相关订单
            query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
        }

        const { data: orders, error } = await query;

        if (error) {
            console.error('查询订单失败:', error);
            return res.status(500).json({ error: '查询订单失败' });
        }

        res.json({ orders });
    } catch (error) {
        console.error('获取订单错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * GET /api/orders/:id
 * 获取单个订单详情
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const { data: order, error } = await supabase
            .from('orders')
            .select(`
        *,
        product:products(*),
        buyer:users!buyer_id(id, name, avatar, email),
        seller:users!seller_id(id, name, avatar, email),
        timeline:order_timeline(*)
      `)
            .eq('id', id)
            .single();

        if (error) {
            return res.status(404).json({ error: '订单不存在' });
        }

        // 验证权限
        if (order.buyer_id !== userId && order.seller_id !== userId) {
            return res.status(403).json({ error: '无权访问此订单' });
        }

        res.json({ order });
    } catch (error) {
        console.error('获取订单详情错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * POST /api/orders/:id/confirm
 * 确认订单完成（买家或卖家）
 */
router.post('/:id/confirm', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // 1. 获取订单
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', id)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ error: '订单不存在' });
        }

        //  2. 验证权限
        const isBuyer = order.buyer_id === userId;
        const isSeller = order.seller_id === userId;

        if (!isBuyer && !isSeller) {
            return res.status(403).json({ error: '无权操作此订单' });
        }

        // 3. 更新确认状态
        const updateData: any = {};

        if (isBuyer && !order.buyer_confirmed_at) {
            updateData.buyer_confirmed_at = new Date().toISOString();
        }

        if (isSeller && !order.seller_confirmed_at) {
            updateData.seller_confirmed_at = new Date().toISOString();
        }

        // 如果已经确认过，返回
        if (Object.keys(updateData).length === 0) {
            return res.json({ message: '已确认过', order });
        }

        const { data: updatedOrder, error: updateError } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            return res.status(500).json({ error: '更新订单失败' });
        }

        // 4. 记录事件
        await supabase.from('order_timeline').insert({
            order_id: id,
            event_type: isBuyer ? 'buyer_confirmed' : 'seller_confirmed',
            description: `${isBuyer ? '买家' : '卖家'}确认完成`,
            created_by: userId,
        });

        // 5. 检查是否双方都已确认
        const bothConfirmed =
            updatedOrder.buyer_confirmed_at && updatedOrder.seller_confirmed_at;

        if (bothConfirmed) {
            // 标记为已完成
            const { data: completedOrder } = await supabase
                .from('orders')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single();

            // 记录完成事件
            await supabase.from('order_timeline').insert({
                order_id: id,
                event_type: 'completed',
                description: '订单已完成',
                created_by: userId,
            });

            // TODO: 更新信用分 (Week 5实现)
            // TODO: 释放款项给卖家 (Week 2实现)

            return res.json({
                message: '订单已完成',
                order: completedOrder,
                completed: true,
            });
        }

        res.json({
            message: `${isBuyer ? '买家' : '卖家'}已确认，等待另一方确认`,
            order: updatedOrder,
            completed: false,
        });
    } catch (error) {
        console.error('确认订单错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * POST /api/orders/:id/arrange-meetup
 * 约定见面时间地点（当面交易）
 */
router.post('/:id/arrange-meetup', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { location, time, lat, lng } = req.body;
        const userId = req.user.id;

        // 1. 获取订单
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', id)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ error: '订单不存在' });
        }

        // 2. 验证权限和订单类型
        if (order.buyer_id !== userId && order.seller_id !== userId) {
            return res.status(403).json({ error: '无权操作此订单' });
        }

        if (order.order_type !== 'meetup') {
            return res.status(400).json({ error: '仅当面交易可以约定见面' });
        }

        // 3. 更新见面信息
        const { data: updatedOrder, error: updateError } = await supabase
            .from('orders')
            .update({
                meetup_location: location,
                meetup_time: time,
                meetup_location_lat: lat,
                meetup_location_lng: lng,
                status: 'meetup_arranged',
                // 重置确认状态（如果修改了时间地点）
                meetup_confirmed_by_buyer: false,
                meetup_confirmed_by_seller: false,
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            return res.status(500).json({ error: '更新失败' });
        }

        // 4. 记录事件
        await supabase.from('order_timeline').insert({
            order_id: id,
            event_type: 'meetup_arranged',
            description: `约定见面: ${location}, ${new Date(time).toLocaleString()}`,
            created_by: userId,
            metadata: { location, time, lat, lng },
        });

        res.json({ order: updatedOrder });
    } catch (error) {
        console.error('约定见面错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

export default router;
