import React, { useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * The one modal shell.
 *
 * Every dialog and bottom sheet in the app renders inside <Sheet>: it owns the backdrop,
 * the layer (z-modal / z-modal-top), Escape-to-close, body scroll lock (nesting-safe),
 * focus management (initial focus, Tab trap, focus restore), safe-area padding and the
 * dialog ARIA wiring. Components only provide their content.
 *
 *   <Sheet open={isOpen} onClose={onClose} title={sellTitle} variant="bottom" size="lg">
 *       …content…
 *   </Sheet>
 */

export type SheetVariant = 'center' | 'bottom';
export type SheetSize = 'sm' | 'md' | 'lg';
export type SheetLayer = 'modal' | 'modal-top';

export interface SheetProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    /** `center`: dialog on every size. `bottom`: bottom sheet on mobile, dialog from md up. */
    variant?: SheetVariant;
    size?: SheetSize;
    /** Stack above another open sheet. */
    layer?: SheetLayer;
    /** Header title; renders the standard header with a close button. Omit for a custom header. */
    title?: React.ReactNode;
    /** Optional element rendered left of the close button in the standard header. */
    headerExtra?: React.ReactNode;
    /** Sticky footer (buttons); gets safe-area padding on mobile. */
    footer?: React.ReactNode;
    /** Backdrop click / Escape close the sheet (default true). Set false for mandatory flows. */
    dismissible?: boolean;
    /** Hide the close button of the standard header. */
    hideClose?: boolean;
    /** Extra classes for the panel. */
    className?: string;
    /** Extra classes for the scrolling body. */
    bodyClassName?: string;
    /** Id of the element that labels the dialog when `title` is not used. */
    labelledBy?: string;
    /** Focus this element first instead of the first focusable one. */
    initialFocusRef?: React.RefObject<HTMLElement>;
    /** Close button accessible label. */
    closeLabel?: string;
}

// Centered dialogs cap their width everywhere; bottom sheets are edge-to-edge on mobile.
const SIZE_CLASS: Record<SheetVariant, Record<SheetSize, string>> = {
    center: { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' },
    bottom: { sm: 'md:max-w-sm', md: 'md:max-w-md', lg: 'md:max-w-lg' },
};

const LAYER_CLASS: Record<SheetLayer, string> = {
    modal: 'z-modal',
    'modal-top': 'z-modal-top',
};

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Body scroll lock shared by every open sheet (nested sheets must not unlock early).
let lockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';
const lockBody = () => {
    if (typeof document === 'undefined') return;
    if (lockCount++ === 0) {
        const scrollbar = window.innerWidth - document.documentElement.clientWidth;
        savedOverflow = document.body.style.overflow;
        savedPaddingRight = document.body.style.paddingRight;
        document.body.style.overflow = 'hidden';
        if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    }
};
const unlockBody = () => {
    if (typeof document === 'undefined') return;
    if (--lockCount <= 0) {
        lockCount = 0;
        document.body.style.overflow = savedOverflow;
        document.body.style.paddingRight = savedPaddingRight;
    }
};

export const Sheet: React.FC<SheetProps> = ({
    open,
    onClose,
    children,
    variant = 'center',
    size = 'md',
    layer = 'modal',
    title,
    headerExtra,
    footer,
    dismissible = true,
    hideClose = false,
    className = '',
    bodyClassName = '',
    labelledBy,
    initialFocusRef,
    closeLabel = 'Close',
}) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const dismissibleRef = useRef(dismissible);
    dismissibleRef.current = dismissible;

    // Scroll lock + focus restore
    useLayoutEffect(() => {
        if (!open) return;
        previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
        lockBody();
        return () => {
            unlockBody();
            previouslyFocused.current?.focus?.();
        };
    }, [open]);

    // Initial focus
    useEffect(() => {
        if (!open) return;
        const frame = requestAnimationFrame(() => {
            const target = initialFocusRef?.current
                ?? panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')
                ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
                ?? panelRef.current;
            target?.focus?.({ preventScroll: true });
        });
        return () => cancelAnimationFrame(frame);
    }, [open, initialFocusRef]);

    // Escape + Tab trap
    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Events from a sheet nested inside this one (layer="modal-top") are its business.
        if (!panelRef.current || !panelRef.current.contains(e.target as Node)) return;
        if (e.key === 'Escape') {
            if (!dismissibleRef.current) return;
            e.stopPropagation();
            onCloseRef.current();
            return;
        }
        if (e.key !== 'Tab') return;
        const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
            .filter(el => el.offsetParent !== null || el === document.activeElement);
        if (nodes.length === 0) { e.preventDefault(); return; }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        }
    }, []);

    if (!open || typeof document === 'undefined') return null;

    const isBottom = variant === 'bottom';
    const panelShape = isBottom
        ? 'w-full rounded-t-3xl md:rounded-2xl max-h-[92dvh] md:max-h-[85dvh] animate-sheet-up md:animate-scale-in'
        : 'w-full rounded-2xl max-h-[90dvh] animate-scale-in';

    return createPortal(
        <div
            className={`fixed inset-0 ${LAYER_CLASS[layer]} flex ${isBottom ? 'items-end md:items-center' : 'items-center p-4'} justify-center md:p-4`}
            onKeyDown={onKeyDown}
        >
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                onClick={dismissible ? onClose : undefined}
                aria-hidden="true"
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : labelledBy}
                tabIndex={-1}
                className={`relative bg-white shadow-2xl flex flex-col overflow-hidden outline-none ${panelShape} ${SIZE_CLASS[variant][size]} ${className}`}
            >
                {title !== undefined && (
                    <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 flex-shrink-0">
                        <h2 id={titleId} className="text-lg font-bold text-gray-900 truncate">{title}</h2>
                        <div className="flex items-center gap-2">
                            {headerExtra}
                            {!hideClose && (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label={closeLabel}
                                    className="p-2 -mr-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            )}
                        </div>
                    </div>
                )}
                <div className={`flex-1 min-h-0 overflow-y-auto ${title !== undefined ? 'px-5' : ''} ${footer || /\bp[by]?-/.test(bodyClassName) ? '' : 'pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] md:pb-5'} ${bodyClassName}`}>
                    {children}
                </div>
                {footer && (
                    <div className="flex-shrink-0 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-4 border-t border-gray-100 bg-white">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
};

/** Small confirm dialog stacked above whatever is open. */
export interface ConfirmSheetProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    confirmLabel: string;
    cancelLabel: string;
    destructive?: boolean;
    busy?: boolean;
    icon?: React.ReactNode;
}

export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({
    open, onClose, onConfirm, title, description, confirmLabel, cancelLabel, destructive = false, busy = false, icon,
}) => (
    <Sheet open={open} onClose={onClose} size="sm" layer="modal-top" labelledBy="confirm-sheet-title" className="p-6">
        <div className="flex items-start gap-3 mb-4">
            {icon && <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${destructive ? 'bg-red-100 text-red-500' : 'bg-brand-100 text-brand-600'}`}>{icon}</div>}
            <div className="min-w-0">
                <h3 id="confirm-sheet-title" className="font-bold text-gray-900">{title}</h3>
                {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
            </div>
        </div>
        <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors">
                {cancelLabel}
            </button>
            <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                data-autofocus
                className={`flex-1 py-2.5 rounded-xl text-white font-bold transition-colors disabled:opacity-60 ${destructive ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-600 hover:bg-brand-700'}`}
            >
                {confirmLabel}
            </button>
        </div>
    </Sheet>
);
