import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

const PUSHED_KEY = 'urlModalPushed';

/**
 * A modal whose open state lives in the URL (`?<param>=1`).
 * Opening pushes a history entry (so Back closes the sheet); closing pops that entry when it
 * was ours, or replaces the URL when the sheet was reached by deep link — never leaving a
 * duplicate entry behind.
 */
export const useUrlModal = (param: string) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const isOpen = searchParams.get(param) === '1';

    const open = useCallback(() => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set(param, '1');
            return next;
        }, { state: { [PUSHED_KEY]: param } });
    }, [param, setSearchParams]);

    const close = useCallback(() => {
        const pushedByUs = (location.state as Record<string, unknown> | null)?.[PUSHED_KEY] === param;
        if (pushedByUs) {
            navigate(-1);
            return;
        }
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete(param);
            return next;
        }, { replace: true });
    }, [param, location.state, navigate, setSearchParams]);

    return { isOpen, open, close };
};
