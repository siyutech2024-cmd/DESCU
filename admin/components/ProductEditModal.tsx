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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-2xl font-bold text-gray-800">编辑商品</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <XIcon />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Product ID */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">商品ID</label>
                        <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">{product.id}</div>
                    </div>

                    {/* Image Preview */}
                    {product.images && product.images.length > 0 && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">商品图片</label>
                            <div className="flex gap-2 overflow-x-auto">
                                {product.images.map((img, idx) => (
                                    <img
                                        key={idx}
                                        src={img}
                                        alt={`Product ${idx + 1}`}
                                        className="w-20 h-20 object-cover rounded-lg border"
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Title */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">标题 *</label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>

                    {/* Description */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>

                    {/* Price and Currency */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">价格 *</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">币种</label>
                            <select
                                value={formData.currency}
                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                                <option value="MXN">MXN</option>
                                <option value="USD">USD</option>
                            </select>
                        </div>
                    </div>

                    {/* Category */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">分类 *</label>
                        <select
                            required
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
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

                    {/* Delivery Type */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">配送方式</label>
                        <select
                            value={formData.delivery_type}
                            onChange={(e) => setFormData({ ...formData, delivery_type: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                            <option value="meetup">见面交易</option>
                            <option value="shipping">快递配送</option>
                            <option value="both">两者皆可</option>
                        </select>
                    </div>

                    {/* Location */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">位置</label>
                        <input
                            type="text"
                            value={formData.location_name}
                            onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="例如: CDMX, Mexico"
                        />
                    </div>

                    {/* Status */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">状态</label>
                        <div className="flex gap-4">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    value="active"
                                    checked={formData.status === 'active'}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="mr-2"
                                />
                                <span className="text-sm">在售</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    value="inactive"
                                    checked={formData.status === 'inactive'}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="mr-2"
                                />
                                <span className="text-sm">已下架</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    value="pending_review"
                                    checked={formData.status === 'pending_review'}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="mr-2"
                                />
                                <span className="text-sm">待审核</span>
                            </label>
                        </div>
                    </div>

                    {/* Seller Info (Read-only) */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-600 mb-1">卖家信息</div>
                        <div className="text-sm">
                            <span className="font-medium">{product.seller_name}</span> ({product.seller_email})
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            浏览: {product.views_count || 0} | 举报: {product.reported_count || 0}
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? '保存中...' : '保存修改'}
                    </button>
                </div>
            </div>
        </div>
    );
};
