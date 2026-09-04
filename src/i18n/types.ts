import type { Language } from '@/types';

export type TranslationTable = Record<string, string>;

export type TranslationParams = Record<string, string | number>;

export interface LanguageContextValue {
    language: Language;
    setLanguage: (lang: Language) => void;
    /**
     * Translate a key, replacing `{name}` tokens with `params`.
     * Missing keys: DEV → `[key]` (+ console.warn once); PROD → English string, else the key.
     */
    t: (key: string, params?: TranslationParams) => string;
    formatPrice: (price: number) => string;
}
