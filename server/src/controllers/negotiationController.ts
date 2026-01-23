import { Request, Response } from 'express';
import { supabase } from '../db/supabase';
import { t } from '../utils/i18n';

/**
 * 发起议价请求
 * POST /api/negotiations/propose
 */
export const proposePrice = async (req: Request, res: Response) => {
    try {
        const { conversationId, productId, proposedPrice } = req.body;
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ message: t(req, 'PLEASE_LOGIN') });
        }

        if (!conversationId || !productId || proposedPrice === undefined) {
            return res.status(400).json({ message: t(req, 'MISSING_FIELDS') });
        }

        // 获取产品信息
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('title, price, seller_id, images')
            .eq('id', productId)
            .single();

        if (productError || !product) {
            console.error('Product not found:', productError);
            return res.status(404).json({ message: t(req, 'PRODUCT_NOT_FOUND') });
        }

        // 验证用户不是卖家（买家才能议价）
        if (product.seller_id === userId) {
            return res.status(400).json({ message: t(req, 'CANNOT_OFFER_OWN_PRODUCT') });
        }

        // 创建议价消息内容
        const negotiationContent = {
            productId,
            productTitle: product.title,
            productImage: product.images?.[0] || null,
            originalPrice: product.price,
            proposedPrice: parseFloat(proposedPrice),
            proposerId: userId,
            sellerId: product.seller_id,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // 插入议价消息
        const { data: message, error: messageError } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_id: userId,
                text: `💰 议价请求: $${proposedPrice} (原价 $${product.price})`,
                message_type: 'price_negotiation',
                content: JSON.stringify(negotiationContent)
            })
            .select()
            .single();

        if (messageError) {
            console.error('Error creating negotiation message:', messageError);
            return res.status(500).json({ message: messageError.message });
        }

        console.log('[Negotiation] Price proposal created:', message.id);
        res.json({ success: true, message, negotiation: negotiationContent });
    } catch (error: any) {
        console.error('Propose price error:', error);
        res.status(500).json({ message: error.message || t(req, 'SERVER_ERROR') });
    }
};

/**
 * 响应议价请求（接受/拒绝/还价）
 * POST /api/negotiations/respond
 */
export const respondToNegotiation = async (req: Request, res: Response) => {
    try {
        const { messageId, response, counterPrice } = req.body;
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ message: '未登录 / No has iniciado sesión' });
        }

        if (!messageId || !response) {
            return res.status(400).json({ message: '缺少必要参数 / Faltan parámetros' });
        }

        // 验证响应类型
        if (!['accepted', 'rejected', 'counter'].includes(response)) {
            return res.status(400).json({ message: t(req, 'INVALID_RESPONSE_TYPE') });
        }

        // 获取原议价消息
        const { data: origMessage, error: fetchError } = await supabase
            .from('messages')
            .select('*')
            .eq('id', messageId)
            .single();

        if (fetchError || !origMessage) {
            console.error('Original message not found:', fetchError);
            return res.status(404).json({ message: t(req, 'MESSAGE_NOT_FOUND') });
        }

        // 解析原议价内容
        let origContent;
        try {
            origContent = JSON.parse(origMessage.content);
        } catch {
            return res.status(400).json({ message: t(req, 'INVALID_NEGOTIATION_FORMAT') });
        }

        // 验证只有卖家可以响应
        if (origContent.sellerId !== userId) {
            return res.status(403).json({ message: t(req, 'ONLY_SELLER_CAN_RESPOND') });
        }

        // 更新议价状态
        origContent.status = response;
        origContent.respondedAt = new Date().toISOString();
        origContent.responderId = userId;

        if (response === 'counter' && counterPrice) {
            origContent.counterPrice = parseFloat(counterPrice);
        }

        // 更新原消息
        const { error: updateError } = await supabase
            .from('messages')
            .update({ content: JSON.stringify(origContent) })
            .eq('id', messageId);

        if (updateError) {
            console.error('Error updating negotiation:', updateError);
            return res.status(500).json({ message: updateError.message });
        }

        // 创建响应消息
        let responseText = '';
        if (response === 'accepted') {
            responseText = `✅ 议价已接受: $${origContent.proposedPrice}`;
        } else if (response === 'rejected') {
            responseText = `❌ 议价已拒绝`;
        } else if (response === 'counter') {
            responseText = `💰 还价: $${counterPrice}`;
        }

        const { data: responseMessage, error: responseError } = await supabase
            .from('messages')
            .insert({
                conversation_id: origMessage.conversation_id,
                sender_id: userId,
                text: responseText,
                message_type: 'price_negotiation_response',
                content: JSON.stringify({
                    ...origContent,
                    responseType: response
                })
            })
            .select()
            .single();

        if (responseError) {
            console.error('Error creating response message:', responseError);
            return res.status(500).json({ message: responseError.message });
        }

        console.log('[Negotiation] Response created:', responseMessage.id, 'Type:', response);
        res.json({ success: true, message: responseMessage, updatedNegotiation: origContent });
    } catch (error: any) {
        console.error('Respond to negotiation error:', error);
        res.status(500).json({ message: error.message || '服务器错误' });
    }
};
