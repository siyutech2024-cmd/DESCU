import React from 'react';
import { supabase } from '../services/supabase';
import { Browser } from '@capacitor/browser';
import { Mail, LogOut } from 'lucide-react';

interface AuthButtonProps {
    onAuthChange?: (user: any) => void;
}

export const AuthButton: React.FC<AuthButtonProps> = ({ onAuthChange }) => {
    const [user, setUser] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        // 检查当前登录状态
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            onAuthChange?.(session?.user ?? null);
        });

        // 监听认证状态变化
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

            // 检测是否在Capacitor环境（移动应用）
            const isCapacitor = window.location.protocol === 'capacitor:' ||
                window.location.protocol === 'ionic:' ||
                (window as any).Capacitor?.isNativePlatform?.();

            // 在移动端使用deep link，web端使用origin
            const redirectUrl = isCapacitor
                ? 'com.venya.marketplace://'
                : window.location.origin;

            if (isCapacitor) {
                // 移动端：使用外部浏览器打开OAuth
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
                // Web端：正常OAuth流程
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: redirectUrl,
                    },
                });
                if (error) throw error;
            }
        } catch (error) {
            console.error('登录失败:', error);
            alert('登录失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (error) {
            console.error('退出失败:', error);
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
                    title="退出登录"
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
                {loading ? '登录中...' : '使用 Google 登录'}
            </span>
        </button>
    );
};
