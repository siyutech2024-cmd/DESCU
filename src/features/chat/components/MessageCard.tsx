import React from 'react';
import { Chip, IconTile, type ChipTone } from '@/components/ui/primitives';

/**
 * The one shell for rich chat messages (offer, order update, location, meetup, photos).
 * White card, brand icon tile, eyebrow label, optional status chip on the right; the body is
 * whatever the message type needs. Alignment (mine / theirs) is the ChatWindow's job.
 */
export interface MessageCardProps {
    icon: React.ReactNode;
    /** Small uppercase label: "Oferta", "Pedido", "Ubicación"… */
    label: string;
    /** Optional one-line title under the label (product name, place name). */
    title?: string;
    status?: { text: string; tone: ChipTone; icon?: React.ReactNode };
    /** Tone of the icon tile (defaults to brand). */
    tone?: ChipTone;
    children: React.ReactNode;
    className?: string;
}

export const MessageCard: React.FC<MessageCardProps> = ({ icon, label, title, status, tone = 'brand', children, className = '' }) => (
    <div className={`w-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
            <IconTile tone={tone} size="sm">{icon}</IconTile>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 leading-none">{label}</p>
                {title && <p className="text-sm font-bold text-gray-900 truncate mt-1">{title}</p>}
            </div>
            {status && <Chip tone={status.tone} icon={status.icon}>{status.text}</Chip>}
        </div>
        {children}
    </div>
);

/** Key / value row used inside cards (prices, dates). */
export const CardRow: React.FC<{ label: string; value: React.ReactNode; strong?: boolean; muted?: boolean; className?: string }> = ({ label, value, strong = false, muted = false, className = '' }) => (
    <div className={`flex items-baseline justify-between gap-3 px-4 py-2 ${className}`}>
        <span className="text-sm text-gray-500">{label}</span>
        <span className={`tabular-nums ${strong ? 'text-xl font-black text-gray-900' : muted ? 'text-sm text-gray-400 line-through' : 'text-sm font-bold text-gray-800'}`}>{value}</span>
    </div>
);

/** Footer strip for actions or a status sentence. */
export const CardFooter: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
    <div className={`border-t border-gray-100 px-4 py-3 ${className}`}>{children}</div>
);
