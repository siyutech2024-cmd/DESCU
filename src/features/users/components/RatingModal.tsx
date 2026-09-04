import React, { useState } from 'react';
import { Star, X, Loader2 } from 'lucide-react';
import { User } from '@/types';
import { useLanguage } from '@/i18n';
import { Sheet } from '@/components/ui/Sheet';

interface RatingModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetUser: User;
    /**
     * Submit handler. May be async: the modal shows a pending state while it runs,
     * closes on success and stays open (so the user can retry) if it throws.
     */
    onSubmit: (score: number, comment: string) => void | Promise<void>;
}

export const RatingModal: React.FC<RatingModalProps> = ({ isOpen, onClose, targetUser, onSubmit }) => {
    const { t } = useLanguage();
    const [score, setScore] = useState(0);
    const [hoverScore, setHoverScore] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const reset = () => {
        setScore(0);
        setHoverScore(0);
        setComment('');
    };

    const handleClose = () => {
        if (isSubmitting) return;
        reset();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (score === 0 || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await onSubmit(score, comment.trim());
            reset();
            onClose();
        } catch {
            // The caller is responsible for surfacing the error (toast); keep the modal open for retry.
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Sheet open={isOpen} onClose={handleClose} size="md" labelledBy="rating-modal-title" className="p-6">
            <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
                <X size={20} />
            </button>

            <div className="text-center mb-8">
                <h2 id="rating-modal-title" className="text-2xl font-black text-gray-900 mb-2">{t('rating.title')}</h2>
                <p className="text-gray-500 text-sm">
                    {t('rating.subtitle')} <span className="font-bold text-gray-800">{targetUser.name}</span>
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="flex justify-center gap-2 mb-8">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            disabled={isSubmitting}
                            aria-label={`${star}`}
                            className="transition-transform hover:scale-110 focus:outline-none"
                            onMouseEnter={() => setHoverScore(star)}
                            onMouseLeave={() => setHoverScore(0)}
                            onClick={() => setScore(star)}
                        >
                            <Star
                                size={40}
                                className={`${star <= (hoverScore || score) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} transition-colors`}
                                fill={star <= (hoverScore || score) ? "currentColor" : "none"}
                            />
                        </button>
                    ))}
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-700 mb-2">{t('profile.rate_comment')}</label>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        disabled={isSubmitting}
                        maxLength={500}
                        placeholder={t('rating.comment_placeholder')}
                        className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none resize-none text-sm disabled:opacity-60"
                    />
                </div>

                <button
                    type="submit"
                    disabled={score === 0 || isSubmitting}
                    className="w-full py-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/30 disabled:opacity-50 disabled:shadow-none hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                    {isSubmitting ? t('profile.submitting') : t('profile.submit_rating')}
                </button>
            </form>
        </Sheet>
    );
};
