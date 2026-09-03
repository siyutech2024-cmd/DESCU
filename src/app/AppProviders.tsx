import React, { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LanguageProvider } from '@/i18n';
import { RegionProvider } from '@/contexts/RegionContext';
import { AuthProvider } from '@/features/auth';
import { queryClient } from '@/lib/queryClient';

/**
 * Global provider stack for the marketplace.
 * Order matters: RegionProvider syncs language, AuthProvider uses translations.
 */
export const AppProviders: React.FC<{ children: ReactNode }> = ({ children }) => (
    <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
            <LanguageProvider>
                <RegionProvider>
                    <AuthProvider>
                        {children}
                        <Toaster position="top-center" containerStyle={{ zIndex: 100 }} />
                    </AuthProvider>
                </RegionProvider>
            </LanguageProvider>
        </QueryClientProvider>
    </ErrorBoundary>
);
