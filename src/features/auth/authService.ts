import type { Session } from '@supabase/supabase-js';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/services/supabase';
import { api } from '@/lib/api/client';
import type { User } from '@/types';

export const DEEP_LINK_SCHEME = 'com.venya.marketplace://';

export const avatarFor = (seed: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;

export const isNativePlatform = (): boolean =>
    Capacitor.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:';

/** Build the app-level User from a Supabase session (no network). */
export const userFromSession = (session: Session | null | undefined): User | null => {
    if (!session?.user) return null;
    const { user } = session;
    return {
        id: user.id,
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        avatar: user.user_metadata?.avatar_url || avatarFor(user.id),
        isVerified: false,
    };
};

/** Mirror the auth user into public.users (used by chat & order notifications). */
export const syncUserProfile = async (user: Pick<User, 'id' | 'name' | 'avatar' | 'email'>): Promise<void> => {
    try {
        await api.post('/api/users/me', { name: user.name, avatar_url: user.avatar }, { auth: 'required' });
    } catch (error) {
        console.warn('[auth] Failed to sync user to public.users:', error);
    }
};

/** Persist the user's IP-derived location server side (best effort). */
export const updateUserLocationOnServer = async (user: Pick<User, 'country' | 'city'>): Promise<void> => {
    if (!user.country || !user.city) return;
    try {
        await api.post('/api/users/update-location', { country: user.country, city: user.city, countryName: user.country }, { auth: 'required' });
    } catch (error) {
        console.error('[auth] Failed to update user location:', error);
    }
};

/** Parse `access_token` / `refresh_token` from an OAuth callback URL hash. */
export const parseOAuthHash = (url: string): { accessToken: string; refreshToken: string } | null => {
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) return null;
    const params = new URLSearchParams(url.substring(hashIndex + 1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    return accessToken && refreshToken ? { accessToken, refreshToken } : null;
};

/** Exchange OAuth hash tokens for a Supabase session. Returns the session or null. */
export const completeOAuthFromUrl = async (url: string): Promise<Session | null> => {
    const tokens = parseOAuthHash(url);
    if (!tokens) return null;
    const { data, error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
    });
    if (error) throw error;
    return data.session;
};

/** Start Google OAuth; opens the system browser on native, redirects on web. */
export const signInWithGoogle = async (): Promise<void> => {
    const native = isNativePlatform();
    const redirectTo = native ? DEEP_LINK_SCHEME : window.location.origin;

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: native },
    });
    if (error) throw error;

    if (native && data?.url) {
        await Browser.open({ url: data.url });
    }
};

export const signOut = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
};

export const updateProfile = async (user: User): Promise<void> => {
    const { error } = await supabase.auth.updateUser({
        data: { full_name: user.name, avatar_url: user.avatar },
    });
    if (error) throw error;
    await syncUserProfile(user);
};
