import React from 'react';
import { Trophy, Medal, Award, Shield, Sprout } from 'lucide-react';
import { useLanguage } from '@/i18n';

interface CreditBadgeProps {
    score: number;
    size?: 'sm' | 'md' | 'lg';
    /** Show the level name next to the icon (profile header). */
    showLabel?: boolean;
    /** Show the numeric score (profile header); off by default in lists and cards. */
    showScore?: boolean;
}

type Level = { key: string; icon: React.ElementType; className: string };

/** Level thresholds; the score itself is an internal number, the level is what people see. */
export const creditLevel = (score: number): Level => {
    if (score >= 500) return { key: 'credit.level.diamond', icon: Trophy, className: 'bg-blue-50 text-blue-700' };
    if (score >= 300) return { key: 'credit.level.gold', icon: Medal, className: 'bg-amber-50 text-amber-700' };
    if (score >= 100) return { key: 'credit.level.silver', icon: Award, className: 'bg-gray-100 text-gray-700' };
    if (score >= 50) return { key: 'credit.level.bronze', icon: Shield, className: 'bg-orange-50 text-orange-700' };
    return { key: 'credit.level.new', icon: Sprout, className: 'bg-green-50 text-green-700' };
};

const SIZE = {
    sm: { icon: 12, text: 'text-[11px]', pad: 'h-5 px-1.5' },
    md: { icon: 14, text: 'text-xs', pad: 'h-6 px-2' },
    lg: { icon: 16, text: 'text-sm', pad: 'h-7 px-2.5' },
};

/** Seller reputation level as a small chip: icon + level name (+ score when asked). */
export const CreditBadge: React.FC<CreditBadgeProps> = ({ score, size = 'sm', showLabel = false, showScore = false }) => {
    const { t } = useLanguage();
    const level = creditLevel(score);
    const Icon = level.icon;
    const s = SIZE[size];
    const label = t(level.key);
    return (
        <span className={`inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap ${level.className} ${s.pad} ${s.text}`} title={`${label} · ${score}`}>
            <Icon size={s.icon} />
            {(showLabel || !showScore) && <span>{label}</span>}
            {showScore && <span className="opacity-70 tabular-nums">{score}</span>}
        </span>
    );
};
