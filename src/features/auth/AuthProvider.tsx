import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/services/supabase';
import { getLocationFromIP } from '@/services/locationService';
import type { User } from '@/types';
import { notify } from '@/lib/toast';
import { useLanguage } from '@/i18n';
import {
    userFromSession,
    syncUserProfile,
    updateUserLocationOnServer,
    completeOAuthFromUrl,
    signInWithGoogle,
    signOut as signOutService,
    updateProfile,
} from './authService';

export interface AuthContextValue {
    user: User | null;
    /** True until the initial session lookup has completed. */
    isInitialising: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    markVerified: () => void;
    /** Login modal state — shared so any feature can prompt for sign-in. */
    isLoginModalOpen: boolean;
    openLoginModal: () => void;
    closeLoginModal: () => void;
    /** Run `action` if signed in, otherwise open the login modal. */
    requireUser: (action: (user: User) => void) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { t } = useLanguage();
    const [user, setUser] = useState<User | null>(null);
    const [isInitialising, setIsInitialising] = useState(true);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const userRef = useRef<User | null>(null);
    userRef.current = user;
    /** Ids already enriched with profile sync + IP location (avoids duplicate work when
     *  both init() and onAuthStateChange fire for the same session). */
    const enrichedIds = useRef(new Set<string>());

    /** Set the fast, network-free user, then enrich with profile sync + IP location. */
    const applySession = useCallback((session: Session | null | undefined) => {
        const base = userFromSession(session);
        if (!base) return;
        setUser(prev => (prev && prev.id === base.id ? { ...base, ...prev, name: base.name, avatar: base.avatar } : base));

        if (enrichedIds.current.has(base.id)) return;
        enrichedIds.current.add(base.id);

        (async () => {
            await syncUserProfile(base);
            try {
                const location = await getLocationFromIP();
                if (location) {
                    const enriched: User = { ...base, country: location.country, city: location.city };
                    // Preserve any edits made while the lookup was in flight.
                    setUser(prev => (prev && prev.id === base.id ? { ...prev, country: location.country, city: location.city } : enriched));
                    updateUserLocationOnServer(enriched);
                }
            } catch (error) {
                console.error('[auth] Failed to get IP location:', error);
            }
        })();
    }, []);

    useEffect(() => {
        let cancelled = false;

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (cancelled) return;
            if (session?.user) {
                applySession(session);
            } else if (event === 'SIGNED_OUT') {
                enrichedIds.current.clear();
                setUser(null);
            }
        });

        const init = async () => {
            try {
                // `detectSessionInUrl` is disabled on the client, so OAuth hashes are handled here.
                if (window.location.hash.includes('access_token')) {
                    const session = await completeOAuthFromUrl(window.location.href);
                    if (session) applySession(session);
                    window.history.replaceState(null, '', window.location.pathname);
                } else {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) applySession(session);
                }
            } catch (error) {
                console.warn('[auth] Session initialisation error:', error);
            } finally {
                if (!cancelled) setIsInitialising(false);
            }
        };
        init();

        // Native deep-link OAuth callback (Capacitor)
        const listener = CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
            if (!url.includes('access_token')) return;
            try {
                await completeOAuthFromUrl(url); // onAuthStateChange applies the user
            } catch (error) {
                console.error('[auth] Deep link OAuth error:', error);
            } finally {
                try { await Browser.close(); } catch { /* browser already closed */ }
            }
        });

        return () => {
            cancelled = true;
            subscription.unsubscribe();
            listener.then(handle => handle.remove()).catch(() => undefined);
        };
    }, [applySession]);

    const login = useCallback(async () => {
        try {
            await signInWithGoogle();
            setIsLoginModalOpen(false);
        } catch (error) {
            console.error('[auth] Login failed:', error);
            notify.error(t('toast.login_failed'));
        }
    }, [t]);

    const logout = useCallback(async () => {
        await signOutService();
        setUser(null);
    }, []);

    const updateUser = useCallback(async (updated: User) => {
        try {
            await updateProfile(updated);
            // Only name/avatar change here; keep country/city from the IP lookup.
            setUser(prev => (prev ? { ...prev, name: updated.name, avatar: updated.avatar } : updated));
            notify.success(t('toast.profile_updated'));
        } catch (error) {
            console.error('[auth] Update profile failed:', error);
            notify.error(t('toast.update_failed'));
        }
    }, [t]);

    const markVerified = useCallback(() => {
        setUser(prev => (prev ? { ...prev, isVerified: true } : prev));
    }, []);

    const openLoginModal = useCallback(() => setIsLoginModalOpen(true), []);
    const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

    const requireUser = useCallback((action: (user: User) => void) => {
        const current = userRef.current;
        if (current) action(current);
        else setIsLoginModalOpen(true);
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({ user, isInitialising, login, logout, updateUser, markVerified, isLoginModalOpen, openLoginModal, closeLoginModal, requireUser }),
        [user, isInitialising, login, logout, updateUser, markVerified, isLoginModalOpen, openLoginModal, closeLoginModal, requireUser]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
};
