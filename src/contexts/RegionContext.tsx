
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Region, Currency, Language } from '../types';

interface RegionContextType {
    region: Region;
    setRegion: (region: Region) => void;
    currency: Currency;
    convertPrice: (price: number, fromCurrency: string) => { price: number; currency: Currency };
    formatCurrency: (price: number, currency: string) => string;
}

const RegionContext = createContext<RegionContextType | undefined>(undefined);

// Static Exchange Rates (Base: USD)
// TODO: Fetch from API in production
const EXCHANGE_RATES: Record<string, number> = {
    USD: 1,
    MXN: 20.5,
    CNY: 7.2,
    EUR: 0.92,
    JPY: 150,
};

export interface RegionInfo {
    currency: Currency;
    flag: string;
    /** Short English label (used in compact UI such as the home "deliver to" pill). */
    label: string;
    /** Native / display name shown in region pickers. */
    name: string;
}

export const REGION_CONFIG: Record<Region, RegionInfo> = {
    MX: { currency: 'MXN', flag: '🇲🇽', label: 'Mexico', name: 'México' },
    US: { currency: 'USD', flag: '🇺🇸', label: 'USA', name: 'United States' },
    CN: { currency: 'CNY', flag: '🇨🇳', label: 'China', name: '中国' },
    EU: { currency: 'EUR', flag: '🇪🇺', label: 'Europe', name: 'Europe' },
    JP: { currency: 'JPY', flag: '🇯🇵', label: 'Japan', name: '日本' },
    Global: { currency: 'USD', flag: '🌍', label: 'Global', name: 'Global' },
};

/** Ordered list of selectable regions — the single source for region pickers. */
export const REGIONS: ReadonlyArray<RegionInfo & { code: Region }> = (Object.keys(REGION_CONFIG) as Region[]).map(code => ({
    code,
    ...REGION_CONFIG[code],
}));

import { useLanguage } from '@/i18n';

/** Language a region maps to when the user actively switches region. */
export const REGION_LANGUAGE: Record<Region, Language> = {
    CN: 'zh',
    US: 'en',
    EU: 'en',
    JP: 'en',
    Global: 'en',
    MX: 'es',
};

export const RegionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { setLanguage } = useLanguage();
    const [region, setRegionState] = useState<Region>(() => {
        const saved = localStorage.getItem('app_region') as Region;
        return (saved && REGION_CONFIG[saved]) ? saved : 'MX';
    });

    useEffect(() => {
        localStorage.setItem('app_region', region);
    }, [region]);

    // Only sync language when the user actively changes the region.
    // The initial mount/hydration must NOT override the persisted `app_language`.
    const setRegion = useCallback((next: Region) => {
        setRegionState(next);
        setLanguage(REGION_LANGUAGE[next]);
    }, [setLanguage]);

    const currency = REGION_CONFIG[region].currency;

    const convertPrice = (price: number, fromCurrency: string): { price: number; currency: Currency } => {
        const targetCurrency = currency;

        // If same currency, no conversion
        if (fromCurrency === targetCurrency) {
            return { price, currency: targetCurrency };
        }

        // Convert to USD first (Base)
        const fromRate = EXCHANGE_RATES[fromCurrency] || 1;
        const priceInUsd = price / fromRate;

        // Convert to Target
        const toRate = EXCHANGE_RATES[targetCurrency] || 1;
        const finalPrice = priceInUsd * toRate;

        return {
            price: Math.round(finalPrice), // Round to integer for simplicity in MVP
            currency: targetCurrency
        };
    };

    const formatCurrency = (price: number, curr: string) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: curr,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price);
    };

    return (
        <RegionContext.Provider value={{ region, setRegion, currency, convertPrice, formatCurrency }}>
            {children}
        </RegionContext.Provider>
    );
};

export const useRegion = () => {
    const context = useContext(RegionContext);
    if (!context) {
        throw new Error('useRegion must be used within a RegionProvider');
    }
    return context;
};
