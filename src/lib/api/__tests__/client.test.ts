/**
 * @jest-environment node
 */
const getSessionMock = jest.fn();

jest.mock('@/services/supabase', () => ({
    supabase: { auth: { getSession: () => getSessionMock() } },
}));
jest.mock('@/services/apiConfig', () => ({ API_BASE_URL: 'https://api.test' }));

import { api, apiFetch, ApiError } from '../client';

const jsonResponse = (status: number, body: unknown) =>
    ({ ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) }) as Response;

describe('apiFetch', () => {
    const fetchMock = jest.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        getSessionMock.mockReset();
        (global as any).fetch = fetchMock;
    });

    it('prefixes the base URL, serialises params and parses JSON', async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
        const result = await api.get<{ ok: boolean }>('/api/products', { params: { lang: 'es', limit: 20, offset: 0, seller_id: undefined, q: '' } });

        expect(result).toEqual({ ok: true });
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api.test/api/products?lang=es&limit=20&offset=0');
        expect(init.method).toBe('GET');
        expect(init.headers.Authorization).toBeUndefined();
    });

    it('sends JSON bodies with a content-type header', async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, { id: '1' }));
        await api.post('/api/messages', { text: 'hi' });
        const [, init] = fetchMock.mock.calls[0];
        expect(init.body).toBe(JSON.stringify({ text: 'hi' }));
        expect(init.headers['Content-Type']).toBe('application/json');
    });

    it('attaches the bearer token when auth is required', async () => {
        getSessionMock.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
        fetchMock.mockResolvedValue(jsonResponse(200, {}));
        await api.get('/api/orders', { auth: 'required' });
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    });

    it('throws ApiError(401) when auth is required but no session exists', async () => {
        getSessionMock.mockResolvedValue({ data: { session: null } });
        await expect(api.get('/api/orders', { auth: 'required' })).rejects.toMatchObject({ name: 'ApiError', status: 401 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('proceeds anonymously when auth is optional and signed out', async () => {
        getSessionMock.mockResolvedValue({ data: { session: null } });
        fetchMock.mockResolvedValue(jsonResponse(200, {}));
        await api.get('/api/orders', { auth: 'optional' });
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
    });

    it('surfaces server error messages via ApiError', async () => {
        fetchMock.mockResolvedValue(jsonResponse(400, { error: 'CLABE must be 18 digits' }));
        const err = (await apiFetch('/api/users/bank-info', { method: 'POST', body: {} }).catch(e => e)) as ApiError;
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(400);
        expect(err.message).toBe('CLABE must be 18 digits');
        expect(err.body).toEqual({ error: 'CLABE must be 18 digits' });
    });

    it('falls back to a generic message for non-JSON error bodies', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 502, text: async () => '<html>Bad Gateway</html>' } as Response);
        const err = (await api.get('/api/x').catch(e => e)) as ApiError;
        expect(err.message).toBe('Request failed with status 502');
        expect(err.body).toBe('<html>Bad Gateway</html>');
    });

    it('returns undefined for empty 2xx responses', async () => {
        fetchMock.mockResolvedValue(jsonResponse(204, undefined));
        await expect(api.delete('/api/users/addresses/1')).resolves.toBeUndefined();
    });
});
