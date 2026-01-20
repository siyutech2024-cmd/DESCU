import { supabase } from '../db/supabase';

/**
 * 订单通知服务
 * 在订单状态变更时自动发送消息到聊天对话
 */

interface OrderNotificationMetadata {
    location?: string;
    time?: string;
    trackingNumber?: string;
    confirmedBy?: 'buyer' | 'seller';
    [key: string]: any;
}

/**
 * 订单事件类型
 */
export type OrderEventType =
    | 'created'              // 订单已创建
    | 'paid'                 // 已支付
    | 'meetup_arranged'      // 已安排见面
    | 'meetup_confirmed'     // 见面已确认
    | 'shipped'              // 已发货
    | 'delivered'            // 已送达
    | 'confirmed'            // 已确认
    | 'completed'            // 交易完成
    | 'cancelled'            // 订单取消
    | 'disputed';            // 发起争议

/**
 * 发送订单状态通知到聊天
 */
export async function notifyOrderStatus(
    orderId: string,
    eventType: OrderEventType,
    metadata?: OrderNotificationMetadata
): Promise<void> {
    try {
        console.log(`[OrderNotification] Sending notification for order ${orderId}, event: ${eventType}`);

        // 1. 获取订单信息
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*, product:products(*)')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            console.error('[OrderNotification] Order not found:', orderError);
            return;
        }

        // 2. 查找或创建对话
        let conversation;
        const { data: existingConv } = await supabase
            .from('conversations')
            .select('*')
            .eq('product_id', order.product_id)
            .eq('buyer_id', order.buyer_id)
            .eq('seller_id', order.seller_id)
            .single();

        if (existingConv) {
            conversation = existingConv;
        } else {
            // 创建新对话
            const { data: newConv, error: convError } = await supabase
                .from('conversations')
                .insert({
                    product_id: order.product_id,
                    buyer_id: order.buyer_id,
                    seller_id: order.seller_id
                })
                .select()
                .single();

            if (convError) {
                console.error('[OrderNotification] Failed to create conversation:', convError);
                return;
            }
            conversation = newConv;
        }

        // 3. 构建消息内容
        const messageContent = buildMessageContent(order, eventType, metadata);

        // 4. 确定置顶时长
        const pinnedDuration = getPinnedDuration(eventType);
        const pinnedUntil = pinnedDuration > 0
            ? new Date(Date.now() + pinnedDuration)
            : null;

        // 5. 插入系统消息
        const { error: messageError } = await supabase.from('messages').insert({
            conversation_id: conversation.id,
            sender_id: 'system', // 系统消息标记
            message_type: 'order_status',
            content: JSON.stringify(messageContent),
            is_pinned: pinnedDuration > 0,
            pinned_until: pinnedUntil,
            metadata: {
                orderId,
                eventType,
                productId: order.product_id
            }
        });

        if (messageError) {
            console.error('[OrderNotification] Failed to send message:', messageError);
            return;
        }

        console.log(`[OrderNotification] Notification sent successfully for order ${orderId}`);

    } catch (error) {
        console.error('[OrderNotification] Error sending notification:', error);
    }
}

/**
 * 构建消息内容
 */
function buildMessageContent(
    order: any,
    eventType: OrderEventType,
    metadata?: OrderNotificationMetadata
): any {
    const baseContent = {
        orderId: order.id,
        eventType,
        productTitle: order.product?.title || '商品',
        productImage: order.product?.images?.[0] || null,
        amount: order.total_amount,
        currency: order.currency,
        orderType: order.order_type,
        paymentMethod: order.payment_method
    };

    // 根据事件类型添加特定信息
    switch (eventType) {
        case 'created':
            return {
                ...baseContent,
                message: '订单已创建',
                description: `${order.order_type === 'meetup' ? '当面交易' : '邮寄交易'} • ${order.payment_method === 'cash' ? '现金支付' : '在线支付'}`,
                expiresAt: order.expires_at
            };

        case 'paid':
            return {
                ...baseContent,
                message: '买家已支付',
                description: `已支付 $${order.total_amount} ${order.currency}`,
                paidAt: new Date().toISOString()
            };

        case 'meetup_arranged':
            return {
                ...baseContent,
                message: '已安排见面时间',
                description: `地点: ${metadata?.location || '待定'}\n时间: ${metadata?.time || '待定'}`,
                location: metadata?.location,
                time: metadata?.time
            };

        case 'shipped':
            return {
                ...baseContent,
                message: '卖家已发货',
                description: metadata?.trackingNumber
                    ? `快递单号: ${metadata.trackingNumber}`
                    : '商品已寄出，请留意物流信息',
                trackingNumber: metadata?.trackingNumber,
                shippedAt: new Date().toISOString()
            };

        case 'delivered':
            return {
                ...baseContent,
                message: '商品已送达',
                description: '请确认收货无误后，点击"确认交易"',
                deliveredAt: new Date().toISOString()
            };

        case 'confirmed':
            const confirmedBy = metadata?.confirmedBy || 'user';
            return {
                ...baseContent,
                message: confirmedBy === 'buyer' ? '买家已确认' : '卖家已确认',
                description: confirmedBy === 'buyer'
                    ? '买家确认收到商品，等待卖家确认'
                    : '卖家确认交易完成，等待买家确认',
                confirmedBy,
                confirmedAt: new Date().toISOString()
            };

        case 'completed':
            return {
                ...baseContent,
                message: '🎉 交易完成',
                description: '双方已确认，交易顺利完成！',
                completedAt: new Date().toISOString()
            };

        case 'cancelled':
            return {
                ...baseContent,
                message: '订单已取消',
                description: metadata?.reason || '订单已被取消',
                cancelledAt: new Date().toISOString()
            };

        case 'disputed':
            return {
                ...baseContent,
                message: '⚠️ 发起争议',
                description: '交易出现问题，已提交平台处理',
                disputedAt: new Date().toISOString()
            };

        default:
            return {
                ...baseContent,
                message: '订单状态更新',
                description: '订单信息已更新'
            };
    }
}

/**
 * 获取置顶时长（毫秒）
 */
function getPinnedDuration(eventType: OrderEventType): number {
    const HOUR = 60 * 60 * 1000;
    const DAY = 24 * HOUR;

    switch (eventType) {
        case 'created':
            return 48 * HOUR; // 创建订单置顶48小时

        case 'paid':
            return 24 * HOUR; // 支付成功置顶24小时

        case 'meetup_arranged':
            return 72 * HOUR; // 见面安排置顶72小时（很重要）

        case 'shipped':
            return 48 * HOUR; // 发货通知置顶48小时

        case 'delivered':
            return 24 * HOUR; // 送达通知置顶24小时

        case 'confirmed':
            return 12 * HOUR; // 确认通知置顶12小时

        case 'completed':
            return 24 * HOUR; // 完成通知置顶24小时

        case 'cancelled':
        case 'disputed':
            return 48 * HOUR; // 问题订单置顶48小时

        default:
            return 12 * HOUR; // 默认12小时
    }
}

/**
 * 批量发送通知（用于迁移旧订单）
 */
export async function batchNotifyExistingOrders(): Promise<void> {
    console.log('[OrderNotification] Starting batch notification for existing orders');

    const { data: orders } = await supabase
        .from('orders')
        .select('id, status')
        .in('status', ['paid', 'shipped', 'completed'])
        .limit(100);

    if (!orders || orders.length === 0) {
        console.log('[OrderNotification] No orders to notify');
        return;
    }

    for (const order of orders) {
        try {
            let eventType: OrderEventType = 'created';

            switch (order.status) {
                case 'paid':
                    eventType = 'paid';
                    break;
                case 'shipped':
                    eventType = 'shipped';
                    break;
                case 'completed':
                    eventType = 'completed';
                    break;
            }

            await notifyOrderStatus(order.id, eventType);
            // 延迟避免过载
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.error(`[OrderNotification] Failed to notify order ${order.id}:`, error);
        }
    }

    console.log('[OrderNotification] Batch notification completed');
}
