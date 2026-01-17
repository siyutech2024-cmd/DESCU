
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Region, Currency } from '../types';

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

const REGION_CONFIG: Record<Region, { currency: Currency; flag: string; label: string }> = {
    MX: { currency: 'MXN', flag: '🇲🇽', label: 'Mexico' },
    US: { currency: 'USD', flag: '🇺🇸', label: 'USA' },
    CN: { currency: 'CNY', flag: '🇨🇳', label: 'China' },
    EU: { currency: 'EUR', flag: '🇪🇺', label: 'Europe' },
    JP: { currency: 'JPY', flag: '🇯🇵', label: 'Japan' },
    Global: { currency: 'USD', flag: '🌍', label: 'Global' },
};

import { useLanguage } from './LanguageContext';

export const RegionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { setLanguage } = useLanguage();
    const [region, setRegion] = useState<Region>(() => {
        const saved = localStorage.getItem('app_region') as Region;
        return (saved && REGION_CONFIG[saved]) ? saved : 'MX';
    });

    useEffect(() => {
        localStorage.setItem('app_region', region);

        // Auto-sync Language with Region
        switch (region) {
            case 'CN':
                setLanguage('zh');
                break;
            case 'US':
            case 'EU':
            case 'JP':
            case 'Global':
                setLanguage('en');
                break;
            case 'MX':
                setLanguage('es');
                break;
        }
    }, [region]);

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
