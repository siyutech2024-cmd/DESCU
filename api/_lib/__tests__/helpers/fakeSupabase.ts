/**
 * In-memory stand-in for the Supabase query builder, just enough for service-level
 * tests: tables are arrays of plain rows; filters are applied when the query is awaited.
 *
 * Usage:
 *   jest.mock('../db/supabase', () => ({ supabase: fakeSupabase }));
 *   resetDb({ orders: [...] });
 *
 * Supported: select (column list ignored — rows are returned as stored), insert, update,
 * delete, eq, neq, in, is, or (`col.is.null,col.eq.value` alternatives), order, limit,
 * range, single, maybeSingle.
 */
export type Row = Record<string, any>;

export const db: Record<string, Row[]> = {};
/** Every executed query, handy when debugging a failing case. */
export const calls: { table: string; op: string; payload?: unknown }[] = [];

export class FakeQuery {
    private filters: ((r: Row) => boolean)[] = [];
    private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    private payload: any;
    private wantSelect = false;
    private sort: { col: string; ascending: boolean } | null = null;
    private slice: { from: number; to: number } | null = null;
    constructor(private table: string) { db[table] ??= []; }
    private countOnly = false;
    select(_cols?: string, opts?: { count?: string; head?: boolean }) { this.wantSelect = true; if (opts?.head) this.countOnly = true; return this; }
    insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
    update(patch: Row) { this.op = 'update'; this.payload = patch; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(col: string, v: any) { this.filters.push(r => r[col] === v); return this; }
    neq(col: string, v: any) { this.filters.push(r => r[col] !== v); return this; }
    is(col: string, v: any) { this.filters.push(r => (v === null ? r[col] == null : r[col] === v)); return this; }
    in(col: string, vs: any[]) { this.filters.push(r => vs.includes(r[col])); return this; }
    or(expr: string) {
        // supports "col.is.null,col.eq.false,col.neq.value"
        const alts = expr.split(',').map(part => {
            const [col, op, val] = part.split('.');
            if (op === 'is') return (r: Row) => (val === 'null' ? r[col] == null : String(r[col]) === val);
            if (op === 'neq') return (r: Row) => r[col] != null && String(r[col]) !== val;
            return (r: Row) => String(r[col]) === val;
        });
        this.filters.push(r => alts.some(f => f(r)));
        return this;
    }
    order(col: string, opts?: { ascending?: boolean }) { this.sort = { col, ascending: opts?.ascending ?? true }; return this; }
    limit(n: number) { this.slice = { from: 0, to: n - 1 }; return this; }
    range(from: number, to: number) { this.slice = { from, to }; return this; }
    maybeSingle() { return this.then(res => ({ ...res, data: res.data?.[0] ?? null })); }
    single() {
        return this.then(res => {
            if (res.error) return res;
            if (!res.data || res.data.length !== 1) {
                return { data: null, error: { code: 'PGRST116', message: `Expected exactly one row, got ${res.data?.length ?? 0}` } };
            }
            return { ...res, data: res.data[0] };
        });
    }
    private exec() {
        calls.push({ table: this.table, op: this.op, payload: this.payload });
        const rows = db[this.table];
        const match = (r: Row) => this.filters.every(f => f(r));
        if (this.op === 'insert') {
            if (this.table === 'stripe_events') {
                const dup = this.payload.some((p: Row) => rows.some(r => r.event_id === p.event_id));
                if (dup) return { data: null, error: { code: '23505', message: 'duplicate key' } };
            }
            rows.push(...this.payload);
            return { data: this.payload, error: null };
        }
        if (this.op === 'delete') {
            const keep = rows.filter(r => !match(r));
            rows.splice(0, rows.length, ...keep);
            return { data: null, error: null };
        }
        if (this.op === 'update') {
            const hit = rows.filter(match);
            hit.forEach(r => Object.assign(r, this.payload));
            return { data: this.wantSelect ? hit : null, error: null };
        }
        let out = rows.filter(match);
        if (this.sort) {
            const { col, ascending } = this.sort;
            out = [...out].sort((a, b) => {
                const av = a[col] ?? '';
                const bv = b[col] ?? '';
                if (av === bv) return 0;
                return (av < bv ? -1 : 1) * (ascending ? 1 : -1);
            });
        }
        if (this.countOnly) return { data: null, count: out.length, error: null };
        if (this.slice) out = out.slice(this.slice.from, this.slice.to + 1);
        return { data: out, count: out.length, error: null };
    }
    then(onOk?: ((v: any) => any) | null, onErr?: ((e: any) => any) | null): Promise<any> {
        return Promise.resolve(this.exec()).then(onOk ?? undefined, onErr ?? undefined);
    }
}

export const fakeSupabase = { from: (table: string) => new FakeQuery(table) };

/** Clear every table and the call log, then seed the given tables. */
export const resetDb = (seed: Record<string, Row[]> = {}) => {
    for (const k of Object.keys(db)) delete db[k];
    calls.length = 0;
    for (const [table, rows] of Object.entries(seed)) db[table] = rows;
};
