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
        { value: 'Electronics', label: '电子产品' },
        { value: 'Furniture', label: '家具' },
        { value: 'Clothing', label: '服装' },
        { value: 'Books', label: '图书' },
        { value: 'Sports', label: '运动' },
        { value: 'Vehicles', label: '车辆' },
        { value: 'RealEstate', label: '房产' },
        { value: 'Services', label: '服务' },
        { value: 'Other', label: '其他' },
    ];

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight">商品管理</h1>
                    <p className="text-gray-500 mt-2 font-medium">管理平台所有商品库存与状态</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white/50 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/60 shadow-sm text-sm font-semibold text-gray-700">
                        共 {products.length} / {totalPages * 15} 商品
                    </div>
                </div>
            </div>

            {/* Glass Filter Panel */}
            <div className="glass-panel p-6 rounded-[2rem] space-y-6">
                <div className="flex flex-wrap gap-4 items-center">
                    {/* Search - Modern Pill Style */}
                    <div className="flex-1 min-w-[240px]">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="搜索商品标题、卖家..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="glass-input w-full pl-12 pr-6 py-3 rounded-full text-gray-700 placeholder-gray-400"
                            />
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div className="relative min-w-[160px]">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="glass-input appearance-none w-full px-5 py-3 pr-10 rounded-full text-gray-700 font-medium cursor-pointer"
                        >
                            {categories.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>


                    {/* Status Filter */}
                    <div className="relative min-w-[140px]">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="glass-input appearance-none w-full px-5 py-3 pr-10 rounded-full text-gray-700 font-medium cursor-pointer"
                        >
                            <option value="all">全部状态</option>
                            <option value="active">在售</option>
                            <option value="inactive">已下架</option>
                            <option value="pending_review">待审核</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>

                    {/* Advanced Filters Button Wrapper (if component supports custom className) */}
                    <div className="[&_button]:glass-input [&_button]:rounded-full [&_button]:px-5 [&_button]:py-3 [&_button]:font-medium [&_button]:text-gray-700">
                        <AdvancedFilters
                            onApply={(filters) => setAdvancedFilters(filters)}
                            onReset={() => setAdvancedFilters({})}
                        />
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-full hover:shadow-lg hover:scale-[1.02] transition-all duration-300 font-medium"
                    >
                        <Download className="w-4 h-4" />
                        导出CSV
                    </button>
                </div>

                {/* Batch Actions Bar - Slide Down Animation */}
                {selectedIds.length > 0 && (
                    <div className="animate-fade-in-up bg-gradient-to-r from-blue-50/80 to-indigo-50/80 backdrop-blur-md border border-blue-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-bold text-sm">
                                {selectedIds.length}
                            </span>
                            <span className="text-blue-900 font-semibold">
                                已选择商品
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowBatchModal(true)}
                                className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all font-medium"
                            >
                                批量操作
                            </button>
                            <button
                                onClick={() => setSelectedIds([])}
                                className="px-5 py-2 bg-white/60 hover:bg-white text-gray-600 border border-gray-200 rounded-xl transition-all font-medium"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                )}

                {/* Product Table */}
                <div className="overflow-hidden rounded-2xl border border-white/40 shadow-inner bg-white/30 backdrop-blur-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-white/60 border-b border-white/40">
                                    <th className="px-6 py-4 text-left w-16">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === products.length && products.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500/50 cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">图片</th>
                                    <th
                                        className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:text-blue-600 transition-colors"
                                        onClick={() => handleSort('title')}
                                    >
                                        <div className="flex items-center gap-1">
                                            标题 <SortIcon field="title" />
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:text-blue-600 transition-colors"
                                        onClick={() => handleSort('price')}
                                    >
                                        <div className="flex items-center gap-1">
                                            价格 <SortIcon field="price" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">分类</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">卖家</th>
                                    <th
                                        className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:text-blue-600 transition-colors"
                                        onClick={() => handleSort('views_count')}
                                    >
                                        <div className="flex items-center gap-1">
                                            浏览 <SortIcon field="views_count" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">状态</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100/50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                                <span className="text-gray-500 font-medium">加载数据中...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : products.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-20 text-center text-gray-500">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <div className="text-4xl">📦</div>
                                                <span className="font-medium">暂无商品数据</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    products.map((product) => (
                                        <tr
                                            key={product.id}
                                            className="hover:bg-white/60 transition-all duration-200 cursor-pointer group"
                                            onClick={() => setEditingProduct(product)}
                                        >
                                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(product.id)}
                                                    onChange={() => toggleSelect(product.id)}
                                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500/50 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="w-16 h-16 rounded-xl overflow-hidden shadow-sm border border-white/50 group-hover:scale-105 transition-transform duration-300">
                                                    <img
                                                        src={product.images?.[0] || 'https://via.placeholder.com/60'}
                                                        alt={product.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-800 truncate max-w-[200px] text-base group-hover:text-blue-600 transition-colors">
                                                    {product.title}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">{new Date(product.created_at).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-black text-gray-900 text-lg tracking-tight">
                                                    ${product.price.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex px-3 py-1 bg-gray-100/80 backdrop-blur-sm text-gray-600 rounded-lg text-xs font-semibold capitalize border border-gray-200/50">
                                                    {product.category?.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold">
                                                        {product.seller_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-700">
                                                        {product.seller_name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-sm text-gray-500 font-medium">
                                                    <Eye className="w-4 h-4 text-blue-400" />
                                                    {product.views_count || 0}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${product.status === 'active' ? 'bg-green-50/80 text-green-700 border-green-200' :
                                                    product.status === 'inactive' ? 'bg-gray-100/80 text-gray-700 border-gray-200' :
                                                        'bg-yellow-50/80 text-yellow-700 border-yellow-200'
                                                    }`}>
                                                    {product.status === 'active' ? '在售' :
                                                        product.status === 'inactive' ? '下架' : '待审'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                    <button
                                                        onClick={() => handlePromote(product.id, product.is_promoted)}
                                                        className={`p-2 rounded-lg transition-all ${product.is_promoted
                                                            ? 'bg-yellow-100 text-yellow-600 shadow-sm'
                                                            : 'bg-white text-gray-400 hover:bg-yellow-50 hover:text-yellow-500 border border-gray-100'
                                                            }`}
                                                        title={product.is_promoted ? '取消推荐' : '推荐'}
                                                    >
                                                        <Star className="w-4 h-4" fill={product.is_promoted ? 'currentColor' : 'none'} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(product.id)}
                                                        className="p-2 bg-white text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg border border-gray-100 transition-all shadow-sm hover:shadow"
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
                        <div className="px-6 py-4 border-t border-white/40 bg-white/30 backdrop-blur-sm flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">
                                第 {page} 页，共 {totalPages} 页
                            </span>
                            <div className="flex gap-2">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(p => p - 1)}
                                    className="px-4 py-2 bg-white/60 border border-white/60 rounded-lg text-sm text-gray-700 hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    上一页
                                </button>
                                <button
                                    disabled={page === totalPages}
                                    onClick={() => setPage(p => p + 1)}
                                    className="px-4 py-2 bg-white/60 border border-white/60 rounded-lg text-sm text-gray-700 hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    下一页
                                </button>
                            </div>
                        </div>
                    )}
                </div>
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
