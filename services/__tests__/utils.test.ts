import { calculateDistance } from '../utils';

describe('calculateDistance', () => {
    it('calculates distance between Beijing and Shanghai (~1069km)', () => {
        const beijing = { latitude: 39.9042, longitude: 116.4074 };
        const shanghai = { latitude: 31.2304, longitude: 121.4737 };
        const distance = calculateDistance(beijing, shanghai);
        // Allow small tolerance
        expect(distance).toBeGreaterThanOrEqual(1060);
        expect(distance).toBeLessThanOrEqual(1080);
    });

    it('returns 0 for same coordinates', () => {
        const point = { latitude: 0, longitude: 0 };
        expect(calculateDistance(point, point)).toBe(0);
    });
});
