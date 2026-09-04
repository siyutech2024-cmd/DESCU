import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Is there an in-app history entry to go back to?
 * react-router v6 stamps `idx` on `history.state`; it is 0 for the first entry of the session
 * (a direct link, a shared URL, a fresh PWA/Capacitor launch), so `navigate(-1)` would leave
 * the app or do nothing.
 */
export const canGoBack = (): boolean => {
    if (typeof window === 'undefined') return false;
    const idx = (window.history.state as { idx?: unknown } | null)?.idx;
    return typeof idx === 'number' && idx > 0;
};

/**
 * `goBack()` pops the history when the user navigated here from inside the app, and
 * otherwise routes to `fallback` (e.g. `'/'`) so deep-linked visitors always land somewhere.
 */
export const useBackNavigation = (fallback: string) => {
    const navigate = useNavigate();

    const goBack = useCallback(() => {
        if (canGoBack()) navigate(-1);
        else navigate(fallback, { replace: true });
    }, [navigate, fallback]);

    return goBack;
};
