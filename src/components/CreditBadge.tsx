import React from 'react';
import { Trophy, Medal, Award, Shield } from 'lucide-react';

interface CreditBadgeProps {
    score: number;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

export const CreditBadge: React.FC<CreditBadgeProps> = ({ score, size = 'sm', showLabel = false }) => {
    // Logic based on score
    let level = 'Newcomer';
    let Icon = Shield;
    let color = 'text-gray-400';
    let bg = 'bg-gray-50';

    if (score >= 500) {
        level = 'Diamond';
        Icon = Trophy;
        color = 'text-blue-500';
        bg = 'bg-blue-50';
    } else if (score >= 300) {
        level = 'Gold';
        Icon = Medal;
        color = 'text-yellow-500';
        bg = 'bg-yellow-50';
    } else if (score >= 100) {
        level = 'Silver';
        Icon = Award;
        color = 'text-gray-500';
        bg = 'bg-gray-100';
    } else if (score >= 50) {
        level = 'Bronze';
        Icon = Shield; // Bronze Shield
        color = 'text-orange-600';
        bg = 'bg-orange-50';
    }

    const sizeClasses = {
        sm: { icon: 14, text: 'text-xs', padding: 'px-1.5 py-0.5' },
        md: { icon: 18, text: 'text-sm', padding: 'px-2 py-1' },
        lg: { icon: 24, text: 'text-base', padding: 'px-3 py-1.5' }
    };

    const s = sizeClasses[size];

    return (
        <div className={`inline-flex items-center gap-1 rounded-full border border-transparent ${bg} ${s.padding}`} title={`Credit Score: ${score}`}>
            <Icon size={s.icon} className={color} fill="currentColor" fillOpacity={0.2} />
            {showLabel && <span className={`font-bold ${color} ${s.text}`}>{level}</span>}
            <span className={`text-xs font-semibold ${color} opacity-75`}>({score})</span>
        </div>
    );
};
