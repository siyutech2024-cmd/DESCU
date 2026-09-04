import type { Language } from '@/types';
import { useLanguage } from './LanguageProvider';

/** BCP-47 locale for the app language — dates/numbers must follow the UI language, not the browser's. */
export const localeFor = (language: Language | string): string =>
    language === 'zh' ? 'zh-CN' : language === 'en' ? 'en-US' : 'es-MX';

export const useLocale = (): string => localeFor(useLanguage().language);
