import { imagePrefixesFromEnv, validateMessagePayload } from '../domain/chatMessages';

const ME = 'user-me';
const OTHER = 'user-other';
const ctx = {
    senderId: ME,
    participants: [ME, OTHER],
    allowedImagePrefixes: imagePrefixesFromEnv('https://proj.supabase.co/'),
    now: new Date('2026-09-04T10:00:00.000Z'),
};
const parse = (r: ReturnType<typeof validateMessagePayload>) => (r.ok && r.value.content ? JSON.parse(r.value.content) : null);

describe('validateMessagePayload', () => {
    it('plain text: trims, requires content, caps length', () => {
        expect(validateMessagePayload({ text: '  hola  ' }, ctx)).toEqual({ ok: true, value: { message_type: 'text', text: 'hola', content: null } });
        expect(validateMessagePayload({ text: '   ' }, ctx)).toMatchObject({ ok: false });
        expect(validateMessagePayload({ text: 'x'.repeat(4001) }, ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/too long/) });
        expect(validateMessagePayload({ message_type: 'order_status', text: 'x', content: {} }, ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/Unsupported/) });
    });

    it('images: only DESCU storage URLs, 1–10 of them, sender stamped by the server', () => {
        const good = 'https://proj.supabase.co/storage/v1/object/public/chat-images/a.jpg';
        const r = validateMessagePayload({ message_type: 'images', content: { images: [good], shared_by: OTHER } }, ctx);
        expect(r.ok).toBe(true);
        expect(parse(r)).toMatchObject({ images: [good], count: 1, shared_by: ME, timestamp: '2026-09-04T10:00:00.000Z' });
        expect(r.ok && r.value.text).toBe('📷 1');

        expect(validateMessagePayload({ message_type: 'images', content: { images: [] } }, ctx)).toMatchObject({ ok: false });
        expect(validateMessagePayload({ message_type: 'images', content: { images: ['https://evil.example/x.jpg'] } }, ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/DESCU storage/) });
        expect(validateMessagePayload({ message_type: 'images', content: { images: Array(11).fill(good) } }, ctx)).toMatchObject({ ok: false });
        // content may arrive as a JSON string too
        expect(validateMessagePayload({ message_type: 'images', content: JSON.stringify({ images: [good] }) }, ctx).ok).toBe(true);
    });

    it('location: needs a name and coordinates in range', () => {
        const r = validateMessagePayload({ message_type: 'location', content: { name: 'Café', address: 'Calle 1', lat: '19.43', lng: -99.13 } }, ctx);
        expect(parse(r)).toMatchObject({ name: 'Café', address: 'Calle 1', lat: 19.43, lng: -99.13, shared_by: ME });
        expect(r.ok && r.value.text).toBe('📍 Café');
        expect(validateMessagePayload({ message_type: 'location', content: { name: 'x', lat: 91, lng: 0 } }, ctx)).toMatchObject({ ok: false });
        expect(validateMessagePayload({ message_type: 'location', content: { lat: 1, lng: 1 } }, ctx)).toMatchObject({ ok: false });
    });

    it('meetup_time: proposer is the sender; a confirmation keeps the original proposer and stamps confirmed_by', () => {
        const proposed = validateMessagePayload({
            message_type: 'meetup_time',
            content: { datetime: '2026-09-10T15:00:00.000Z', date: '2026-09-10', time: '15:00', location: 'Metro', note: 'n', status: 'proposed', proposed_by: OTHER },
        }, ctx);
        expect(parse(proposed)).toMatchObject({ status: 'proposed', proposed_by: ME, location: 'Metro', note: 'n' });

        const confirmed = validateMessagePayload({
            message_type: 'meetup_time',
            content: { ...parse(proposed), status: 'confirmed', proposed_by: OTHER, confirmed_by: 'forged' },
        }, ctx);
        expect(parse(confirmed)).toMatchObject({ status: 'confirmed', proposed_by: OTHER, confirmed_by: ME, confirmed_at: '2026-09-04T10:00:00.000Z' });

        // an outsider id as proposer is not trusted
        const tampered = validateMessagePayload({ message_type: 'meetup_time', content: { datetime: '2026-09-10T15:00:00.000Z', status: 'confirmed', proposed_by: 'stranger' } }, ctx);
        expect(parse(tampered)).toMatchObject({ proposed_by: ME });
        expect(validateMessagePayload({ message_type: 'meetup_time', content: { datetime: 'not a date' } }, ctx)).toMatchObject({ ok: false });
    });
});
