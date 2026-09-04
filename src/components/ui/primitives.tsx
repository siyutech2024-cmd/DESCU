import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Small, shared building blocks so every screen spends the same palette the same way:
 *  - brand pink is the ONE accent (primary actions, active states, links)
 *  - semantic colours (success / warning / danger / info) appear only on status chips
 *  - surfaces are white cards on the app's soft gradient, with gray-100 borders
 *
 * Nothing here is clever; the point is that a button or a chip looks identical on the
 * product page, in the chat and on the orders screen.
 */

// ---------- Button ----------

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
    primary: 'bg-brand-600 text-white shadow-md shadow-brand-500/25 hover:bg-brand-700 active:bg-brand-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none',
    secondary: 'bg-white text-brand-700 border border-brand-200 hover:bg-brand-50 active:bg-brand-100 disabled:text-gray-400 disabled:border-gray-200 disabled:bg-white',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 disabled:text-gray-400',
    subtle: 'bg-gray-100 text-gray-800 hover:bg-gray-200 active:bg-gray-300 disabled:text-gray-400',
    danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
    sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
    md: 'h-11 px-4 text-sm gap-2 rounded-xl',
    lg: 'h-12 px-5 text-base gap-2 rounded-xl',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Leading icon (already sized by the caller, 16–20px). */
    icon?: React.ReactNode;
    loading?: boolean;
    block?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'primary', size = 'md', icon, loading = false, block = false, className = '', children, disabled, type = 'button', ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled || loading}
            className={`inline-flex items-center justify-center font-bold whitespace-nowrap select-none transition-colors duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:cursor-not-allowed ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${block ? 'w-full' : ''} ${className}`}
            {...rest}
        >
            {loading ? <Loader2 size={18} className="animate-spin flex-shrink-0" /> : icon ? <span className="flex-shrink-0 inline-flex">{icon}</span> : null}
            {children && <span className="truncate">{children}</span>}
        </button>
    );
});

/** Round icon-only button (header actions, composer tools). */
export const IconButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; size?: 'sm' | 'md' }>(function IconButton(
    { active = false, size = 'md', className = '', children, type = 'button', ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            className={`inline-flex items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:opacity-40 disabled:cursor-not-allowed ${size === 'sm' ? 'w-9 h-9' : 'w-10 h-10'} ${active ? 'bg-brand-50 text-brand-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'} ${className}`}
            {...rest}
        >
            {children}
        </button>
    );
});

// ---------- Chip (status / tag) ----------

export type ChipTone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const CHIP_TONE: Record<ChipTone, string> = {
    brand: 'bg-brand-50 text-brand-700',
    neutral: 'bg-gray-100 text-gray-600',
    success: 'bg-green-50 text-green-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    info: 'bg-blue-50 text-blue-700',
};

export const Chip: React.FC<{ tone?: ChipTone; icon?: React.ReactNode; className?: string; children: React.ReactNode; title?: string }> = ({
    tone = 'neutral', icon, className = '', children, title,
}) => (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold leading-none whitespace-nowrap ${CHIP_TONE[tone]} ${className}`}>
        {icon}
        {children}
    </span>
);

/** Small dot for the same tones (list rows). */
export const StatusDot: React.FC<{ tone: ChipTone; className?: string }> = ({ tone, className = '' }) => {
    const color: Record<ChipTone, string> = { brand: 'bg-brand-500', neutral: 'bg-gray-300', success: 'bg-green-500', warning: 'bg-amber-500', danger: 'bg-red-500', info: 'bg-blue-500' };
    return <span className={`inline-block w-2 h-2 rounded-full ${color[tone]} ${className}`} />;
};

// ---------- Surfaces ----------

/** White card on the app gradient. `padding` false when the content manages its own edges. */
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { padding?: boolean; interactive?: boolean }> = ({
    padding = true, interactive = false, className = '', children, ...rest
}) => (
    <div
        className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${padding ? 'p-4 sm:p-5' : ''} ${interactive ? 'transition-shadow hover:shadow-md cursor-pointer' : ''} ${className}`}
        {...rest}
    >
        {children}
    </div>
);

/** Square tinted icon holder used at the top-left of cards and rows. */
export const IconTile: React.FC<{ tone?: ChipTone; size?: 'sm' | 'md' | 'lg'; className?: string; children: React.ReactNode }> = ({
    tone = 'brand', size = 'md', className = '', children,
}) => {
    const dims = size === 'sm' ? 'w-8 h-8 rounded-lg' : size === 'lg' ? 'w-14 h-14 rounded-2xl' : 'w-10 h-10 rounded-xl';
    return <div className={`${dims} ${CHIP_TONE[tone]} flex items-center justify-center flex-shrink-0 ${className}`}>{children}</div>;
};

/** Uppercase eyebrow label above a value or section. */
export const Eyebrow: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
    <p className={`text-[11px] font-bold uppercase tracking-wider text-gray-400 ${className}`}>{children}</p>
);

/** Section heading inside a page. */
export const SectionTitle: React.FC<{ className?: string; children: React.ReactNode; action?: React.ReactNode }> = ({ className = '', children, action }) => (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
        <h2 className="text-base sm:text-lg font-bold text-gray-900">{children}</h2>
        {action}
    </div>
);

// ---------- Form ----------

export const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] text-gray-900 placeholder-gray-400 transition focus:outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:bg-gray-50 disabled:text-gray-400';

export const Field: React.FC<{ label?: React.ReactNode; hint?: React.ReactNode; error?: React.ReactNode; htmlFor?: string; className?: string; children: React.ReactNode }> = ({
    label, hint, error, htmlFor, className = '', children,
}) => (
    <div className={className}>
        {label && <label htmlFor={htmlFor} className="block text-sm font-bold text-gray-700 mb-1.5">{label}</label>}
        {children}
        {error ? <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : hint ? <p className="mt-1.5 text-xs text-gray-500">{hint}</p> : null}
    </div>
);

/** Segmented choice (dates, delivery type…). */
export const ChoiceChip: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }> = ({ selected, className = '', children, type = 'button', ...rest }) => (
    <button
        type={type}
        aria-pressed={selected}
        className={`rounded-xl border px-3 py-2 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 ${selected ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-700 hover:border-brand-200 hover:bg-brand-50/40'} ${className}`}
        {...rest}
    >
        {children}
    </button>
);

/** Empty state block. */
export const EmptyState: React.FC<{ icon: React.ReactNode; title: string; hint?: string; action?: React.ReactNode; className?: string }> = ({ icon, title, hint, action, className = '' }) => (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-14 ${className}`}>
        <IconTile tone="neutral" size="lg" className="mb-4 text-gray-400">{icon}</IconTile>
        <p className="font-bold text-gray-800">{title}</p>
        {hint && <p className="text-sm text-gray-500 mt-1 max-w-xs">{hint}</p>}
        {action && <div className="mt-5">{action}</div>}
    </div>
);
