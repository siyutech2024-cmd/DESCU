import React, { useState, useEffect } from 'react';
import { AdminUserInfo, AdminProduct } from '../types/admin';
import { adminApi, getAdminErrorMessage } from '../services/adminApi';
import { ErrorBanner } from './ErrorBanner';

interface UserDetailModalProps {
    user: AdminUserInfo;
    isOpen: boolean;
    onClose: () => void;
}

const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

export const UserDetailModal: React.FC<UserDetailModalProps> = ({ user, isOpen, onClose }) => {
    const [userProducts, setUserProducts] = useState<AdminProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && user) {
            loadUserProducts();
        }
    }, [isOpen, user]);

    const loadUserProducts = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            // 获取用户的所有商品
            const res = await adminApi.getProducts({ search: user.email, limit: 100 });
            setUserProducts(res.data?.products ?? []);
        } catch (error) {
            console.error('加载用户商品失败:', error);
            setLoadError(getAdminErrorMessage(error, '加载用户商品失败'));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            {/* Glass Overlay */}
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal Content */}
            <div className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-scale-in">
                {/* Header with Glass Effect */}
                <div className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-white/80 backdrop-blur-md">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">用户详情</h2>
                        <p className="text-sm font-medium text-gray-500 mt-1">查看完整用户信息和活动记录</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all hover:rotate-90"
                    >
                        <XIcon />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
                    {/* User Info Card */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                            <div className="relative">
                                <img
                                    src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                                    alt=""
                                    className="h-16 w-16 rounded-full"
                                />
                                {user.is_verified && (
                                    <div className="absolute bottom-1 right-1 bg-green-500 text-white p-1 rounded-full border-2 border-white shadow-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 text-center sm:text-left space-y-2">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900">{user.name || '未命名用户'}</h3>
                                    <p className="text-sm font-mono text-gray-400 mt-0.5">ID: {user.id}</p>
                                </div>

                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-sm text-gray-600">
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full">
                                        <span>📧</span>
                                        <span className="font-medium">{user.email}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full">
                                        <span>📅</span>
                                        <span>注册: {(user as any).created_at ? new Date((user as any).created_at).toLocaleDateString('zh-CN') : '未知'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100 text-center hover:scale-[1.02] transition-transform">
                                <div className="text-3xl font-black text-blue-600 mb-1">{user.product_count || 0}</div>
                                <div className="text-sm font-bold text-blue-800 uppercase tracking-wide">发布商品</div>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-100 text-center hover:scale-[1.02] transition-transform">
                                <div className="text-3xl font-black text-purple-600 mb-1">{user.conversation_count || 0}</div>
                                <div className="text-sm font-bold text-purple-800 uppercase tracking-wide">参与对话</div>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-100 text-center hover:scale-[1.02] transition-transform">
                                <div className="text-3xl font-black text-emerald-600 mb-1">
                                    {userProducts.reduce((sum, p) => sum + (p.views_count || 0), 0)}
                                </div>
                                <div className="text-sm font-bold text-emerald-800 uppercase tracking-wide">总浏览量</div>
                            </div>
                        </div>
                    </div>

                    {/* User Products */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
                            <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                🛍️ 发布的商品
                            </h4>
                            <span className="px-2.5 py-0.5 bg-gray-200 text-gray-600 text-xs font-bold rounded-full">
                                {userProducts.length}
                            </span>
                        </div>

                        <div className="p-2">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                    <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-500 rounded-full animate-spin mb-3"></div>
                                    <span className="text-sm">加载商品数据...</span>
                                </div>
                            ) : loadError ? (
                                <div className="p-4">
                                    <ErrorBanner message={loadError} onRetry={loadUserProducts} />
                                </div>
                            ) : userProducts.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <div className="text-4xl mb-2">📦</div>
                                    <p>该用户还未发布任何商品</p>
                                </div>
                            ) : (
                                <div className="grid gap-2">
                                    {userProducts.slice(0, 10).map((product) => (
                                        <div
                                            key={product.id}
                                            className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100 group"
                                        >
                                            <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                                                <img
                                                    src={product.images?.[0] || 'https://via.placeholder.com/150'}
                                                    alt={product.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <h5 className="font-bold text-gray-900 truncate pr-2">{product.title}</h5>
                                                    <span className="font-bold text-brand-600 whitespace-nowrap">¥{product.price}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded">{product.category}</span>
                                                    <span className={`px-2 py-0.5 rounded-full font-medium ${product.status === 'active' ? 'bg-green-100 text-green-700' :
                                                        product.status === 'inactive' ? 'bg-gray-100 text-gray-600' :
                                                            'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                        {product.status === 'active' ? '在售' :
                                                            product.status === 'inactive' ? '下架' : '待审'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-400 font-medium whitespace-nowrap px-2">
                                                👁️ {product.views_count || 0}
                                            </div>
                                        </div>
                                    ))}
                                    {userProducts.length > 10 && (
                                        <button className="w-full py-3 text-sm text-brand-600 font-bold hover:bg-brand-50 rounded-xl transition-colors">
                                            查看全部 {userProducts.length} 个商品
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
};
