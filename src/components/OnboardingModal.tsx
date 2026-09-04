import React, { useEffect, useState } from 'react';
import { useRegion, REGIONS, REGION_LANGUAGE } from '../contexts/RegionContext';
import { useLanguage } from '@/i18n';
import type { Language, Region } from '../types';
import { Check, Globe } from 'lucide-react';

/** Native language names for the per-region subtitle ("Español • MXN"). */
const LANGUAGE_NAMES: Record<Language, string> = {
    es: 'Español',
    en: 'English',
    zh: '中文',
};

/** Decorative card colours per region (presentation only). */
const REGION_STYLES: Record<Region, { bg: string; border: string }> = {
    MX: { bg: 'from-green-50 to-green-100', border: 'border-green-200' },
    US: { bg: 'from-blue-50 to-blue-100', border: 'border-blue-200' },
    CN: { bg: 'from-red-50 to-red-100', border: 'border-red-200' },
    EU: { bg: 'from-indigo-50 to-indigo-100', border: 'border-indigo-200' },
    JP: { bg: 'from-pink-50 to-pink-100', border: 'border-pink-200' },
    Global: { bg: 'from-gray-50 to-gray-100', border: 'border-gray-200' },
};

const DEFAULT_STYLE = REGION_STYLES.Global;

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

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in" />

            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up">
                {/* Decorative Header */}
                <div className="bg-gradient-to-r from-brand-600 to-brand-500 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-lg rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner ring-1 ring-white/30">
                            <Globe size={32} className="text-white" />
                        </div>
                        <h2 id="onboarding-title" className="text-2xl font-black text-white mb-2 tracking-tight">{t('onboarding.title')}</h2>
                        <p className="text-brand-100 text-sm font-medium">{t('onboarding.subtitle')}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="grid grid-cols-2 gap-3">
                        {REGIONS.map((r) => {
                            const style = REGION_STYLES[r.code] ?? DEFAULT_STYLE;
                            const sub = `${LANGUAGE_NAMES[REGION_LANGUAGE[r.code]]} • ${r.currency}`;
                            return (
                                <button
                                    key={r.code}
                                    type="button"
                                    onClick={() => handleSelectRegion(r.code)}
                                    className={`relative group p-4 rounded-2xl border-2 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-95 ${style.border} bg-gradient-to-br ${style.bg}`}
                                >
                                    <div className="text-3xl mb-2 filter drop-shadow-sm group-hover:scale-110 transition-transform origin-left">{r.flag}</div>
                                    <div className="font-bold text-gray-900 leading-tight">{r.name}</div>
                                    <div className="text-[10px] font-bold text-gray-500 opacity-80 uppercase tracking-wide mt-1">{sub}</div>

                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                                        <Check size={16} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                    <p className="text-xs text-gray-400">{t('onboarding.change_later')}</p>
                </div>
            </div>
        </div>
    );
};
