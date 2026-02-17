import React from 'react';
import { supabase } from '../services/supabase';
import { Browser } from '@capacitor/browser';
import { Mail, LogOut } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface AuthButtonProps {
    onAuthChange?: (user: any) => void;
}

export const AuthButton: React.FC<AuthButtonProps> = ({ onAuthChange }) => {
    const { t } = useLanguage();
    const [user, setUser] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            onAuthChange?.(session?.user ?? null);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            onAuthChange?.(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, [onAuthChange]);

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);

            const isCapacitor = window.location.protocol === 'capacitor:' ||
                window.location.protocol === 'ionic:' ||
                (window as any).Capacitor?.isNativePlatform?.();

            const redirectUrl = isCapacitor
                ? 'com.venya.marketplace://'
                : window.location.origin;

            if (isCapacitor) {
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: redirectUrl,
                        skipBrowserRedirect: true,
                    },
                });

                if (error) throw error;
                if (data?.url) {
                    await Browser.open({ url: data.url });
                }
            } else {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: redirectUrl,
                    },
                });
                if (error) throw error;
            }
        } catch (error) {
            console.error('Login failed:', error);
            alert(t('auth.login_failed'));
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    if (user) {
        return (
            <div className="flex items-center gap-3">
                <img
                    src={user.user_metadata?.avatar_url || '/default-avatar.png'}
                    alt={user.user_metadata?.full_name || 'User'}
                    className="w-8 h-8 rounded-full"
                />
                <span className="text-sm font-medium text-gray-700 hidden sm:inline">
                    {user.user_metadata?.full_name || user.email}
                </span>
                <button
                    onClick={handleLogout}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-600"
                    title={t('auth.logout')}
                >
                    <LogOut size={20} />
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
            <Mail size={20} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
                {loading ? t('auth.logging_in') : t('auth.login_google')}
            </span>
        </button>
    );
};
