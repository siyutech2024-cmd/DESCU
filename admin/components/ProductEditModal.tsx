import React, { useState, useEffect } from 'react';
import { AdminProduct } from '../types/admin';
import { adminApi } from '../services/adminApi';

interface ProductEditModalProps {
    product: AdminProduct;
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
}

const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

export const ProductEditModal: React.FC<ProductEditModalProps> = ({ product, isOpen, onClose, onSaved }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        price: 0,
        currency: 'MXN',
        category: '',
        delivery_type: 'both',
        status: 'active',
        location_name: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (product) {
            setFormData({
                title: product.title || '',
                description: product.description || '',
                price: product.price || 0,
                currency: product.currency || 'MXN',
                category: product.category || '',
                delivery_type: product.delivery_type || 'both',
                status: product.status || 'active',
                location_name: product.location_name || '',
            });
        }
    }, [product]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            const result = await adminApi.updateProduct(product.id, formData as any);
            if (result.error) {
                setError(result.error);
            } else {
                onSaved();
                onClose();
            }
        } catch (err) {
            setError('保存失败，请重试');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="glass-panel w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl rounded-[2rem] border border-white/60">
                {/* Header - Glass Gradient */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-white/20 bg-gradient-to-r from-white/40 to-white/10">
                    <div>
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600">编辑商品详情</h2>
                        <p className="text-sm text-gray-500 font-medium mt-1">ID: {product.id}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/50 rounded-full transition-all duration-200 group border border-transparent hover:border-white/40"
                    >
                        <XIcon />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50/90 backdrop-blur-sm border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2 shadow-sm animate-fade-in">
                            <span className="font-bold">Error:</span> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Images & Seller */}
                        <div className="space-y-6">
                            {/* Images Card */}
                            <div className="bg-white/40 backdrop-blur-md rounded-2xl p-5 border border-white/50 shadow-sm">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">商品图集</label>
                                {product.images && product.images.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {product.images.map((img, idx) => (
                                            <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden cursor-pointer shadow-sm border border-white/50">
                                                <img
                                                    src={img}
                                                    alt={`Product ${idx + 1}`}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-300">
                                        无图片数据
                                    </div>
                                )}
                            </div>

                            {/* Seller Card */}
                            <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 backdrop-blur-md rounded-2xl p-5 border border-blue-100 shadow-sm">
                                <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-4">卖家信息</label>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                        {product.seller_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="font-bold text-gray-800 truncate">{product.seller_name}</div>
                                        <div className="text-xs text-gray-500 truncate">{product.seller_email}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <div className="bg-white/60 rounded-lg p-2 text-center">
                                        <div className="text-xs text-gray-400 uppercase">浏览量</div>
                                        <div className="font-bold text-gray-700">{product.views_count || 0}</div>
                                    </div>
                                    <div className="bg-white/60 rounded-lg p-2 text-center">
                                        <div className="text-xs text-gray-400 uppercase">被举报</div>
                                        <div className="font-bold text-red-500">{product.reported_count || 0}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Edit Form */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Main Info */}
                            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-sm space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">商品标题</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="glass-input w-full px-5 py-3 rounded-xl text-gray-800 font-medium placeholder-gray-400 focus:ring-4 focus:ring-blue-500/10"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">商品描述</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={4}
                                        className="glass-input w-full px-5 py-3 rounded-xl text-gray-600 resize-none focus:ring-4 focus:ring-blue-500/10"
                                    />
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">价格</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">$</span>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                                            className="glass-input w-full pl-8 pr-5 py-3 rounded-xl font-bold text-gray-800"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">币种</label>
                                    <select
                                        value={formData.currency}
                                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                        className="glass-input w-full px-5 py-3 rounded-xl text-gray-700 font-medium cursor-pointer appearance-none"
                                    >
                                        <option value="MXN">MXN (墨西哥比索)</option>
                                        <option value="USD">USD (美元)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">分类</label>
                                    <select
                                        required
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="glass-input w-full px-5 py-3 rounded-xl text-gray-700 font-medium cursor-pointer appearance-none"
                                    >
                                        <option value="">选择分类</option>
                                        <option value="electronics">电子产品</option>
                                        <option value="furniture">家具</option>
                                        <option value="clothing">服装</option>
                                        <option value="books">图书</option>
                                        <option value="sports">运动</option>
                                        <option value="vehicles">车辆</option>
                                        <option value="real_estate">房产</option>
                                        <option value="services">服务</option>
                                        <option value="other">其他</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">配送方式</label>
                                    <select
                                        value={formData.delivery_type}
                                        onChange={(e) => setFormData({ ...formData, delivery_type: e.target.value })}
                                        className="glass-input w-full px-5 py-3 rounded-xl text-gray-700 font-medium cursor-pointer appearance-none"
                                    >
                                        <option value="meetup">见面交易</option>
                                        <option value="shipping">快递配送</option>
                                        <option value="both">两者皆可</option>
                                    </select>
                                </div>
                            </div>

                            {/* Location & Status */}
                            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-sm space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">所在位置</label>
                                    <input
                                        type="text"
                                        value={formData.location_name}
                                        onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                                        className="glass-input w-full px-5 py-3 rounded-xl text-gray-700"
                                        placeholder="例如: CDMX, Mexico"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">当前状态</label>
                                    <div className="flex flex-wrap gap-4">
                                        {[
                                            { value: 'active', label: '在售', color: 'bg-green-100 text-green-700 border-green-200' },
                                            { value: 'inactive', label: '已下架', color: 'bg-gray-100 text-gray-700 border-gray-200' },
                                            { value: 'pending_review', label: '待审核', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' }
                                        ].map((statusOption) => (
                                            <label
                                                key={statusOption.value}
                                                className={`
                                                    cursor-pointer px-4 py-2 rounded-xl border flex items-center gap-2 transition-all duration-200
                                                    ${formData.status === statusOption.value
                                                        ? `${statusOption.color} ring-2 ring-offset-2 ring-blue-500/20 shadow-sm scale-105`
                                                        : 'bg-white/50 border-gray-200 text-gray-500 hover:bg-white hover:border-gray-300'
                                                    }
                                                `}
                                            >
                                                <input
                                                    type="radio"
                                                    value={statusOption.value}
                                                    checked={formData.status === statusOption.value}
                                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                    className="hidden"
                                                />
                                                <span className="font-bold text-sm">{statusOption.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>

                {/* Footer - Sticky Glass */}
                <div className="flex justify-end gap-3 px-8 py-5 border-t border-white/40 bg-white/40 backdrop-blur-md">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-6 py-2.5 text-gray-600 font-bold hover:bg-white/50 rounded-xl transition-all disabled:opacity-50"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                保存中...
                            </span>
                        ) : '保存修改'}
                    </button>
                </div>
            </div>
        </div>
    );
};
