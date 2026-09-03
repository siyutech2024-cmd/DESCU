process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key';

const getUserMock = jest.fn();
jest.mock('../db/supabase', () => ({
    supabase: { auth: { getUser: (token: string) => getUserMock(token) } },
    getSupabase: () => ({ auth: { getUser: (token: string) => getUserMock(token) } }),
}));

import { requireAdmin } from '../middleware/adminAuth';

const run = async (user: any) => {
    getUserMock.mockResolvedValue({ data: { user }, error: null });
    const req: any = { headers: { authorization: 'Bearer t' } };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    await requireAdmin(req, res, next);
    return { req, res, next };
};

describe('requireAdmin', () => {
    it('rejects a role that only lives in user_metadata (self-editable)', async () => {
        const { res, next } = await run({ id: 'u1', email: 'x@y.z', user_metadata: { role: 'super_admin' }, app_metadata: {} });
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });
    it('accepts a role set in app_metadata', async () => {
        const { req, next } = await run({ id: 'u1', email: 'x@y.z', user_metadata: {}, app_metadata: { role: 'admin', permissions: ['products.write'] } });
        expect(next).toHaveBeenCalled();
        expect(req.admin).toEqual({ id: 'u1', email: 'x@y.z', role: 'admin', permissions: ['products.write'] });
    });
    it('rejects missing tokens', async () => {
        const req: any = { headers: {} };
        const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
        const next = jest.fn();
        await requireAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });
});
