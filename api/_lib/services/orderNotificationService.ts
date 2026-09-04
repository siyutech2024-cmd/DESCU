import { supabase } from '../db/supabase.js';

/**
 * 订单状态变化时发送聊天通知
 * 确保买卖双方都能在聊天中看到交易进程
 */

// 订单状态消息模板
const ORDER_STATUS_MESSAGES: { [key: string]: { buyer: string; seller: string } } = {
    created: {
        buyer: '📦 您已下单！等待卖家确认...',
        seller: '📦 新订单！买家正在等待您的确认'
    },
    paid: {
        buyer: '💰 付款成功！等待卖家发货/确认见面',
        seller: '💰 买家已付款！请尽快发货或确认见面时间'
    },
    escrow_held: {
        buyer: '💰 付款成功！资金已进入担保，等待卖家发货/确认见面',
        seller: '💰 买家已付款（担保中）！请尽快发货或确认见面时间'
    },
    shipped: {
        buyer: '🚚 卖家已发货！请注意查收',
        seller: '🚚 您已发货！等待买家确认收货'
    },
    meetup_arranged: {
        buyer: '📍 见面地点和时间已安排！请确认详情',
        seller: '📍 见面信息已更新！等待买家确认'
    },
    meetup_confirmed: {
        buyer: '✅ 见面时间已确认！请按时到达',
        seller: '✅ 见面时间已确认！请按时到达'
    },
    buyer_confirmed: {
        buyer: '✅ 您已确认交易完成',
        seller: '✅ 买家已确认交易！等待您确认以完成订单'
    },
    seller_confirmed: {
        buyer: '✅ 卖家已确认！等待您确认以完成订单',
        seller: '✅ 您已确认交易完成'
    },
    completed: {
        buyer: '🎉 交易完成！感谢您的购买',
        seller: '🎉 交易完成！款项将在确认后到账'
    },
    cancelled: {
        buyer: '❌ 订单已取消',
        seller: '❌ 订单已取消'
    },
    disputed: {
        buyer: '⚠️ 订单存在争议，客服将介入处理',
        seller: '⚠️ 订单存在争议，客服将介入处理'
    }
};

/**
 * 发送订单状态通知到聊天
 */
export async function notifyOrderStatus(orderId: string, status: string, extraData?: any) {
    try {
        console.log(`[OrderNotification] Sending notification for order ${orderId}, status: ${status}`);

        // 获取订单详情
        // No users embed: orders.buyer_id/seller_id point at auth.users, which PostgREST cannot join to public.users.
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*, product:products(id, title, images)')
            .eq('id', orderId)
            .maybeSingle();

        if (orderError || !order) {
            console.error('[OrderNotification] Order not found:', orderError);
            return;
        }

        // 获取或创建对话
        let conversationId: string;

        // conversations rows are keyed by user1_id/user2_id (either seat may be the buyer)
        const { data: existingConv } = await supabase
            .from('conversations')
            .select('id')
            .eq('product_id', order.product_id)
            .or(`and(user1_id.eq.${order.buyer_id},user2_id.eq.${order.seller_id}),and(user1_id.eq.${order.seller_id},user2_id.eq.${order.buyer_id})`)
            .limit(1)
            .maybeSingle();

        if (existingConv) {
            conversationId = existingConv.id;
        } else {
            // 创建新对话（买家为 user1，卖家为 user2）
            const { data: newConv, error: convError } = await supabase
                .from('conversations')
                .insert({
                    product_id: order.product_id,
                    user1_id: order.buyer_id,
                    user2_id: order.seller_id
                })
                .select('id')
                .single();

            if (convError || !newConv) {
                console.error('[OrderNotification] Failed to create conversation:', convError);
                return;
            }
            conversationId = newConv.id;
        }

        // 获取状态消息（仅用于聊天列表预览文本；卡片本身由前端按 eventType 本地化）
        const messages = ORDER_STATUS_MESSAGES[status];
        if (!messages) {
            console.warn(`[OrderNotification] No message template for status: ${status}`);
            return;
        }

        // 创建订单状态卡片消息内容 —— 字段与前端 OrderStatusMessage 一致，不含任何语言文案
        const cardContent = {
            type: 'order_status',
            orderId: order.id,
            eventType: status,
            status,
            productId: order.product_id,
            productTitle: order.product?.title || '',
            productImage: order.product?.images?.[0] ?? null,
            amount: order.total_amount,
            totalAmount: order.total_amount,
            currency: order.currency || 'MXN',
            orderType: order.order_type,
            paymentMethod: order.payment_method,
            buyerId: order.buyer_id,
            sellerId: order.seller_id,
            timestamp: new Date().toISOString(),
            ...extraData
        };

        // 发送系统消息到聊天
        const { error: msgError } = await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_id: order.buyer_id, // 使用买家ID作为发送者（系统消息）
            text: `📋 ${messages.buyer}`,
            message_type: 'order_status',
            content: JSON.stringify(cardContent),
            is_read: false
        });

        await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

        if (msgError) {
            console.error('[OrderNotification] Failed to send message:', msgError);
            return;
        }

        console.log(`[OrderNotification] Successfully sent notification for order ${orderId}`);
    } catch (error) {
        console.error('[OrderNotification] Error:', error);
    }
}

/**
 * 发送议价通知
 */
export async function notifyNegotiation(conversationId: string, type: 'proposed' | 'accepted' | 'rejected' | 'countered', data: any) {
    try {
        const messages = {
            proposed: `💰 买家出价 $${data.proposedPrice}，等待您的回复`,
            accepted: `✅ 卖家接受了您的出价 $${data.finalPrice}！`,
            rejected: `❌ 卖家拒绝了您的出价`,
            countered: `🔄 卖家还价 $${data.counterPrice}`
        };

        const { error } = await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_id: data.senderId,
            text: messages[type],
            message_type: 'price_negotiation',
            content: JSON.stringify(data),
            is_read: false
        });

        if (error) {
            console.error('[NegotiationNotification] Failed:', error);
        }
    } catch (error) {
        console.error('[NegotiationNotification] Error:', error);
    }
}
