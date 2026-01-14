import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { LogIn, Shield, AlertCircle, Mail, Lock, Eye, EyeOff, CheckCircle2, Loader2 } from 'lucide-react';

export const AdminLogin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formErrors, setFormErrors] = useState<{ email?: string }>({});

    const navigate = useNavigate();

    useEffect(() => {
        // Load remembered email
        const savedEmail = localStorage.getItem('admin_email');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }
    }, []);

    const validateEmail = (e: string) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(e);
    };

    const handleEmailBlur = () => {
        if (email && !validateEmail(email)) {
            setFormErrors({ ...formErrors, email: '请输入有效的邮箱地址' });
        } else {
            setFormErrors({ ...formErrors, email: undefined });
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateEmail(email)) {
            setFormErrors({ ...formErrors, email: '请输入有效的邮箱地址' });
            return;
        }

        try {
            setLoading(true);
            setError('');

            if (email === 'admin@local.com' && password === '123456') {
                localStorage.setItem('descu_admin_dev_mode', 'true');
                navigate('/admin/dashboard');
                return;
            }

            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) throw signInError;

            // 检查管理员权限
            if (data.user?.user_metadata?.role !== 'admin' && data.user?.user_metadata?.role !== 'super_admin') {
                await supabase.auth.signOut();
                throw new Error('您没有管理员权限');
            }

            // Handle Remember Me
            if (rememberMe) {
                localStorage.setItem('admin_email', email);
            } else {
                localStorage.removeItem('admin_email');
            }

            // 登录成功
            navigate('/admin/dashboard');
        } catch (err: any) {
            setError(err.message === 'Invalid login credentials' ? '账号或密码错误' : err.message || '登录失败，请重试');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Dynamic Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[100px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-600/20 blur-[100px] animate-pulse delay-700" />
            </div>

            <div className="relative z-10 w-full max-w-[420px]">
                {/* Brand Logo - Floating Effect */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20">
                    <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl shadow-2xl shadow-orange-500/30 flex items-center justify-center transform hover:scale-105 transition-transform duration-300">
                        <Shield className="w-12 h-12 text-white" strokeWidth={1.5} />
                    </div>
                </div>

                {/* Glassmorphism Card */}
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 pt-16">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                            Admin Portal
                        </h1>
                        <p className="text-slate-400 text-sm font-medium">
                            欢迎回来，请登录您的账户
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-fade-in-down">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm text-red-400 font-medium">登录失败</p>
                                <p className="text-xs text-red-500/80 mt-1 leading-relaxed">{error}</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Email Input */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-300 ml-1 uppercase tracking-wider">邮箱地址</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onBlur={handleEmailBlur}
                                    className={`w-full bg-slate-800/50 border ${formErrors.email ? 'border-red-500/50 focus:border-red-500' : 'border-slate-700/50 focus:border-orange-500'} rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all duration-300`}
                                    placeholder="admin@example.com"
                                    required
                                />
                                {validateEmail(email) && !formErrors.email && (
                                    <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 animate-in fade-in zoom-in" />
                                )}
                            </div>
                            {formErrors.email && (
                                <p className="text-xs text-red-400 ml-1">{formErrors.email}</p>
                            )}
                        </div>

                        {/* Password Input */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">密码</label>
                                <button type="button" className="text-xs text-orange-500 hover:text-orange-400 transition-colors">
                                    忘记密码？
                                </button>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-800/50 border border-slate-700/50 focus:border-orange-500 rounded-xl py-3.5 pl-12 pr-12 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all duration-300"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me */}
                        <div className="flex items-center gap-2 ml-1">
                            <input
                                type="checkbox"
                                id="remember"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800/50 text-orange-600 focus:ring-orange-500/50 focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer"
                            />
                            <label htmlFor="remember" className="text-sm text-slate-300 cursor-pointer select-none">
                                记住账号
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-600/20 transform active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>登录中...</span>
                                </>
                            ) : (
                                <>
                                    <span>登 录</span>
                                    <LogIn className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-slate-500 text-xs">
                        © 2024 DESCU Admin. Secured by Supabase.
                    </p>
                </div>
            </div>
        </div>
    );
};
