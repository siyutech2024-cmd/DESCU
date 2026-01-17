import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/adminApi';
import { AdminProduct } from '../types/admin';
import { showToast } from '../utils/toast';
import { CheckCircle, XCircle, MessageSquare, Eye, Package, Sparkles } from 'lucide-react';
import { auditProductWithGemini } from '../../services/geminiService';

export const ProductReview: React.FC = () => {
    const [products, setProducts] = useState<AdminProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null);
    const [reviewNote, setReviewNote] = useState('');
    const [processing, setProcessing] = useState(false);

    const fetchPendingProducts = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getProducts({
                page,
                limit: 20,
                status: 'pending_review'
            });
            if (res.data) {
                setProducts(res.data.products);
                setTotalPages(res.data.pagination.totalPages);
            }
        } catch (error) {
            showToast.error('加载待审核商品失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingProducts();
    }, [page]);

    const handleReview = async (productId: string, approve: boolean) => {
        setProcessing(true);
        try {
            // 更新商品状态
            const res = await adminApi.updateProduct(productId, {
                status: approve ? 'active' : 'inactive',
                review_note: reviewNote || (approve ? '审核通过' : '审核未通过')
            });

            if (res.error) {
                throw new Error(res.error);
            }

            showToast.success(approve ? '商品已通过审核' : '商品已拒绝');
            setReviewNote('');
            setSelectedProduct(null);
            fetchPendingProducts();
        } catch (error: any) {
            console.error('审核失败:', error);
            showToast.error(error.message || '审核操作失败');
        } finally {
            setProcessing(false);
        }
    };

    const handleBatchApprove = async () => {
        if (!confirm(`确定要批量通过 ${products.length} 个待审核商品吗？`)) return;

        setProcessing(true);
        try {
            // 使用 Promise.all 并行处理，且检查每个结果
            const results = await Promise.all(products.map(product =>
                adminApi.updateProduct(product.id, {
                    status: 'active',
                    review_note: '批量审核通过'
                })
            ));

            const errors = results.filter(r => r.error);
            if (errors.length > 0) {
                console.error('部分审核失败:', errors);
                throw new Error(`有 ${errors.length} 个商品审核失败`);
            }

            showToast.success(`已批量通过 ${products.length} 个商品`);
            fetchPendingProducts();
        } catch (error: any) {
            showToast.error(error.message || '批量审核失败');
        } finally {
            setProcessing(false);
        }
    };

    const handleAiAudit = async () => {
        if (!confirm(`AI将自动扫描这 ${products.length} 个商品。安全且分类正确的商品将自动通过，有风险的将被标记。\n确定开始吗？`)) return;

        setProcessing(true);
        let approvedCount = 0;
        let flaggedCount = 0;

        try {
            // Process sequentially to be safe with rate limits, or parallel batches of 3
            // Batch processing 3 at a time
            for (let i = 0; i < products.length; i += 3) {
                const batch = products.slice(i, i + 3);
                await Promise.all(batch.map(async (product) => {
                    // 1. Audit
                    const audit = await auditProductWithGemini({
                        title: product.title,
                        description: product.description || '',
                        category: product.category || 'Other'
                    });

                    if (audit) {
                        if (audit.isSafe && audit.categoryCorrect && audit.confidence > 0.8) {
                            // Auto Approve
                            await adminApi.updateProduct(product.id, {
                                status: 'active',
                                review_note: `[AI] Auto-approved. Confidence: ${(audit.confidence * 100).toFixed(0)}%`
                            });
                            approvedCount++;
                        } else {
                            // Flag / Leave for review
                            // Optionally update note even if not approving
                            // await adminApi.updateProduct(product.id, { review_note: `[AI Flag] ${audit.flaggedReason || 'Category Mismatch'}` });
                            flaggedCount++;
                        }
                    }
                }));
            }

            showToast.success(`AI 审核完成: 自动通过 ${approvedCount} 个，标记需人工复核 ${flaggedCount} 个`);
            fetchPendingProducts();
        } catch (error) {
            console.error("AI Audit Error", error);
            showToast.error("AI 审核过程中发生错误");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-black text-gray-900">商品审核</h1>
                    <p className="text-gray-600 mt-1">审核待发布的商品</p>
                </div>
                {products.length > 0 && (
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={handleBatchApprove}
                            disabled={processing}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                            批量通过全部
                        </button>
                        <button
                            onClick={handleAiAudit}
                            disabled={processing}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            <Sparkles size={16} />
                            AI 智能审核
                        </button>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">待审核</p>
                            <p className="text-3xl font-bold text-yellow-600 mt-2">
                                {products.length}
                            </p>
                        </div>
                        <Package className="w-12 h-12 text-yellow-600 opacity-20" />
                    </div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">今日已审核</p>
                            <p className="text-3xl font-bold text-green-600 mt-2">0</p>
                        </div>
                        <CheckCircle className="w-12 h-12 text-green-600 opacity-20" />
                    </div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">今日已拒绝</p>
                            <p className="text-3xl font-bold text-red-600 mt-2">0</p>
                        </div>
                        <XCircle className="w-12 h-12 text-red-600 opacity-20" />
                    </div>
                </div>
            </div>

            {/* Product List */}
            <div className="bg-white rounded-xl shadow-sm border">
                {loading ? (
                    <div className="p-12 text-center text-gray-500">加载中...</div>
                ) : products.length === 0 ? (
                    <div className="p-12 text-center">
                        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">审核完成！</h3>
                        <p className="text-gray-600">当前没有待审核的商品</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {products.map((product) => (
                            <div key={product.id} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex gap-6">
                                    {/* Image */}
                                    <img
                                        src={product.images?.[0] || 'https://via.placeholder.com/120'}
                                        alt={product.title}
                                        className="w-32 h-32 rounded-lg object-cover border"
                                    />

                                    {/* Content */}
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            {product.title}
                                        </h3>
                                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                            {product.description}
                                        </p>
                                        <div className="flex items-center gap-4 text-sm text-gray-600">
                                            <span className="font-semibold text-orange-600">
                                                ${product.price} {product.currency || 'MXN'}
                                            </span>
                                            <span>分类: {product.category}</span>
                                            <span>卖家: {product.seller_name}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => setSelectedProduct(product)}
                                            className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <Eye className="w-4 h-4" />
                                            查看详情
                                        </button>
                                        <button
                                            onClick={() => handleReview(product.id, true)}
                                            disabled={processing}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            通过
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedProduct(product);
                                            }}
                                            disabled={processing}
                                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <XCircle className="w-4 h-4" />
                                            拒绝
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                            第 {page} 页，共 {totalPages} 页
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className="px-4 py-2 border rounded-lg hover:bg-white disabled:opacity-50"
                            >
                                上一页
                            </button>
                            <button
                                disabled={page === totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="px-4 py-2 border rounded-lg hover:bg-white disabled:opacity-50"
                            >
                                下一页
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Review Modal */}
            {
                selectedProduct && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b">
                                <h2 className="text-2xl font-bold">商品详情审核</h2>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <h3 className="font-semibold mb-2">{selectedProduct.title}</h3>
                                    <p className="text-gray-600">{selectedProduct.description}</p>
                                </div>

                                {selectedProduct.images && selectedProduct.images.length > 0 && (
                                    <div className="grid grid-cols-3 gap-4">
                                        {selectedProduct.images.map((img, idx) => (
                                            <img
                                                key={idx}
                                                src={img}
                                                alt={`商品图片 ${idx + 1}`}
                                                className="w-full h-32 object-cover rounded-lg border"
                                            />
                                        ))}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        审核备注（可选）
                                    </label>
                                    <textarea
                                        value={reviewNote}
                                        onChange={(e) => setReviewNote(e.target.value)}
                                        placeholder="输入审核备注..."
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        rows={3}
                                    />
                                </div>
                            </div>

                            <div className="p-6 border-t flex gap-3">
                                <button
                                    onClick={() => {
                                        setSelectedProduct(null);
                                        setReviewNote('');
                                    }}
                                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={() => handleReview(selectedProduct.id, false)}
                                    disabled={processing}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    拒绝
                                </button>
                                <button
                                    onClick={() => handleReview(selectedProduct.id, true)}
                                    disabled={processing}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    通过
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
