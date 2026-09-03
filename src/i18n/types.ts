import type { Language } from '@/types';

export type TranslationTable = Record<string, string>;

export interface LanguageContextValue {
    language: Language;
    setLanguage: (lang: Language) => void;
    /** Translate a key; falls back to the key itself when missing. */
    t: (key: string) => string;
    formatPrice: (price: number) => string;
}
