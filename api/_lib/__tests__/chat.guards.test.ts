process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key';

import { isUuid, isParticipant } from '../controllers/chatController';

describe('chat guards', () => {
    it('accepts only well-formed UUIDs (blocks PostgREST filter injection)', () => {
        expect(isUuid('7df5401c-a316-4214-85c9-4e76db8b9ef2')).toBe(true);
        expect(isUuid('7DF5401C-A316-4214-85C9-4E76DB8B9EF2')).toBe(true);
        expect(isUuid('x,user1_id.not.is.null')).toBe(false);
        expect(isUuid('7df5401c-a316-4214-85c9-4e76db8b9ef2,user2_id.eq.abc')).toBe(false);
        expect(isUuid(undefined)).toBe(false);
        expect(isUuid(42)).toBe(false);
    });
    it('identifies participants by either seat', () => {
        const conv = { user1_id: 'a', user2_id: 'b' };
        expect(isParticipant(conv, 'a')).toBe(true);
        expect(isParticipant(conv, 'b')).toBe(true);
        expect(isParticipant(conv, 'c')).toBe(false);
    });
});
