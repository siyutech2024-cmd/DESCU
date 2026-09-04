import React, { useEffect, useRef, useState } from 'react';
import { X, Image as ImageIcon, Camera, Send, Plus } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { uploadChatImage, compressImage } from '@/services/chatImageUpload';
import { sendRichMessage } from '@/services/chatService';
import { useLanguage } from '@/i18n';
import { notify } from '@/lib/toast';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/primitives';

interface ImageSenderProps {
    open: boolean;
    conversationId: string;
    onSent?: () => void;
    onClose: () => void;
}

const MAX_IMAGES = 5;

/** Bottom sheet to pick up to five photos and send them as one message. */
export const ImageSender: React.FC<ImageSenderProps> = ({ open, conversationId, onSent, onClose }) => {
    const { t } = useLanguage();
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [progress, setProgress] = useState<number | null>(null);
    const galleryRef = useRef<HTMLInputElement>(null);
    const cameraRef = useRef<HTMLInputElement>(null);

    // Object URLs are revoked whenever the preview set changes or the sheet unmounts.
    useEffect(() => () => { previews.forEach(u => URL.revokeObjectURL(u)); }, [previews]);

    const addFiles = (list: FileList | null) => {
        if (!list) return;
        const next = [...files, ...Array.from(list)].slice(0, MAX_IMAGES);
        setFiles(next);
        setPreviews(next.map(f => URL.createObjectURL(f)));
    };
    const removeAt = (i: number) => {
        const next = files.filter((_, idx) => idx !== i);
        setFiles(next);
        setPreviews(next.map(f => URL.createObjectURL(f)));
    };
    const reset = () => { setFiles([]); setPreviews([]); setProgress(null); };
    const close = () => { if (progress !== null) return; reset(); onClose(); };

    const send = async () => {
        if (files.length === 0) return;
        setProgress(0);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { notify.error(t('image.login_first')); return; }
            const urls: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const compressed = await compressImage(files[i]);
                const result = await uploadChatImage(compressed, session.user.id);
                urls.push(result.url);
                setProgress(Math.round(((i + 1) / files.length) * 100));
            }
            await sendRichMessage(conversationId, 'images', { images: urls }, `📷 ${t('image.shared').replace('{0}', String(urls.length))}`);
            reset();
            onSent?.();
        } catch {
            notify.error(t('image.send_failed'));
        } finally {
            setProgress(null);
        }
    };

    const uploading = progress !== null;

    return (
        <Sheet
            open={open}
            onClose={close}
            variant="bottom"
            title={t('image.title')}
            closeLabel={t('modal.close')}
            dismissible={!uploading}
            footer={
                <Button block size="lg" onClick={send} disabled={files.length === 0} loading={uploading} icon={<Send size={18} />}>
                    {uploading ? t('image.uploading').replace('{0}', String(progress)) : t('image.send').replace('{0}', String(files.length))}
                </Button>
            }
        >
            <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

            <div className="space-y-4 pb-2">
                {files.length === 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => galleryRef.current?.click()} className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-8 text-gray-600 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 transition-colors">
                            <ImageIcon size={26} /><span className="text-sm font-bold">{t('image.from_gallery')}</span>
                        </button>
                        <button type="button" onClick={() => cameraRef.current?.click()} className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-8 text-gray-600 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 transition-colors">
                            <Camera size={26} /><span className="text-sm font-bold">{t('image.take_photo')}</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2">
                        {previews.map((url, i) => (
                            <div key={url} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                                <img src={url} alt="" className="w-full h-full object-cover" />
                                {!uploading && (
                                    <button type="button" onClick={() => removeAt(i)} aria-label={t('chat.delete')} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                        {files.length < MAX_IMAGES && !uploading && (
                            <button type="button" onClick={() => galleryRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:border-brand-300 hover:text-brand-600 transition-colors" aria-label={t('image.from_gallery')}>
                                <Plus size={24} />
                            </button>
                        )}
                    </div>
                )}

                {uploading && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                )}

                <p className="text-xs text-gray-400 text-center">{files.length > 0 ? t('image.count').replace('{0}', String(files.length)) : t('image.tip')}</p>
            </div>
        </Sheet>
    );
};
