import React, { useEffect, useState } from 'react';
import { useRegion, REGIONS, REGION_LANGUAGE } from '../contexts/RegionContext';
import { useLanguage } from '@/i18n';
import type { Language, Region } from '../types';
import { Check, Globe } from 'lucide-react';
import { Sheet } from './ui/Sheet';

/** Native language names for the per-region subtitle ("Español • MXN"). */
const LANGUAGE_NAMES: Record<Language, string> = {
    es: 'Español',
    en: 'English',
    zh: '中文',
};

export const OnboardingModal: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const { setRegion } = useRegion();
    const { t } = useLanguage();

    useEffect(() => {
        // Check if this is the first launch
        let hasOnboarded: string | null = null;
        try {
            hasOnboarded = localStorage.getItem('has_onboarded');
        } catch {
            /* storage unavailable */
        }
        if (!hasOnboarded) {
            setIsVisible(true);
        }
    }, []);

    const handleSelectRegion = (selectedRegion: Region) => {
        setRegion(selectedRegion);
        try {
            localStorage.setItem('has_onboarded', 'true');
        } catch {
            /* storage unavailable */
        }
        setIsVisible(false);
    };

    return (
        <Sheet
            open={isVisible}
            onClose={() => { /* mandatory flow: not dismissible */ }}
            dismissible={false}
            hideClose
            layer="modal-top"
            labelledBy="onboarding-title"
            className="max-w-md"
            bodyClassName="p-0"
        >
            <div className="bg-brand-600 px-6 pt-8 pb-7 text-center text-white">
                <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-white/20">
                    <Globe size={28} />
                </div>
                <h2 id="onboarding-title" className="text-2xl font-black tracking-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>{t('onboarding.title')}</h2>
                <p className="text-brand-100 text-sm font-medium mt-1.5">{t('onboarding.subtitle')}</p>
            </div>

            <div className="p-5">
                <div className="grid grid-cols-2 gap-2.5">
                    {REGIONS.map((r) => {
                        const sub = `${LANGUAGE_NAMES[REGION_LANGUAGE[r.code]]} · ${r.currency}`;
                        return (
                            <button
                                key={r.code}
                                type="button"
                                onClick={() => handleSelectRegion(r.code)}
                                className="group flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50 active:bg-brand-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
                            >
                                <span className="text-2xl leading-none">{r.flag}</span>
                                <span className="min-w-0">
                                    <span className="block font-bold text-gray-900 leading-tight truncate">{r.name}</span>
                                    <span className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mt-0.5">{sub}</span>
                                </span>
                                <Check size={16} className="ml-auto text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </button>
                        );
                    })}
                </div>
                <p className="mt-4 text-center text-xs text-gray-400">{t('onboarding.change_later')}</p>
            </div>
        </Sheet>
    );
};
