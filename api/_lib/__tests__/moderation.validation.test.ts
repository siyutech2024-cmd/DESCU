process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key';

// The 400 paths run before any database call; make sure that stays true.
jest.mock('../db/supabase', () => ({
    supabase: { from: jest.fn(() => { throw new Error('DB must not be touched for invalid input'); }) },
}));

import { createReport, blockUser } from '../controllers/moderationController';

const me = '7df5401c-a316-4214-85c9-4e76db8b9ef2';
const other = '0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e';

const run = async (handler: any, body: unknown, params: Record<string, string> = {}) => {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (payload: unknown) => { res.body = payload; return res; };
    await handler({ user: { id: me }, body, params } as any, res);
    return res;
};

describe('POST /api/reports validation', () => {
    it('rejects unknown target types, non-UUID ids and unknown reasons', async () => {
        expect((await run(createReport, { target_type: 'planet', target_id: other, reason: 'scam' })).statusCode).toBe(400);
        expect((await run(createReport, { target_type: 'user', target_id: 'x,or.1=1', reason: 'scam' })).statusCode).toBe(400);
        expect((await run(createReport, { target_type: 'user', target_id: other, reason: 'dislike' })).statusCode).toBe(400);
    });
    it('rejects self-reports and oversized descriptions', async () => {
        expect((await run(createReport, { target_type: 'user', target_id: me, reason: 'scam' })).statusCode).toBe(400);
        expect((await run(createReport, { target_type: 'user', target_id: other, reason: 'scam', description: 'x'.repeat(2001) })).statusCode).toBe(400);
    });
    it('rejects an empty body', async () => {
        expect((await run(createReport, undefined)).statusCode).toBe(400);
    });
});

describe('POST /api/blocks validation', () => {
    it('rejects self-blocks and malformed ids', async () => {
        expect((await run(blockUser, { blocked_id: me })).statusCode).toBe(400);
        expect((await run(blockUser, { blocked_id: 'not-a-uuid' })).statusCode).toBe(400);
        expect((await run(blockUser, {})).statusCode).toBe(400);
    });
});
