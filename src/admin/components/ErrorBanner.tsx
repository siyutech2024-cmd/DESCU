import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBannerProps {
    message: string;
    onRetry?: () => void;
    className?: string;
}

/** Inline error state for admin data views — shown instead of silently rendering empty data. */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry, className = '' }) => (
    <div
        role="alert"
        className={`flex items-center justify-between gap-4 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl ${className}`}
    >
        <div className="flex items-center gap-3 min-w-0">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium break-words">{message}</span>
        </div>
        {onRetry && (
            <button
                type="button"
                onClick={onRetry}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg bg-white border border-red-200 hover:bg-red-100 transition-colors flex-shrink-0"
            >
                <RefreshCw className="w-4 h-4" />
                重试
            </button>
        )}
    </div>
);
