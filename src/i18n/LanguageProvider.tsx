import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import type { Language } from '@/types';
import type { LanguageContextValue, TranslationParams } from './types';
import { translations, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './locales';

const STORAGE_KEY = 'app_language';

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const warnedKeys = new Set<string>();

/**
 * Resolve a key for the given language.
 * - DEV: warn once per missing key and return `[key]` so gaps are visible in the UI.
 * - PROD: fall back to the English string when present, else the raw key.
 */
const resolveTranslation = (language: Language, key: string): string => {
    const value = translations[language][key];
    if (value !== undefined) return value;

    if (import.meta.env.DEV) {
        if (!warnedKeys.has(key)) {
            warnedKeys.add(key);
            console.warn(`[i18n] Missing translation for "${key}" (${language})`);
        }
        return `[${key}]`;
    }

    return translations.en[key] ?? key;
};

/** Replace `{name}` tokens with values from `params`. Unknown tokens are left untouched. */
const interpolate = (text: string, params?: TranslationParams): string => {
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in params ? String(params[name]) : match
    );
};

const isLanguage = (value: unknown): value is Language =>
    typeof value === 'string' && (SUPPORTED_LANGUAGES as string[]).includes(value);

/** Resolve the initial language: saved preference → browser language → default. */
const detectInitialLanguage = (): Language => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (isLanguage(saved)) return saved;
    } catch {
        /* storage unavailable */
    }

    if (typeof navigator !== 'undefined') {
        const browserLang = navigator.language.toLowerCase();
        const match = SUPPORTED_LANGUAGES.find(lang => browserLang.startsWith(lang));
        if (match) return match;
    }

    return DEFAULT_LANGUAGE;
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>(detectInitialLanguage);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, language);
        } catch {
            /* storage unavailable */
        }
    }, [language]);

    const t = useCallback(
        (key: string, params?: TranslationParams): string => interpolate(resolveTranslation(language, key), params),
        [language]
    );

    const formatPrice = useCallback(
        (price: number) => (language === 'zh' ? `¥${price.toLocaleString()}` : `$${price.toLocaleString()}`),
        [language]
    );

    const value = useMemo(() => ({ language, setLanguage, t, formatPrice }), [language, t, formatPrice]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextValue => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
