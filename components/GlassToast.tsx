import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, X, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
    message: string;
    type?: ToastType;
    isVisible: boolean;
    onClose: () => void;
    duration?: number;
}

export const GlassToast: React.FC<ToastProps> = ({
    message,
    type = 'success',
    isVisible,
    onClose,
    duration = 3000
}) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (isVisible) {
            setShow(true);
            const timer = setTimeout(() => {
                setShow(false);
                setTimeout(onClose, 300); // Wait for exit animation
            }, duration);
            return () => clearTimeout(timer);
        } else {
            setShow(false);
        }
    }, [isVisible, duration, onClose]);

    if (!isVisible && !show) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle className="text-green-500" size={24} />;
            case 'error': return <XCircle className="text-red-500" size={24} />;
            case 'warning': return <AlertTriangle className="text-amber-500" size={24} />;
            case 'info': return <Info className="text-blue-500" size={24} />;
        }
    };

    const getStyles = () => {
        switch (type) {
            case 'success': return 'border-green-200/50 bg-green-50/80 text-green-900';
            case 'error': return 'border-red-200/50 bg-red-50/80 text-red-900';
            case 'warning': return 'border-amber-200/50 bg-amber-50/80 text-amber-900';
            default: return 'border-gray-200/50 bg-white/80 text-gray-900';
        }
    }

    return (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] transition-all duration-300 ease-out ${show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-8 opacity-0 scale-95'}`}>
            <div className={`glass-panel px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[320px] max-w-[90vw] border backdrop-blur-xl ${getStyles()}`}>
                <div className="shrink-0 animate-in zoom-in duration-300">
                    {getIcon()}
                </div>
                <p className="flex-1 font-medium text-sm md:text-base leading-snug">{message}</p>
                <button
                    onClick={() => { setShow(false); setTimeout(onClose, 300); }}
                    className="p-1 hover:bg-black/5 rounded-full transition-colors shrink-0"
                >
                    <X size={18} className="opacity-50" />
                </button>
            </div>
        </div>
    );
};
