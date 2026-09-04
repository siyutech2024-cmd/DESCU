import { supabase } from '../db/supabase.js';
import { asyncHandler, badRequest, forbidden, notFound, parseBody, parseParams } from '../lib/http.js';
import type { AuthenticatedRequest } from '../middleware/userAuth.js';
import { isParticipant } from './chatController.js';
import {
    NegotiationIdParamSchema,
    ProductIdParamSchema,
    ProposeNegotiationSchema,
    RespondNegotiationSchema,
    type NegotiationAction,
} from '../schemas/negotiations.js';

/**
 * Price negotiation handlers: the buyer proposes inside a conversation, the seller
 * accepts / rejects / counters. Every guard here is authorization-relevant — the caller
 * must be a participant, the product must belong to the conversation, only the
 * non-seller participant may propose, only the recorded seller may respond.
 */

const PROPOSAL_PIN_MS = 48 * 60 * 60 * 1000;
/** Offers under 30% of the asking price are refused outright. */
const MIN_OFFER_RATIO = 0.3;
const RESPONSE_PIN_MS = 24 * 60 * 60 * 1000;

const NEGOTIATION_STATUS: Record<NegotiationAction, 'accepted' | 'rejected' | 'countered'> = {
    accept: 'accepted',
    reject: 'rejected',
    counter: 'countered',
};

export const proposeNegotiation = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { conversationId, productId, proposedPrice: offeredPrice } = parseBody(ProposeNegotiationSchema, req.body);
    const userId = req.user!.id;

    const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('id, product_id, user1_id, user2_id')
        .eq('id', conversationId)
        .maybeSingle();
    if (convError) throw convError;
    if (!conversation) throw notFound('Conversation not found');

    // Caller must be in the conversation, and the conversation must be about this product.
    if (!isParticipant(conversation, userId)) throw forbidden('Not a participant of this conversation');
    if (conversation.product_id !== productId) throw badRequest('Conversation does not belong to this product');

    const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, seller_id, price, title, status')
        .eq('id', productId)
        .maybeSingle();
    if (productError) throw productError;
    if (!product) throw notFound('Product not found');
    if (product.status !== 'active') throw badRequest('Product is not available');
    // Lowball floor: below this the seller would only ever decline (the client shows the same limit).
    const minOffer = Math.ceil(Number(product.price) * MIN_OFFER_RATIO);
    if (Number(product.price) > 0 && offeredPrice < minOffer) throw badRequest(`Offer too low: minimum ${minOffer}`);
    if (offeredPrice >= Number(product.price)) throw badRequest('Offer must be below the asking price');

    // The seller must be one side of the conversation; the other side is the buyer.
    const sellerId: string = product.seller_id;
    if (!isParticipant(conversation, sellerId)) throw badRequest('Conversation does not include the product seller');
    const buyerId = conversation.user1_id === sellerId ? conversation.user2_id : conversation.user1_id;

    // Only the buyer may open a negotiation.
    if (buyerId !== userId) throw forbidden('Only the buyer can propose a price');

    const { data: negotiation, error: negError } = await supabase
        .from('price_negotiations')
        .insert({
            conversation_id: conversationId,
            product_id: productId,
            buyer_id: buyerId,
            seller_id: sellerId,
            original_price: product.price,
            offered_price: offeredPrice,
            proposed_by: userId,
            status: 'pending',
        })
        .select()
        .single();
    if (negError) throw negError;

    // Pinned negotiation card in the chat; a failure here must not undo the negotiation itself.
    const { error: messageError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userId,
        text: `💰 ${offeredPrice} (${product.price})`,
        message_type: 'price_negotiation',
        content: JSON.stringify({
            negotiationId: negotiation.id,
            originalPrice: product.price,
            proposedPrice: offeredPrice,
            productTitle: product.title,
            status: 'pending',
        }),
        is_pinned: true,
        pinned_until: new Date(Date.now() + PROPOSAL_PIN_MS),
    });
    if (messageError) console.error(`[Negotiation] Failed to insert proposal message for ${negotiation.id}:`, messageError);

    res.json({ negotiation });
});

export const respondToNegotiation = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { id } = parseParams(NegotiationIdParamSchema, req.params);
    const { action, counterPrice } = parseBody(RespondNegotiationSchema, req.body);
    const userId = req.user!.id;

    const { data: negotiation, error: negError } = await supabase
        .from('price_negotiations')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (negError) throw negError;
    if (!negotiation) throw notFound('Negotiation not found');

    // Only the recorded seller may respond, and only once.
    if (negotiation.seller_id !== userId) throw forbidden('Only seller can respond');
    if (negotiation.status !== 'pending') throw badRequest('Negotiation already processed');

    const { data: product } = await supabase
        .from('products')
        .select('title')
        .eq('id', negotiation.product_id)
        .maybeSingle();

    const now = new Date().toISOString();
    const status = NEGOTIATION_STATUS[action];
    const updateData: Record<string, unknown> = { responded_at: now, updated_at: now, status };
    const messageContent: Record<string, unknown> = {
        negotiationId: id,
        originalPrice: negotiation.original_price,
        proposedPrice: negotiation.offered_price,
        productTitle: product?.title || 'Unknown Product',
        status,
    };

    let responseText: string;
    switch (action) {
        case 'accept': {
            messageContent.finalPrice = negotiation.offered_price;
            responseText = `✅ 卖家已接受议价 $${negotiation.offered_price}`;
            // The agreed price becomes the listing price.
            const { error: priceError } = await supabase
                .from('products')
                .update({ price: negotiation.offered_price })
                .eq('id', negotiation.product_id);
            if (priceError) throw priceError;
            break;
        }
        case 'reject':
            responseText = '❌ 卖家拒绝了议价';
            break;
        case 'counter':
            // Schema guarantees counterPrice is present for `counter`.
            updateData.counter_price = counterPrice;
            messageContent.counterPrice = counterPrice;
            responseText = `💬 卖家还价 $${counterPrice}`;
            break;
    }

    const { error: updateError } = await supabase
        .from('price_negotiations')
        .update(updateData)
        .eq('id', id);
    if (updateError) throw updateError;

    const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: negotiation.conversation_id,
        sender_id: userId,
        text: responseText,
        message_type: 'price_negotiation_response',
        content: JSON.stringify(messageContent),
        is_pinned: true,
        pinned_until: new Date(Date.now() + RESPONSE_PIN_MS),
    });
    if (msgError) console.error(`[Negotiation] Failed to insert response message for ${id}:`, msgError);

    // Flip the status on the original proposal card so the buyer's chat reflects the outcome.
    const { data: originalMsg } = await supabase
        .from('messages')
        .select('id, content')
        .eq('conversation_id', negotiation.conversation_id)
        .eq('message_type', 'price_negotiation')
        .ilike('content', `%${id}%`)
        .maybeSingle();

    if (originalMsg) {
        try {
            const updatedContent = JSON.parse(originalMsg.content);
            updatedContent.status = status;
            if (action === 'counter') updatedContent.counterPrice = counterPrice;
            if (action === 'accept') updatedContent.finalPrice = negotiation.offered_price;

            await supabase
                .from('messages')
                .update({ content: JSON.stringify(updatedContent) })
                .eq('id', originalMsg.id);
        } catch (parseError) {
            console.error(`[Negotiation] Failed to update original proposal message for ${id}:`, parseError);
        }
    }

    res.json({ success: true, action, negotiation: updateData });
});

/** Negotiation history for a product, restricted to conversations the caller participates in. */
export const getProductNegotiations = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { productId } = parseParams(ProductIdParamSchema, req.params);
    const userId = req.user!.id;

    const { data: negotiations, error } = await supabase
        .from('price_negotiations')
        .select('*, conversation:conversations(*)')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
    if (error) throw error;

    const filtered = (negotiations || []).filter(n => n.conversation && isParticipant(n.conversation, userId));

    res.json({ negotiations: filtered });
});
