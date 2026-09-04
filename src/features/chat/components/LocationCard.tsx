import React from 'react';
import { MapPin, Navigation, Copy, Check } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { notify } from '@/lib/toast';
import { Button } from '@/components/ui/primitives';
import { MessageCard, CardFooter } from './MessageCard';

interface LocationCardProps {
    content: {
        name: string;
        address: string;
        lat: number;
        lng: number;
    };
    senderName?: string;
    isMe?: boolean;
}

/** A shared meeting point: map preview, short address, navigate / copy. */
export const LocationCard: React.FC<LocationCardProps> = ({ content, senderName, isMe }) => {
    const { t } = useLanguage();
    const { name, address, lat, lng } = content;
    const [copied, setCopied] = React.useState(false);

    const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.008},${lat - 0.005},${lng + 0.008},${lat + 0.005}&layer=mapnik&marker=${lat},${lng}`;
    const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const viewMapUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    const copyAddress = async () => {
        try {
            await navigator.clipboard.writeText(`${name} — ${address}`);
            setCopied(true);
            notify.success(t('location.address_copied'));
            setTimeout(() => setCopied(false), 1500);
        } catch {
            notify.error(t('location.send_failed'));
        }
    };

    return (
        <MessageCard
            icon={<MapPin size={16} />}
            label={isMe || !senderName ? t('location.share_title') : t('location.shared_by').replace('{0}', senderName)}
            title={name}
        >
            <a href={viewMapUrl} target="_blank" rel="noopener noreferrer" className="block relative mx-4 rounded-xl overflow-hidden border border-gray-100 bg-gray-50" title={t('location.click_map')}>
                <iframe src={embedUrl} className="w-full h-36 border-0 pointer-events-none" title={t('location.map_preview')} loading="lazy" tabIndex={-1} />
                <span className="absolute inset-0" aria-hidden="true" />
            </a>
            <p className="px-4 pt-3 pb-1 text-sm text-gray-600 leading-relaxed line-clamp-3">{address}</p>
            <CardFooter className="grid grid-cols-2 gap-2">
                <Button size="sm" icon={<Navigation size={16} />} onClick={() => window.open(navigationUrl, '_blank', 'noopener')}>{t('location.navigate')}</Button>
                <Button size="sm" variant="secondary" icon={copied ? <Check size={16} /> : <Copy size={16} />} onClick={copyAddress}>{t('location.copy')}</Button>
            </CardFooter>
        </MessageCard>
    );
};
