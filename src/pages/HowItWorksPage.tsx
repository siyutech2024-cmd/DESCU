import React from 'react';
import { ArrowLeft, Camera, MessageCircle, ShieldCheck, Truck, Search, CreditCard, PackageCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n';
import { useBackNavigation } from '@/lib/useBackNavigation';
import { useSEO } from '@/hooks/useSEO';
// Single source of truth for the "how it works" copy, shared with the bot prerender (api/prerender.ts).
import { howItWorksContent } from '../../api/_lib/seo/site';
import type { Language } from '@/types';

const SELL_ICONS = [Camera, Sparkles, MessageCircle, ShieldCheck];
const BUY_ICONS = [Search, MessageCircle, CreditCard, PackageCheck];

const BACK_LABEL: Record<Language, string> = { es: 'Volver', en: 'Back', zh: '返回' };
const CTA: Record<Language, { sell: string; browse: string }> = {
    es: { sell: 'Vender algo', browse: 'Ver artículos' },
    en: { sell: 'Sell something', browse: 'Browse items' },
    zh: { sell: '出售物品', browse: '浏览商品' },
};

/**
 * /como-funciona — how selling, buying, fees and protection work, with the FAQ.
 * The same content is served to crawlers as static HTML with HowTo + FAQPage JSON-LD.
 */
export const HowItWorksPage: React.FC<{ onSellClick: () => void }> = ({ onSellClick }) => {
    const { language } = useLanguage();
    const goBack = useBackNavigation('/');
    const navigate = useNavigate();
    const c = howItWorksContent(language);

    useSEO({ title: c.metaTitle, description: c.metaDesc });

    const Steps: React.FC<{ steps: { name: string; text: string }[]; icons: React.ElementType[] }> = ({ steps, icons }) => (
        <ol className="grid gap-4 sm:grid-cols-2">
            {steps.map((s, i) => {
                const Icon = icons[i] ?? Sparkles;
                return (
                    <li key={s.name} className="flex gap-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-5">
                        <div className="w-11 h-11 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0">
                            <Icon size={22} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-brand-600 uppercase tracking-wide mb-0.5">{i + 1}</p>
                            <h3 className="font-bold text-gray-900 mb-1">{s.name}</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">{s.text}</p>
                        </div>
                    </li>
                );
            })}
        </ol>
    );

    return (
        <main className="max-w-4xl mx-auto px-4 py-6 sm:py-10 w-full">
            <button onClick={goBack} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 font-medium">
                <ArrowLeft size={18} /> {BACK_LABEL[language]}
            </button>

            <header className="mb-8">
                <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-3">{c.title}</h1>
                <p className="text-gray-600 leading-relaxed max-w-2xl">{c.intro}</p>
            </header>

            <section className="mb-10" aria-labelledby="how-sell">
                <h2 id="how-sell" className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2"><Camera size={20} className="text-brand-600" /> {c.sellHeading}</h2>
                <Steps steps={c.sellSteps} icons={SELL_ICONS} />
            </section>

            <section className="mb-10" aria-labelledby="how-buy">
                <h2 id="how-buy" className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2"><Truck size={20} className="text-brand-600" /> {c.buyHeading}</h2>
                <Steps steps={c.buySteps} icons={BUY_ICONS} />
            </section>

            <section className="mb-10" aria-labelledby="how-faq">
                <h2 id="how-faq" className="text-xl font-bold text-gray-900 mb-4">{c.faqHeading}</h2>
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 divide-y divide-gray-100">
                    {c.faq.map(f => (
                        <details key={f.q} className="group p-5">
                            <summary className="cursor-pointer list-none font-bold text-gray-900 flex justify-between items-center gap-3">
                                {f.q}
                                <span className="text-brand-600 transition-transform group-open:rotate-45 text-xl leading-none" aria-hidden="true">+</span>
                            </summary>
                            <p className="text-sm text-gray-600 leading-relaxed mt-3">{f.a}</p>
                        </details>
                    ))}
                </div>
            </section>

            <div className="flex flex-col sm:flex-row gap-3 pb-8">
                <button onClick={onSellClick} className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-lg shadow-brand-500/30 transition-colors">
                    {CTA[language].sell}
                </button>
                <button onClick={() => navigate('/')} className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-800 font-bold hover:bg-gray-50 transition-colors">
                    {CTA[language].browse}
                </button>
            </div>
        </main>
    );
};
