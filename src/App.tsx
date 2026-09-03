import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProviders } from '@/app/AppProviders';
import { MarketplaceApp } from '@/app/MarketplaceApp';
import { PageLoader } from '@/app/PageLoader';

// The back-office is a separate bundle (recharts, xlsx, …) — never shipped to shoppers.
const AdminApp = React.lazy(() => import('@/admin/AdminApp').then(m => ({ default: m.AdminApp })));

/**
 * Root component.
 *  /admin/*  → back-office (own layout, auth and toaster)
 *  /*        → consumer marketplace
 */
const App: React.FC = () => (
    <BrowserRouter>
        <Routes>
            <Route
                path="/admin/*"
                element={
                    <React.Suspense fallback={<PageLoader />}>
                        <AdminApp />
                    </React.Suspense>
                }
            />
            <Route
                path="/*"
                element={
                    <AppProviders>
                        <MarketplaceApp />
                    </AppProviders>
                }
            />
        </Routes>
    </BrowserRouter>
);

export default App;
