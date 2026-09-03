import toast, { ToastOptions } from 'react-hot-toast';
import { getErrorMessage } from './errors';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

const BASE_STYLE: ToastOptions['style'] = {
    padding: '14px 18px',
    borderRadius: '16px',
    fontWeight: 600,
    fontSize: '14px',
    boxShadow: '0 20px 45px -15px rgba(0,0,0,0.25)',
    backdropFilter: 'blur(16px)',
    maxWidth: '90vw',
};

const STYLES: Record<ToastType, ToastOptions['style']> = {
    success: { ...BASE_STYLE, background: 'rgba(240, 253, 244, 0.92)', color: '#14532d', border: '1px solid rgba(187, 247, 208, 0.6)' },
    error: { ...BASE_STYLE, background: 'rgba(254, 242, 242, 0.92)', color: '#7f1d1d', border: '1px solid rgba(254, 202, 202, 0.6)' },
    warning: { ...BASE_STYLE, background: 'rgba(255, 251, 235, 0.92)', color: '#78350f', border: '1px solid rgba(253, 230, 138, 0.6)' },
    info: { ...BASE_STYLE, background: 'rgba(255, 255, 255, 0.92)', color: '#111827', border: '1px solid rgba(229, 231, 235, 0.6)' },
};

const show = (type: ToastType, message: string, options?: ToastOptions) => {
    const opts: ToastOptions = { duration: type === 'error' ? 4000 : 3000, position: 'top-center', style: STYLES[type], ...options };
    switch (type) {
        case 'success':
            return toast.success(message, opts);
        case 'error':
            return toast.error(message, opts);
        case 'warning':
            return toast(message, { icon: '⚠️', ...opts });
        default:
            return toast(message, { icon: 'ℹ️', ...opts });
    }
};

/**
 * Single notification API for the marketplace app.
 * Rendered by the `<Toaster />` mounted in `AppProviders`.
 */
export const notify = {
    success: (message: string, options?: ToastOptions) => show('success', message, options),
    error: (message: string, options?: ToastOptions) => show('error', message, options),
    warning: (message: string, options?: ToastOptions) => show('warning', message, options),
    info: (message: string, options?: ToastOptions) => show('info', message, options),
    /** Show `prefix: <error message>` for a caught error. */
    fromError: (error: unknown, prefix?: string) => {
        const detail = getErrorMessage(error);
        return show('error', prefix ? `${prefix}: ${detail}` : detail);
    },
    dismiss: toast.dismiss,
};

/** Backwards-compatible signature used by older components: showToast(message, type). */
export const showToast = (message: string, type: ToastType = 'success') => show(type, message);
