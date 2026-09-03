import type { Language } from '@/types';
import type { TranslationTable } from '../types';
import { zh } from './zh';
import { en } from './en';
import { es } from './es';

export const translations: Record<Language, TranslationTable> = { zh, en, es };

export const SUPPORTED_LANGUAGES: Language[] = ['zh', 'en', 'es'];
export const DEFAULT_LANGUAGE: Language = 'es';
