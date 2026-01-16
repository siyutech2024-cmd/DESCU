
import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface RatingModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetUser: User;
    onSubmit: (score: number, comment: string) => void;
}

export const RatingModal: React.FC<RatingModalProps> = ({ isOpen, onClose, targetUser, onSubmit }) => {
    const [score, setScore] = useState(0);
    const [hoverScore, setHoverScore] = useState(0);
    const [comment, setComment] = useState('');
    const { t } = useLanguage();

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (score === 0) return;
        onSubmit(score, comment);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 animate-scale-in">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-gray-900 mb-2">Rate Experience</h2>
                    <p className="text-gray-500 text-sm">How was your interaction with <span className="font-bold text-gray-800">{targetUser.name}</span>?</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="flex justify-center gap-2 mb-8">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
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
                        <label className="block text-sm font-bold text-gray-700 mb-2">Comment (Optional)</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Share details about your experience..."
                            className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none resize-none text-sm"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={score === 0}
                        className="w-full py-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/30 disabled:opacity-50 disabled:shadow-none hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        Submit Review
                    </button>
                </form>
            </div>
        </div>
    );
};
