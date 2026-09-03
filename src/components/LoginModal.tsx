
import React from 'react';
import { X, LogIn } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogin: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin }) => {
    const { t } = useLanguage();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden animate-scale-in">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors z-10"
                >
                    <X size={20} className="text-gray-500" />
                </button>

                <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <LogIn size={32} />
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {t('login.required') || '需要登录 / Login Required'}
                    </h2>
                    <p className="text-gray-500 mb-8">
                        {t('login.prompt') || '请登录以继续操作 / Please log in to continue'}
                    </p>

                    <button
                        onClick={onLogin}
                        className="w-full py-3.5 px-4 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                    >
                        <img
                            src="https://www.google.com/favicon.ico"
                            alt="Google"
                            className="w-5 h-5"
                        />
                        {t('login.google') || 'Continue with Google'}
                    </button>

                    <p className="mt-6 text-xs text-gray-400">
                        {t('login.terms') || '继续即表示同意服务条款 / By continuing, you agree to our Terms'}
                    </p>
                </div>
            </div>
        </div>
    );
};
