import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

/**
 * HTTP plumbing shared by every route.
 *
 *   router.post('/api/things', requireAuth, asyncHandler(async (req, res) => {
 *       const body = parseBody(CreateThingSchema, req.body);   // 400 on failure
 *       const thing = await service.create(body);
 *       if (!thing) throw new HttpError(404, 'Thing not found');
 *       res.json({ thing });
 *   }));
 *
 * Every error — thrown HttpError, ZodError, Supabase/Stripe error, plain bug — ends up in
 * `errorMiddleware`, which answers with ONE shape: `{ error: string, details?: unknown }`.
 * The 500 branch never leaks internals to the client (they go to the log).
 */

export class HttpError extends Error {
    constructor(public readonly status: number, message: string, public readonly details?: unknown) {
        super(message);
        this.name = 'HttpError';
    }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const unauthorized = (message = 'Unauthorized') => new HttpError(401, message);
export const forbidden = (message = 'Forbidden') => new HttpError(403, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

/** Wrap an async handler so rejections reach the error middleware instead of hanging the request. */
export const asyncHandler = <Req extends Request = Request>(
    fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown> | unknown,
): RequestHandler =>
    (req, res, next) => {
        Promise.resolve(fn(req as Req, res, next)).catch(next);
    };

/** Validate with zod; throws a 400 HttpError carrying the flattened issues. */
export const parseBody = <S extends ZodTypeAny>(schema: S, body: unknown): z.infer<S> => {
    const result = schema.safeParse(body ?? {});
    if (!result.success) throw badRequest('Validation failed', formatIssues(result.error));
    return result.data;
};

export const parseQuery = parseBody;
export const parseParams = parseBody;

export const formatIssues = (error: ZodError) =>
    error.issues.map(i => ({ path: i.path.join('.'), message: i.message }));

/** Postgres/PostgREST error codes we translate for the client. */
const PG_INVALID_TEXT = '22P02';       // e.g. a non-UUID id in a uuid column
const PG_UNIQUE_VIOLATION = '23505';
const PG_CHECK_VIOLATION = '23514';
const PGRST_NO_ROWS = 'PGRST116';      // .single() found no row

export const errorMiddleware = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;

    if (err instanceof HttpError) {
        const payload: Record<string, unknown> = { error: err.message };
        if (err.details !== undefined) payload.details = err.details;
        return res.status(err.status).json(payload);
    }
    if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: formatIssues(err) });
    }

    const e = err as { code?: string; message?: string; statusCode?: number; type?: string } | null;
    if (e && typeof e === 'object') {
        if (e.code === PG_INVALID_TEXT || e.code === PGRST_NO_ROWS) return res.status(404).json({ error: 'Not found' });
        if (e.code === PG_UNIQUE_VIOLATION) return res.status(409).json({ error: 'Already exists' });
        if (e.code === PG_CHECK_VIOLATION) return res.status(400).json({ error: 'Invalid value' });
        // Stripe errors carry `type` + `statusCode`; card/request errors are the client's problem.
        if (typeof e.type === 'string' && e.type.startsWith('Stripe') && e.statusCode && e.statusCode < 500) {
            return res.status(400).json({ error: e.message || 'Payment provider rejected the request' });
        }
        // express.json() body parse failures
        if (e.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
        if (e.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
    }

    console.error(`[API] ${req.method} ${req.originalUrl} failed:`, err);
    res.status(500).json({ error: 'Internal server error' });
};

/** Anything under /api that no router claimed. */
export const notFoundMiddleware = (req: Request, res: Response) => {
    res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
};
