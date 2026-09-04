/**
 * Validation of chat message payloads (text and rich cards).
 *
 * The client used to insert rich messages (photos, a shared location, a meetup
 * proposal) straight into `messages` with its own JWT. They now go through
 * POST /api/messages like plain text, so the server owns the shape of every card and
 * `sender_id` can never be forged. Pure functions — no I/O — so they are unit-testable.
 */

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_IMAGES_PER_MESSAGE = 10;

export const CLIENT_MESSAGE_TYPES = ['text', 'images', 'location', 'meetup_time'] as const;
export type ClientMessageType = typeof CLIENT_MESSAGE_TYPES[number];

export const MEETUP_STATUSES = ['proposed', 'confirmed', 'declined'] as const;
export type MeetupStatus = typeof MEETUP_STATUSES[number];

export interface ValidatedMessage {
    message_type: ClientMessageType;
    text: string;
    /** JSON string stored in `messages.content`; null for plain text. */
    content: string | null;
}

export type ValidationResult = { ok: true; value: ValidatedMessage } | { ok: false; error: string };

export interface ValidationContext {
    senderId: string;
    /** Both seats of the conversation; used to sanity-check ids inside cards. */
    participants: readonly string[];
    /** Only URLs under one of these prefixes are accepted as chat images (public storage buckets). */
    allowedImagePrefixes: readonly string[];
    now?: Date;
}

const fail = (error: string): ValidationResult => ({ ok: false, error });

const str = (v: unknown, max: number): string | null => {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    return s.length > 0 && s.length <= max ? s : null;
};
const optStr = (v: unknown, max: number): string | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    return str(v, max) ?? undefined;
};
const num = (v: unknown, min: number, max: number): number | null => {
    const n = typeof v === 'string' ? Number(v) : v;
    return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : null;
};

const parseContent = (raw: unknown): Record<string, unknown> | null => {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }
    return null;
};

const isAllowedImageUrl = (url: unknown, prefixes: readonly string[]): url is string =>
    typeof url === 'string' && url.length <= 2048 && prefixes.some(p => p && url.startsWith(p));

export const validateMessagePayload = (body: unknown, ctx: ValidationContext): ValidationResult => {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const type = (b.message_type ?? 'text') as string;
    const now = (ctx.now ?? new Date()).toISOString();

    if (!(CLIENT_MESSAGE_TYPES as readonly string[]).includes(type)) {
        return fail(`Unsupported message type "${type}"`);
    }
    const rawText = typeof b.text === 'string' ? b.text.trim() : '';
    if (rawText.length > MAX_MESSAGE_LENGTH) return fail(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);

    if (type === 'text') {
        if (!rawText) return fail('Message text is required');
        return { ok: true, value: { message_type: 'text', text: rawText, content: null } };
    }

    const content = parseContent(b.content);
    if (!content) return fail('content is required for rich messages');

    if (type === 'images') {
        const images = Array.isArray(content.images) ? content.images : [];
        if (images.length === 0 || images.length > MAX_IMAGES_PER_MESSAGE) {
            return fail(`images must contain 1–${MAX_IMAGES_PER_MESSAGE} URLs`);
        }
        if (!images.every(u => isAllowedImageUrl(u, ctx.allowedImagePrefixes))) {
            return fail('Only images uploaded to DESCU storage can be shared');
        }
        return {
            ok: true,
            value: {
                message_type: 'images',
                text: rawText || `📷 ${images.length}`,
                content: JSON.stringify({ images, count: images.length, shared_by: ctx.senderId, timestamp: now }),
            },
        };
    }

    if (type === 'location') {
        const name = str(content.name, 200);
        const lat = num(content.lat, -90, 90);
        const lng = num(content.lng, -180, 180);
        if (!name || lat === null || lng === null) return fail('location needs name, lat and lng');
        const address = optStr(content.address, 300);
        return {
            ok: true,
            value: {
                message_type: 'location',
                text: rawText || `📍 ${name}`,
                content: JSON.stringify({ name, address: address ?? '', lat, lng, shared_by: ctx.senderId, timestamp: now }),
            },
        };
    }

    // meetup_time
    const datetime = typeof content.datetime === 'string' && !Number.isNaN(new Date(content.datetime).getTime())
        ? new Date(content.datetime).toISOString()
        : null;
    if (!datetime) return fail('meetup_time needs a valid datetime');
    const status = (MEETUP_STATUSES as readonly string[]).includes(content.status as string) ? (content.status as MeetupStatus) : 'proposed';
    const proposedBy = status === 'proposed'
        ? ctx.senderId
        : (typeof content.proposed_by === 'string' && ctx.participants.includes(content.proposed_by) ? content.proposed_by : ctx.senderId);
    const card: Record<string, unknown> = {
        datetime,
        date: optStr(content.date, 20) ?? datetime.slice(0, 10),
        time: optStr(content.time, 20) ?? datetime.slice(11, 16),
        location: optStr(content.location, 200) ?? '',
        note: optStr(content.note, 500) ?? '',
        product_title: optStr(content.product_title, 200) ?? '',
        proposed_by: proposedBy,
        status,
        timestamp: now,
    };
    if (status === 'confirmed') { card.confirmed_by = ctx.senderId; card.confirmed_at = now; }
    if (status === 'declined') { card.declined_by = ctx.senderId; card.declined_at = now; }
    return {
        ok: true,
        value: {
            message_type: 'meetup_time',
            text: rawText || `📅 ${card.date} ${card.time}`,
            content: JSON.stringify(card),
        },
    };
};

/** Public-bucket prefixes derived from SUPABASE_URL (chat images live in Supabase Storage). */
export const imagePrefixesFromEnv = (supabaseUrl: string | undefined): string[] => {
    if (!supabaseUrl) return [];
    const base = supabaseUrl.replace(/\/+$/, '');
    return [`${base}/storage/v1/object/public/`, `${base}/storage/v1/render/image/public/`];
};
