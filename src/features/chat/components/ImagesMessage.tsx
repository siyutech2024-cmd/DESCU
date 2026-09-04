import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/i18n';

interface ImagesMessageProps {
    content: {
        images: string[];
        count?: number;
    };
}

/** Photo bubble: a tight grid of thumbnails that opens a full-screen viewer. */
export const ImagesMessage: React.FC<ImagesMessageProps> = ({ content }) => {
    const { t } = useLanguage();
    const images = (content.images || []).filter(Boolean);
    const count = images.length;
    const [viewer, setViewer] = useState<number | null>(null);

    useEffect(() => {
        if (viewer === null) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setViewer(null);
            if (e.key === 'ArrowRight') setViewer(v => (v === null ? v : (v + 1) % count));
            if (e.key === 'ArrowLeft') setViewer(v => (v === null ? v : (v - 1 + count) % count));
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [viewer, count]);

    if (count === 0) return null;

    const cols = count === 1 ? 'grid-cols-1' : count === 3 ? 'grid-cols-3' : 'grid-cols-2';
    const shown = images.slice(0, count > 4 ? 4 : count);

    return (
        <>
            <div className={`grid ${cols} gap-1 rounded-2xl overflow-hidden bg-white border border-gray-100 p-1 shadow-sm`}>
                {shown.map((url, idx) => (
                    <button
                        key={`${url}-${idx}`}
                        type="button"
                        onClick={() => setViewer(idx)}
                        className={`relative overflow-hidden bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 ${count === 1 ? 'rounded-xl' : 'aspect-square rounded-lg'}`}
                        aria-label={`${t('chat.preview.image')} ${idx + 1}/${count}`}
                    >
                        <img src={url} alt="" loading="lazy" className={`w-full h-full object-cover transition-transform duration-300 hover:scale-[1.03] ${count === 1 ? 'max-h-72' : ''}`} />
                        {idx === 3 && count > 4 && (
                            <span className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-2xl font-black">+{count - 4}</span>
                        )}
                    </button>
                ))}
            </div>

            {viewer !== null && createPortal(
                <div className="fixed inset-0 z-toast bg-black/95 flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewer(null)} role="dialog" aria-modal="true">
                    <button type="button" onClick={() => setViewer(null)} aria-label={t('modal.close')} className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
                        <X size={22} />
                    </button>
                    {count > 1 && (
                        <>
                            <button type="button" onClick={e => { e.stopPropagation(); setViewer((viewer - 1 + count) % count); }} className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"><ChevronLeft size={22} /></button>
                            <button type="button" onClick={e => { e.stopPropagation(); setViewer((viewer + 1) % count); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"><ChevronRight size={22} /></button>
                        </>
                    )}
                    <img src={images[viewer]} alt="" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
                    {count > 1 && (
                        <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white tabular-nums">{viewer + 1} / {count}</span>
                    )}
                </div>,
                document.body,
            )}
        </>
    );
};
