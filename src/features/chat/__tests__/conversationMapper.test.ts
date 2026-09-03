jest.mock('@/services/supabase', () => ({ supabase: {} }));
jest.mock('@/services/apiConfig', () => ({ API_BASE_URL: '' }));

import { mapApiConversation, type ApiConversation } from '../conversationMapper';

const base: ApiConversation = {
    id: 'c1',
    product_id: 'p1',
    user1_id: 'buyer',
    user2_id: 'seller',
    updated_at: '2026-02-02T10:00:00Z',
    product_title: 'Lamp',
    sellerInfo: { id: 'seller', name: 'Sofía', avatar: 'sofia.png' },
    buyerInfo: { id: 'buyer', name: 'Luis' },
};

describe('mapApiConversation', () => {
    it('shows the seller to the buyer', () => {
        const conv = mapApiConversation(base, 'buyer');
        expect(conv.otherUser).toMatchObject({ id: 'seller', name: 'Sofía', avatar: 'sofia.png' });
        expect(conv.productTitle).toBe('Lamp');
        expect(conv.lastMessageTime).toBe(Date.parse('2026-02-02T10:00:00Z'));
    });

    it('shows the buyer to the seller', () => {
        const conv = mapApiConversation(base, 'seller');
        expect(conv.otherUser).toMatchObject({ id: 'buyer', name: 'Luis' });
        expect(conv.otherUser.avatar).toContain('seed=buyer');
    });

    it('falls back to the other participant id when no party info is present', () => {
        const conv = mapApiConversation({ ...base, sellerInfo: undefined, buyerInfo: undefined }, 'seller');
        expect(conv.otherUser).toMatchObject({ id: 'buyer', name: 'User' });
        expect(conv.buyerId).toBe('buyer');
        expect(conv.sellerId).toBe('seller');
        expect(conv.orderId).toBeUndefined();
    });
});
