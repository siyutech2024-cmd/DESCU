import { Request } from 'express';
import { errorMessages, SupportedLanguage } from '../i18n/messages.js';

/**
 * Extract user's preferred language from request headers
 * Priority: Accept-Language header -> Default (es)
 */
export const getLanguage = (req: Request): SupportedLanguage => {
    try {
        // Check Accept-Language header
        const langHeader = req.headers['accept-language'];

        if (langHeader) {
            const primaryLang = langHeader.split(',')[0].split('-')[0].toLowerCase();

            if (primaryLang === 'zh') return 'zh';
            if (primaryLang === 'en') return 'en';
            if (primaryLang === 'es') return 'es';
        }

        // Default to Spanish (primary market)
        return 'es';
    } catch (error) {
        console.warn('Failed to detect language:', error);
        return 'es';
    }
};

/**
 * Translate error message key to user's language
 * @param req - Express request object
 * @param key - Message key from errorMessages
 * @param fallback - Optional fallback message if key not found
 */
export const t = (req: Request, key: string, fallback?: string): string => {
    const lang = getLanguage(req);
    const message = errorMessages[lang]?.[key];

    if (message) {
        return message;
    }

    // Log missing translation key for debugging
    console.warn(`Missing translation for key: ${key} in language: ${lang}`);

    // Return fallback or the key itself
    return fallback || key;
};

/**
 * Create a localized error response object
 * @param req - Express request object
 * @param key - Message key from errorMessages
 * @param fallback - Optional fallback message
 */
export const errorResponse = (req: Request, key: string, fallback?: string) => {
    return {
        error: t(req, key, fallback)
    };
};

/**
 * Create a localized message response object
 * @param req - Express request object
 * @param key - Message key from errorMessages
 * @param fallback - Optional fallback message
 */
export const messageResponse = (req: Request, key: string, fallback?: string) => {
    return {
        message: t(req, key, fallback)
    };
};
