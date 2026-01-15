import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/adminApi';
import { AdminProduct } from '../types/admin';
import { ProductEditModal } from '../components/ProductEditModal';
import { AdvancedFilters, FilterValues } from '../components/AdvancedFilters';
import { BatchOperationModal } from '../components/BatchOperationModal';
import { showToast } from '../utils/toast';
import { exportToCSV } from '../utils/export';
import { Search, Download, ChevronUp, ChevronDown, Star, Trash2, Eye, MoreVertical } from 'lucide-react';

export const ProductList: React.FC = () => {
    const [products, setProducts] = useState<AdminProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState<FilterValues>({});
    const [sortBy, setSortBy] = useState<string>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getProducts({
                page,
                limit: 15,
                search,
                status: statusFilter === 'all' ? undefined : statusFilter,
                category: categoryFilter === 'all' ? undefined : categoryFilter,
                ...advancedFilters,
                sort: sortBy,
                order: sortOrder
            });
            if (res.data) {
                setProducts(res.data.products);
                setTotalPages(res.data.pagination.totalPages);
            }
        } catch (error) {
            console.error(error);
            showToast.error('加载商品失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(fetchProducts, 300);
        return () => clearTimeout(timer);
    }, [page, search, statusFilter, categoryFilter, advancedFilters, sortBy, sortOrder]);

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const SortIcon = ({ field }: { field: string }) => {
        if (sortBy !== field) return null;
        return sortOrder === 'asc' ?
            <ChevronUp className="w-4 h-4 inline ml-1" /> :
            <ChevronDown className="w-4 h-4 inline ml-1" />;
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        setSelectedIds(prev =>
            prev.length === products.length ? [] : products.map(p => p.id)
        );
    };

    const handleBatchOperation = async (operation: string, params?: any) => {
        if (selectedIds.length === 0) {
            showToast.error('请先选择商品');
            return;
        }

        try {
            // 根据不同操作类型执行
            if (operation === 'change_category') {
                await adminApi.batchUpdateProducts(selectedIds, { category: params.category });
                showToast.success(`已将 ${selectedIds.length} 个商品的分类修改为 ${params.category}`);
            } else if (operation === 'change_status') {
                await adminApi.batchUpdateProducts(selectedIds, { status: params.status });
                showToast.success(`已将 ${selectedIds.length} 个商品的状态修改为 ${params.status}`);
            } else if (operation === 'promote') {
                await adminApi.batchUpdateProducts(selectedIds, { is_promoted: true });
                showToast.success(`已将 ${selectedIds.length} 个商品设为推荐`);
            } else if (operation === 'unpromote') {
                await adminApi.batchUpdateProducts(selectedIds, { is_promoted: false });
                showToast.success(`已取消 ${selectedIds.length} 个商品的推荐`);
            } else if (operation === 'delete') {
                if (confirm(`确定要删除 ${selectedIds.length} 个商品吗？此操作不可恢复！`)) {
                    for (const id of selectedIds) {
                        await adminApi.deleteProduct(id);
                    }
                    showToast.success(`已删除 ${selectedIds.length} 个商品`);
                }
            }

            setSelectedIds([]);
            fetchProducts();
        } catch (error) {
            showToast.error('批量操作失败');
        }
    };

    const handlePromote = async (id: string, current: boolean) => {
        try {
            await adminApi.updateProductPromotion(id, !current);
            showToast.success(current ? '已取消推荐' : '已设为推荐');
            fetchProducts();
        } catch (error) {
            showToast.error('操作失败');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('确定要删除该商品吗？')) {
            try {
                await adminApi.deleteProduct(id);
                showToast.success('商品已删除');
                fetchProducts();
            } catch (error) {
                showToast.error('删除失败');
            }
        }
    };

    const handleExport = () => {
        const dataToExport = selectedIds.length > 0
            ? products.filter(p => selectedIds.includes(p.id))
            : products;

        if (dataToExport.length === 0) {
            showToast.error('没有可导出的数据');
            return;
        }

        exportToCSV(dataToExport, '商品列表');
        showToast.success(`已导出 ${dataToExport.length} 个商品`);
    };

    const categories = [
        { value: 'all', label: '全部分类' },
        { value: 'electronics', label: '电子产品' },
        { value: 'furniture', label: '家具' },
        { value: 'clothing', label: '服装' },
        { value: 'books', label: '图书' },
        { value: 'sports', label: '运动' },
        { value: 'vehicles', label: '车辆' },
        { value: 'real_estate', label: '房产' },
        { value: 'services', label: '服务' },
        { value: 'other', label: '其他' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-gray-900">商品管理</h1>
                <p className="text-gray-600 mt-1">管理平台所有商品</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex flex-wrap gap-3 items-center">
                    {/* Search */}
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="搜索商品标题..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Category Filter */}
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                        {categories.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                    </select>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                        <option value="all">全部状态</option>
                        <option value="active">在售</option>
                        <option value="inactive">已下架</option>
                        <option value="pending_review">待审核</option>
                    </select>

                    {/* Advanced Filters */}
                    <AdvancedFilters
                        onApply={(filters) => setAdvancedFilters(filters)}
                        onReset={() => setAdvancedFilters({})}
                    />

                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                        <Download className="w-4 h-4" />
                        导出
                    </button>
                </div>
            </div>

            {/* Batch Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                    <span className="text-blue-900 font-medium">
                        已选择 {selectedIds.length} 个商品
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowBatchModal(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            批量操作
                        </button>
                        <button
                            onClick={() => setSelectedIds([])}
                            className="px-4 py-2 border rounded-lg hover:bg-white"
                        >
                            取消选择
                        </button>
                    </div>
                </div>
            )}

            {/* Product Table */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.length === products.length && products.length > 0}
                                        onChange={toggleSelectAll}
                                        className="rounded"
                                    />
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">图片</th>
                                <th
                                    className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('title')}
                                >
                                    标题 <SortIcon field="title" />
                                </th>
                                <th
                                    className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('price')}
                                >
                                    价格 <SortIcon field="price" />
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">分类</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">卖家</th>
                                <th
                                    className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('views_count')}
                                >
                                    浏览 <SortIcon field="views_count" />
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">状态</th>
                                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                                        加载中...
                                    </td>
                                </tr>
                            ) : products.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                                        暂无商品数据
                                    </td>
                                </tr>
                            ) : (
                                products.map((product) => (
                                    <tr
                                        key={product.id}
                                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                                        onClick={() => setEditingProduct(product)}
                                    >
                                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(product.id)}
                                                onChange={() => toggleSelect(product.id)}
                                                className="rounded"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <img
                                                src={product.images?.[0] || 'https://via.placeholder.com/60'}
                                                alt={product.title}
                                                className="w-12 h-12 rounded object-cover"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-900 truncate max-w-xs">
                                                {product.title}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-semibold text-gray-900">
                                                ${product.price}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-gray-600 capitalize">
                                                {product.category?.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-gray-600">
                                                {product.seller_name}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 text-sm text-gray-600">
                                                <Eye className="w-4 h-4" />
                                                {product.views_count || 0}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-xs rounded-full ${product.status === 'active' ? 'bg-green-100 text-green-800' :
                                                product.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {product.status === 'active' ? '在售' :
                                                    product.status === 'inactive' ? '下架' : '待审'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handlePromote(product.id, product.is_promoted)}
                                                    className={`p-1.5 rounded transition-colors ${product.is_promoted
                                                        ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                                                        : 'text-gray-400 hover:bg-gray-100'
                                                        }`}
                                                    title={product.is_promoted ? '取消推荐' : '推荐'}
                                                >
                                                    <Star className="w-4 h-4" fill={product.is_promoted ? 'currentColor' : 'none'} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product.id)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="删除"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

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
                                className="px-4 py-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                上一页
                            </button>
                            <button
                                disabled={page === totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="px-4 py-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                下一页
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {editingProduct && (
                <ProductEditModal
                    product={editingProduct}
                    isOpen={!!editingProduct}
                    onClose={() => setEditingProduct(null)}
                    onSaved={() => {
                        setEditingProduct(null);
                        fetchProducts();
                    }}
                />
            )}

            {showBatchModal && (
                <BatchOperationModal
                    selectedCount={selectedIds.length}
                    onClose={() => setShowBatchModal(false)}
                    onExecute={handleBatchOperation}
                />
            )}
        </div>
    );
};
