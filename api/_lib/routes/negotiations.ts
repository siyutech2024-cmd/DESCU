import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/userAuth.js';

/**
 * Price negotiation routes (buyer proposes, seller accepts/rejects/counters).
 */
export const negotiationsRouter = Router();
const router = negotiationsRouter;

// 发起议价
router.post('/api/negotiations/propose', requireAuth, async (req: any, res) => {
    try {
        const { conversationId, productId, proposedPrice } = req.body;
        const userId = req.user.id;

        console.log('[Negotiation API] Received request:', { conversationId, productId, proposedPrice, userId });

        // 验证参数
        if (!conversationId || !productId || !proposedPrice) {
            console.error('[Negotiation API] Missing fields');
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 获取对话信息
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', conversationId)
            .single();

        console.log('[Negotiation API] Conversation query result:', { conversation, convError });

        if (convError || !conversation) {
            console.error('[Negotiation API] Conversation not found:', convError);
            return res.status(404).json({ error: 'Conversation not found', details: convError?.message });
        }

        // 获取产品信息
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        console.log('[Negotiation API] Product query result:', { product, productError });

        if (productError || !product) {
            console.error('[Negotiation API] Product not found:', productError);
            return res.status(404).json({ error: 'Product not found', details: productError?.message });
        }

        // 确定买家和卖家
        // conversations表使用user1_id和user2_id，需要根据product.seller_id判断
        const sellerId = product.seller_id;
        const buyerId = conversation.user1_id === sellerId ? conversation.user2_id : conversation.user1_id;
        const actualSellerId = conversation.user1_id === sellerId ? conversation.user1_id : conversation.user2_id;

        console.log('[Negotiation API] Identity check:', {
            currentUserId: userId,
            productSellerId: sellerId,
            conversationUser1: conversation.user1_id,
            conversationUser2: conversation.user2_id,
            determinedBuyerId: buyerId,
            determinedSellerId: actualSellerId,
            isBuyer: buyerId === userId,
            isSeller: actualSellerId === userId
        });

        // 验证用户身份（只有买家可以发起议价）
        if (buyerId !== userId) {
            console.error('[Negotiation API] User not buyer:', {
                buyerId,
                sellerId: actualSellerId,
                userId
            });
            return res.status(403).json({
                error: 'Only buyer can propose price',
                debug: {
                    yourRole: actualSellerId === userId ? 'seller' : 'unknown',
                    requiredRole: 'buyer',
                    yourUserId: userId,
                    conversationUser1Id: conversation.user1_id,
                    conversationUser2Id: conversation.user2_id,
                    productSellerId: sellerId,
                    determinedBuyerId: buyerId,
                    conversationId
                }
            });
        }

        // 创建议价记录
        const { data: negotiation, error: negError } = await supabase
            .from('price_negotiations')
            .insert({
                conversation_id: conversationId,
                product_id: productId,
                buyer_id: buyerId,          // 买家ID
                seller_id: actualSellerId,  // 卖家ID
                original_price: product.price,
                offered_price: parseFloat(proposedPrice),
                proposed_by: userId,
                status: 'pending'
            })
            .select()
            .single();

        console.log('[Negotiation API] Created negotiation:', { negotiation, negError });

        if (negError) {
            console.error('[Negotiation API] Failed to create negotiation:', negError);
            throw negError;
        }

        // 发送议价卡片消息
        const messageResult = await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_id: userId,
            text: `💰 议价请求: $${proposedPrice} (原价: $${product.price})`,
            message_type: 'price_negotiation',
            content: JSON.stringify({
                negotiationId: negotiation.id,
                originalPrice: product.price,
                proposedPrice: parseFloat(proposedPrice),
                productTitle: product.title,
                status: 'pending'
            }),
            is_pinned: true,
            pinned_until: new Date(Date.now() + 48 * 60 * 60 * 1000) // 置顶48小时
        });

        console.log('[Negotiation API] Message insert result:', messageResult);

        if (messageResult.error) {
            console.error('Failed to insert negotiation message:', messageResult.error);
        }

        console.log('[Negotiation API] Success! Returning negotiation:', negotiation.id);
        res.json({ negotiation });
    } catch (error: any) {
        console.error('Propose negotiation error:', error);
        res.status(500).json({ error: 'Failed to propose price', message: error.message });
    }
});

// 响应议价
router.post('/api/negotiations/:id/respond', requireAuth, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { action, counterPrice } = req.body;
        const userId = req.user.id;

        // 验证action
        if (!['accept', 'reject', 'counter'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        // 获取议价记录 (简化查询，避免关联语法问题)
        const { data: negotiation, error: negError } = await supabase
            .from('price_negotiations')
            .select('*')
            .eq('id', id)
            .single();

        console.log('[Negotiation Response] Query result:', { negotiation, negError });

        if (negError || !negotiation) {
            console.error('[Negotiation Response] Not found:', negError);
            return res.status(404).json({ error: 'Negotiation not found', details: negError?.message });
        }

        // 单独获取产品信息
        const { data: product } = await supabase
            .from('products')
            .select('*')
            .eq('id', negotiation.product_id)
            .single();

        console.log('[Negotiation Response] Found negotiation:', {
            id: negotiation.id,
            seller_id: negotiation.seller_id,
            buyer_id: negotiation.buyer_id,
            offered_price: negotiation.offered_price,
            status: negotiation.status
        });

        // 验证卖家身份 - 使用 negotiation.seller_id
        if (negotiation.seller_id !== userId) {
            console.error('[Negotiation Response] Not seller:', { expected: negotiation.seller_id, actual: userId });
            return res.status(403).json({ error: 'Only seller can respond' });
        }

        // 验证状态
        if (negotiation.status !== 'pending') {
            return res.status(400).json({ error: 'Negotiation already processed' });
        }

        let updateData: any = {
            responded_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        let messageContent: any = {
            negotiationId: id,
            originalPrice: negotiation.original_price,
            proposedPrice: negotiation.offered_price,
            productTitle: product?.title || 'Unknown Product'
        };

        // 处理不同响应
        switch (action) {
            case 'accept':
                updateData.status = 'accepted';
                messageContent.status = 'accepted';
                messageContent.finalPrice = negotiation.proposed_price;

                // 更新产品价格
                await supabase
                    .from('products')
                    .update({ price: negotiation.offered_price })
                    .eq('id', negotiation.product_id);

                break;

            case 'reject':
                updateData.status = 'rejected';
                messageContent.status = 'rejected';
                break;

            case 'counter':
                if (!counterPrice) {
                    return res.status(400).json({ error: 'Counter price required' });
                }
                updateData.status = 'countered';
                updateData.counter_price = parseFloat(counterPrice);
                messageContent.status = 'countered';
                messageContent.counterPrice = parseFloat(counterPrice);
                break;
        }

        // 更新议价记录
        await supabase
            .from('price_negotiations')
            .update(updateData)
            .eq('id', id);

        // 生成响应消息文本
        let responseText = '';
        switch (action) {
            case 'accept':
                responseText = `✅ 卖家已接受议价 $${negotiation.offered_price}`;
                break;
            case 'reject':
                responseText = `❌ 卖家拒绝了议价`;
                break;
            case 'counter':
                responseText = `💬 卖家还价 $${counterPrice}`;
                break;
        }

        // 发送响应消息
        const msgResult = await supabase.from('messages').insert({
            conversation_id: negotiation.conversation_id,
            sender_id: userId,
            text: responseText,
            message_type: 'price_negotiation_response',
            content: JSON.stringify(messageContent),
            is_pinned: true,
            pinned_until: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });

        console.log('[Negotiation Response] Message insert result:', msgResult);

        // 更新原始议价消息的 content.status
        const { data: originalMsg, error: findError } = await supabase
            .from('messages')
            .select('id, content')
            .eq('conversation_id', negotiation.conversation_id)
            .eq('message_type', 'price_negotiation')
            .ilike('content', `%${id}%`)
            .single();

        if (originalMsg && !findError) {
            try {
                const updatedContent = JSON.parse(originalMsg.content);
                updatedContent.status = action === 'accept' ? 'accepted' : (action === 'reject' ? 'rejected' : 'countered');
                if (action === 'counter') updatedContent.counterPrice = parseFloat(counterPrice);
                if (action === 'accept') updatedContent.finalPrice = negotiation.offered_price;

                await supabase
                    .from('messages')
                    .update({ content: JSON.stringify(updatedContent) })
                    .eq('id', originalMsg.id);

                console.log('[Negotiation Response] Updated original message status');
            } catch (parseError) {
                console.error('[Negotiation Response] Failed to update original message:', parseError);
            }
        } else {
            console.log('[Negotiation Response] Original message not found:', findError);
        }

        res.json({ success: true, action, negotiation: updateData });
    } catch (error: any) {
        console.error('Respond to negotiation error:', error);
        res.status(500).json({ error: 'Failed to respond', message: error.message });
    }
});

// 获取产品的议价历史
router.get('/api/negotiations/product/:productId', requireAuth, async (req: any, res) => {
    try {
        const { productId } = req.params;
        const userId = req.user.id;

        const { data: negotiations, error } = await supabase
            .from('price_negotiations')
            .select('*, conversation:conversations(*)')
            .eq('product_id', productId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 只返回用户参与的议价
        const filtered = negotiations?.filter(n =>
            n.conversation.buyer_id === userId || n.conversation.seller_id === userId
        );

        res.json({ negotiations: filtered || [] });
    } catch (error: any) {
        console.error('Get negotiations error:', error);
        res.status(500).json({ error: 'Failed to get negotiations', message: error.message });
    }
});
