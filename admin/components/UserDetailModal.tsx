import React, { useState, useEffect } from 'react';
import { AdminUserInfo, AdminProduct } from '../types/admin';
import { adminApi } from '../services/adminApi';

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

    useEffect(() => {
        if (isOpen && user) {
            loadUserProducts();
        }
    }, [isOpen, user]);

    const loadUserProducts = async () => {
        setLoading(true);
        try {
            // 获取用户的所有商品
            const res = await adminApi.getProducts({ search: user.email, limit: 100 });
            if (res.data) {
                setUserProducts(res.data.products);
            }
        } catch (error) {
            console.error('加载用户商品失败:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">用户详情</h2>
                        <p className="text-sm text-gray-600 mt-1">完整用户信息和活动记录</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white rounded-lg transition-colors"
                    >
                        <XIcon />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {/* User Info Card */}
                    <div className="bg-white border rounded-xl p-6 mb-6">
                        <div className="flex items-start gap-4">
                            <img
                                src={user.avatar || 'https://via.placeholder.com/80'}
                                alt={user.name}
                                className="w-20 h-20 rounded-full object-cover border-4 border-blue-100"
                            />
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="text-xl font-bold text-gray-900">{user.name || '未命名用户'}</h3>
                                    {user.is_verified && (
                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                                            ✓ 已认证
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-1 text-sm text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">📧 邮箱:</span>
                                        <span>{user.email}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">🆔 用户ID:</span>
                                        <span className="font-mono text-xs">{user.id}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">📅 注册时间:</span>
                                        <span>{(user as any).created_at ? new Date((user as any).created_at).toLocaleString('zh-CN') : '未知'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{user.product_count || 0}</div>
                                <div className="text-sm text-gray-600">发布商品</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">{user.conversation_count || 0}</div>
                                <div className="text-sm text-gray-600">参与对话</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">
                                    {userProducts.reduce((sum, p) => sum + (p.views_count || 0), 0)}
                                </div>
                                <div className="text-sm text-gray-600">总浏览量</div>
                            </div>
                        </div>
                    </div>

                    {/* User Products */}
                    <div className="bg-white border rounded-xl p-6">
                        <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            🛍️ 发布的商品
                            <span className="text-sm font-normal text-gray-500">({userProducts.length})</span>
                        </h4>

                        {loading ? (
                            <div className="text-center py-8 text-gray-500">
                                加载中...
                            </div>
                        ) : userProducts.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                该用户还未发布任何商品
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {userProducts.slice(0, 10).map((product) => (
                                    <div
                                        key={product.id}
                                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <img
                                            src={product.images?.[0] || 'https://via.placeholder.com/60'}
                                            alt={product.title}
                                            className="w-12 h-12 rounded object-cover"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900 truncate">{product.title}</div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span className="font-semibold text-blue-600">¥{product.price}</span>
                                                <span>•</span>
                                                <span>{product.category}</span>
                                                <span>•</span>
                                                <span className={`px-2 py-0.5 rounded ${product.status === 'active' ? 'bg-green-100 text-green-800' :
                                                    product.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {product.status === 'active' ? '在售' :
                                                        product.status === 'inactive' ? '下架' : '待审'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            👁️ {product.views_count || 0}
                                        </div>
                                    </div>
                                ))}
                                {userProducts.length > 10 && (
                                    <div className="text-center text-sm text-gray-500 pt-2">
                                        还有 {userProducts.length - 10} 个商品未显示
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
};
