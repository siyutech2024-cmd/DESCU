
import React, { useEffect, useState } from 'react';
import { useRegion } from '../contexts/RegionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Check, Globe } from 'lucide-react';

export const OnboardingModal: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const { setRegion, region } = useRegion();
    const { t } = useLanguage();

    useEffect(() => {
        // Check if this is the first launch
        const hasOnboarded = localStorage.getItem('has_onboarded');
        if (!hasOnboarded) {
            setIsVisible(true);
        }
    }, []);

    const handleSelectRegion = (selectedRegion: string) => {
        setRegion(selectedRegion as any);
        localStorage.setItem('has_onboarded', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    const regions = [
        { id: 'MX', label: 'Mexico', sub: 'Español • MXN', flag: '🇲🇽', bg: 'from-green-50 to-green-100', border: 'border-green-200' },
        { id: 'US', label: 'USA', sub: 'English • USD', flag: '🇺🇸', bg: 'from-blue-50 to-blue-100', border: 'border-blue-200' },
        { id: 'CN', label: 'China', sub: '中文 • CNY', flag: '🇨🇳', bg: 'from-red-50 to-red-100', border: 'border-red-200' },
        { id: 'EU', label: 'Europe', sub: 'English • EUR', flag: '🇪🇺', bg: 'from-indigo-50 to-indigo-100', border: 'border-indigo-200' },
        { id: 'JP', label: 'Japan', sub: 'English • JPY', flag: '🇯🇵', bg: 'from-pink-50 to-pink-100', border: 'border-pink-200' },
        { id: 'Global', label: 'Global', sub: 'English • USD', flag: '🌍', bg: 'from-gray-50 to-gray-100', border: 'border-gray-200' },
    ];

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
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
                        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Welcome to DESCU</h2>
                        <p className="text-brand-100 text-sm font-medium">Select your region to get started</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="grid grid-cols-2 gap-3">
                        {regions.map((r) => (
                            <button
                                key={r.id}
                                onClick={() => handleSelectRegion(r.id)}
                                className={`relative group p-4 rounded-2xl border-2 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-95 ${r.border} bg-gradient-to-br ${r.bg}`}
                            >
                                <div className="text-3xl mb-2 filter drop-shadow-sm group-hover:scale-110 transition-transform origin-left">{r.flag}</div>
                                <div className="font-bold text-gray-900 leading-tight">{r.label}</div>
                                <div className="text-[10px] font-bold text-gray-500 opacity-80 uppercase tracking-wide mt-1">{r.sub}</div>

                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                                    <Check size={16} />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                    <p className="text-xs text-gray-400">You can change this anytime in Settings</p>
                </div>
            </div>
        </div>
    );
};
