import React, { useState } from 'react';
import { MapPin, LocateFixed, Search, Loader2, Check } from 'lucide-react';
import { sendRichMessage } from '@/services/chatService';
import { useLanguage } from '@/i18n';
import { api } from '@/lib/api/client';
import { notify } from '@/lib/toast';
import { Sheet } from '@/components/ui/Sheet';
import { Button, inputClass } from '@/components/ui/primitives';

interface LocationSenderProps {
    open: boolean;
    conversationId: string;
    onSent?: () => void;
    onClose: () => void;
}

interface Place { name: string; address: string; lat: number; lng: number }

/** Compact "street, neighbourhood, city" from a Nominatim address object. */
const shortAddress = (a: Record<string, string> | undefined, fallback: string) => {
    if (!a) return fallback;
    const parts = [
        a.road && a.house_number ? `${a.road} ${a.house_number}` : a.road,
        a.suburb || a.neighbourhood || a.quarter,
        a.city || a.town || a.village || a.municipality,
        a.state,
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : fallback;
};

/** Bottom sheet to share a meeting point: current position or a searched place. */
export const LocationSender: React.FC<LocationSenderProps> = ({ open, conversationId, onSent, onClose }) => {
    const { t, language } = useLanguage();
    const [isLocating, setIsLocating] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Place[]>([]);
    const [selected, setSelected] = useState<Place | null>(null);

    const reset = () => { setQuery(''); setResults([]); setSelected(null); };
    const close = () => { reset(); onClose(); };

    const useCurrentLocation = () => {
        if (!navigator.geolocation) { notify.error(t('location.geo_unsupported')); return; }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            async ({ coords }) => {
                const { latitude: lat, longitude: lng } = coords;
                let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                let name = t('location.current_name');
                try {
                    const data = await api.get<{ address?: Record<string, string>; name?: string }>('/api/location/reverse', { params: { lat, lon: lng } });
                    address = shortAddress(data.address, address);
                    if (data.address?.road) name = data.address.road;
                } catch { /* keep coordinates */ }
                setSelected({ name, address, lat, lng });
                setResults([]);
                setIsLocating(false);
            },
            () => { notify.error(t('location.geo_denied')); setIsLocating(false); },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    };

    const search = async () => {
        const q = query.trim();
        if (q.length < 2) return;
        setIsSearching(true);
        try {
            const rows = await api.get<Place[]>('/api/location/search', { params: { q, lang: language } });
            setResults(rows);
            if (rows.length === 0) notify.info(t('location.not_found'));
        } catch {
            notify.error(t('location.not_found'));
        } finally {
            setIsSearching(false);
        }
    };

    const send = async () => {
        if (!selected) return;
        setIsSending(true);
        try {
            await sendRichMessage(conversationId, 'location', { ...selected }, `📍 ${t('location.shared')}: ${selected.name}`);
            reset();
            onSent?.();
        } catch {
            notify.error(t('location.send_failed'));
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Sheet
            open={open}
            onClose={close}
            variant="bottom"
            title={t('location.title')}
            closeLabel={t('modal.close')}
            footer={<Button block size="lg" onClick={send} disabled={!selected} loading={isSending} icon={<MapPin size={18} />}>{t('location.send')}</Button>}
        >
            <div className="space-y-4 pb-2">
                <Button block variant="secondary" size="lg" onClick={useCurrentLocation} loading={isLocating} icon={<LocateFixed size={18} />}>
                    {t('location.current')}
                </Button>

                <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex-1 h-px bg-gray-200" />{t('location.or_search')}<span className="flex-1 h-px bg-gray-200" />
                </div>

                <form className="flex gap-2" onSubmit={e => { e.preventDefault(); search(); }}>
                    <input
                        type="search"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={t('location.search_placeholder')}
                        className={inputClass}
                        data-autofocus
                    />
                    <Button type="submit" variant="subtle" size="lg" aria-label={t('location.search_placeholder')} disabled={query.trim().length < 2} loading={isSearching} icon={<Search size={18} />} className="px-4" />
                </form>

                {results.length > 0 && (
                    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
                        {results.map((r, i) => {
                            const active = selected?.lat === r.lat && selected?.lng === r.lng;
                            return (
                                <li key={`${r.lat}-${r.lng}-${i}`}>
                                    <button type="button" onClick={() => setSelected(r)} className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${active ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
                                        <MapPin size={16} className={`mt-0.5 flex-shrink-0 ${active ? 'text-brand-600' : 'text-gray-400'}`} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-bold text-gray-900 truncate">{r.name}</span>
                                            <span className="block text-xs text-gray-500 truncate">{r.address}</span>
                                        </span>
                                        {active && <Check size={16} className="text-brand-600 mt-0.5" />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {selected && (
                    <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3 flex items-start gap-3">
                        <MapPin size={18} className="text-brand-600 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{selected.name}</p>
                            <p className="text-xs text-gray-600 leading-relaxed">{selected.address}</p>
                        </div>
                    </div>
                )}
                {!selected && results.length === 0 && (
                    <p className="text-xs text-gray-400 text-center">{t('location.tip')}</p>
                )}
                {isLocating && !selected && (
                    <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1.5"><Loader2 size={12} className="animate-spin" />{t('list.loading_loc')}</p>
                )}
            </div>
        </Sheet>
    );
};
