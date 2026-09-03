import type { Conversation, User } from '@/types';
import { avatarFor } from '@/features/auth/authService';

interface PartyInfo {
    id: string;
    name?: string;
    avatar?: string;
}

/** Conversation row as returned by GET /api/users/:id/conversations. */
export interface ApiConversation {
    id: string;
    product_id: string;
    user1_id: string;
    user2_id: string;
    buyer_id?: string;
    seller_id?: string;
    updated_at: string;
    productTitle?: string;
    product_title?: string;
    productImage?: string;
    product_image?: string;
    sellerInfo?: PartyInfo;
    seller_info?: PartyInfo;
    buyerInfo?: PartyInfo;
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

/** Work out who the *other* participant is from the current user's perspective. */
const resolveOtherUser = (c: ApiConversation, currentUserId: string): User => {
    const isBuyer = currentUserId === c.user1_id;
    const sellerInfo = c.sellerInfo || c.seller_info;

    if (isBuyer && sellerInfo) return toUser(sellerInfo);       // buyer sees the seller (from products)
    if (c.buyerInfo) return toUser(c.buyerInfo);                 // seller sees the buyer (from users)

    const otherId = isBuyer ? c.user2_id : c.user1_id;           // last resort
    return toUser({ id: otherId });
};

export const mapApiConversation = (c: ApiConversation, currentUserId: string): Conversation => ({
    id: c.id,
    productId: c.product_id,
    productTitle: c.productTitle || c.product_title || 'Product',
    productImage: c.productImage || c.product_image || '',
    otherUser: resolveOtherUser(c, currentUserId),
    messages: [],
    lastMessageTime: new Date(c.updated_at).getTime(),
    buyerId: c.buyer_id || c.user1_id,
    sellerId: c.seller_id || c.user2_id,
    orderId: c.orderId || undefined,
    orderStatus: c.orderStatus || undefined,
});
