import type { Conversation, ConversationLastMessage, User } from '@/types';
import { avatarFor } from '@/features/auth/authService';

interface PartyInfo {
    id: string;
    name?: string;
    avatar?: string;
}

/** `last_message` as returned by GET /api/users/:id/conversations. */
export interface ApiLastMessage {
    text: string | null;
    sender_id: string;
    message_type?: string | null;
    created_at: string;
    is_read?: boolean;
}

/** Conversation row as returned by GET /api/users/:id/conversations. */
export interface ApiConversation {
    id: string;
    product_id: string;
    user1_id: string;
    user2_id: string;
    buyer_id?: string | null;
    seller_id?: string | null;
    updated_at: string;
    productTitle?: string;
    product_title?: string;
    productImage?: string;
    product_image?: string;
    sellerInfo?: PartyInfo;
    seller_info?: PartyInfo;
    buyerInfo?: PartyInfo;
    last_message?: ApiLastMessage | null;
    unread_count?: number | null;
    orderId?: string | null;
    orderStatus?: string | null;
}

const toUser = (info: PartyInfo, fallbackName = 'User'): User => ({
    id: info.id,
    name: info.name || fallbackName,
    email: '',
    avatar: info.avatar || avatarFor(info.id),
    isVerified: false,
});

const parseTime = (iso: string | null | undefined): number | null => {
    if (!iso) return null;
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) ? null : ms;
};

const mapLastMessage = (m: ApiLastMessage | null | undefined): ConversationLastMessage | null => {
    if (!m) return null;
    return {
        text: m.text ?? '',
        senderId: m.sender_id,
        messageType: m.message_type || 'text',
        createdAt: parseTime(m.created_at) ?? 0,
    };
};

/** Work out who the *other* participant is from the current user's perspective. */
const resolveOtherUser = (c: ApiConversation, currentUserId: string, buyerId: string, sellerId: string): User => {
    const isBuyer = currentUserId === buyerId;
    const sellerInfo = c.sellerInfo || c.seller_info;

    if (isBuyer && sellerInfo) return toUser(sellerInfo);       // buyer sees the seller (from products)
    if (!isBuyer && c.buyerInfo) return toUser(c.buyerInfo);     // seller sees the buyer (from users)

    // last resort: whichever participant is not the current user
    const otherId = c.user1_id === currentUserId ? c.user2_id : c.user1_id;
    return toUser({ id: otherId });
};

export const mapApiConversation = (c: ApiConversation, currentUserId: string): Conversation => {
    // Prefer the explicit buyer/seller ids; fall back to the historical user1=buyer / user2=seller convention.
    const buyerId = c.buyer_id || c.user1_id;
    const sellerId = c.seller_id || c.user2_id;
    const lastMessage = mapLastMessage(c.last_message);

    return {
        id: c.id,
        productId: c.product_id,
        productTitle: c.productTitle || c.product_title || 'Product',
        productImage: c.productImage || c.product_image || '',
        otherUser: resolveOtherUser(c, currentUserId, buyerId, sellerId),
        messages: [],
        lastMessage,
        lastMessageTime: (lastMessage && lastMessage.createdAt) || parseTime(c.updated_at) || 0,
        unreadCount: Math.max(0, Number(c.unread_count) || 0),
        buyerId,
        sellerId,
        orderId: c.orderId || undefined,
        orderStatus: c.orderStatus || undefined,
    };
};
