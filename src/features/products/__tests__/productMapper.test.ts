jest.mock('@/services/supabase', () => ({ supabase: {} }));
jest.mock('@/services/apiConfig', () => ({ API_BASE_URL: '' }));

import { mapApiProduct, type ApiProduct } from '../productMapper';

const row: ApiProduct = {
    id: 'p1',
    seller_id: 's1',
    seller_name: 'Ana',
    title: 'Bike',
    description: 'Red bike',
    price: 1500,
    currency: 'MXN',
    images: ['a.jpg'],
    category: 'Sports',
    delivery_type: 'meetup',
    latitude: 19.43,
    longitude: -99.13,
    created_at: '2026-01-01T00:00:00Z',
    is_promoted: true,
    status: 'active',
};

describe('mapApiProduct', () => {
    it('maps snake_case rows to the app Product shape', () => {
        const product = mapApiProduct(row, { latitude: 19.43, longitude: -99.13 });
        expect(product.id).toBe('p1');
        expect(product.seller).toMatchObject({ id: 's1', name: 'Ana', isVerified: false });
        expect(product.seller.avatar).toContain('seed=s1');
        expect(product.deliveryType).toBe('meetup');
        expect(product.isPromoted).toBe(true);
        expect(product.createdAt).toBe(Date.parse('2026-01-01T00:00:00Z'));
        expect(product.distance).toBeCloseTo(0, 5);
    });

    it('falls back to the origin coordinates when the row has none', () => {
        const product = mapApiProduct({ ...row, latitude: undefined, longitude: undefined }, { latitude: 1, longitude: 2 });
        expect(product.location).toEqual({ latitude: 1, longitude: 2 });
    });

    it('leaves distance undefined without an origin', () => {
        expect(mapApiProduct(row, null).distance).toBeUndefined();
        expect(mapApiProduct({ ...row, images: undefined, location_name: undefined }, null)).toMatchObject({ images: [], locationName: 'Unknown' });
    });
});
