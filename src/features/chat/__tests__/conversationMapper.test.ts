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
        expect(conv.lastMessage).toBeNull();
        expect(conv.unreadCount).toBe(0);
    });

    it('prefers explicit buyer_id / seller_id over the user1/user2 heuristic', () => {
        // The seller opened the conversation, so user1 is actually the seller.
        const row: ApiConversation = { ...base, user1_id: 'seller', user2_id: 'buyer', buyer_id: 'buyer', seller_id: 'seller' };
        const asBuyer = mapApiConversation(row, 'buyer');
        expect(asBuyer.buyerId).toBe('buyer');
        expect(asBuyer.sellerId).toBe('seller');
        expect(asBuyer.otherUser).toMatchObject({ id: 'seller', name: 'Sofía' });

        const asSeller = mapApiConversation(row, 'seller');
        expect(asSeller.otherUser).toMatchObject({ id: 'buyer', name: 'Luis' });
    });

    it('maps last_message and unread_count, using the message time as lastMessageTime', () => {
        const conv = mapApiConversation(
            {
                ...base,
                last_message: {
                    text: 'Is it still available?',
                    sender_id: 'buyer',
                    message_type: 'text',
                    created_at: '2026-02-03T12:30:00Z',
                    is_read: false,
                },
                unread_count: 3,
            },
            'seller'
        );
        expect(conv.lastMessage).toEqual({
            text: 'Is it still available?',
            senderId: 'buyer',
            messageType: 'text',
            createdAt: Date.parse('2026-02-03T12:30:00Z'),
        });
        expect(conv.lastMessageTime).toBe(Date.parse('2026-02-03T12:30:00Z'));
        expect(conv.unreadCount).toBe(3);
    });

    it('defaults message_type to text and tolerates null text / unread_count', () => {
        const conv = mapApiConversation(
            {
                ...base,
                last_message: { text: null, sender_id: 'seller', message_type: null, created_at: '2026-02-01T00:00:00Z' },
                unread_count: null,
            },
            'buyer'
        );
        expect(conv.lastMessage).toMatchObject({ text: '', messageType: 'text', senderId: 'seller' });
        expect(conv.unreadCount).toBe(0);
        // last_message is older than updated_at but is still the preferred timestamp
        expect(conv.lastMessageTime).toBe(Date.parse('2026-02-01T00:00:00Z'));
    });

    it('carries orderId / orderStatus through and drops nulls', () => {
        const conv = mapApiConversation({ ...base, orderId: 'o1', orderStatus: 'paid' }, 'buyer');
        expect(conv.orderId).toBe('o1');
        expect(conv.orderStatus).toBe('paid');
        const none = mapApiConversation({ ...base, orderId: null, orderStatus: null }, 'buyer');
        expect(none.orderId).toBeUndefined();
        expect(none.orderStatus).toBeUndefined();
    });
});
