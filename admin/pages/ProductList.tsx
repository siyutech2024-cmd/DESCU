import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/adminApi';
import { AdminProduct } from '../types/admin';
import { ProductEditModal } from '../components/ProductEditModal';

// Icons
const SearchIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>);
const StarIcon = ({ filled }: { filled: boolean }) => filled ? (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-500"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>);
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
const EyeIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>);

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

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getProducts({
                page,
                limit: 15,
                search,
                status: statusFilter === 'all' ? undefined : statusFilter,
                category: categoryFilter === 'all' ? undefined : categoryFilter
            });
            if (res.data) {
                setProducts(res.data.products);
                setTotalPages(res.data.pagination.totalPages);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(fetchProducts, 300);
        return () => clearTimeout(timer);
    }, [page, search, statusFilter, categoryFilter]);

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

    const handleBatchAction = async (action: string) => {
        if (selectedIds.length === 0) {
            alert('请先选择商品');
            return;
        }

        if (!confirm(`确定要对 ${selectedIds.length} 个商品执行"${action}"操作吗？`)) {
            return;
        }

        await adminApi.batchUpdateProducts(selectedIds, action);
        setSelectedIds([]);
        fetchProducts();
    };

    const handlePromote = async (id: string, current: boolean) => {
        await adminApi.updateProductPromotion(id, !current);
        fetchProducts();
    };

    const handleDelete = async (id: string) => {
        if (confirm('确定要删除该商品吗？')) {
            await adminApi.deleteProduct(id);
            fetchProducts();
        }
    };

    const categories = ['数码', '服装', '图书', '家电', '运动', '美妆', '其他'];

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">商品管理</h2>
                <div className="flex gap-3">
                    <select
                        className="border rounded-lg px-3 py-2 bg-white text-sm"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">所有状态</option>
                        <option value="active">在售</option>
                        <option value="inactive">已下架</option>
                        <option value="pending_review">待审核</option>
                    </select>
                    <select
                        className="border rounded-lg px-3 py-2 bg-white text-sm"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="all">所有分类</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="搜索商品标题..."
                            className="pl-10 pr-4 py-2 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <div className="absolute left-3 top-2.5 text-gray-400">
                            <SearchIcon />
                        </div>
                    </div>
                </div>
            </div>

            {selectedIds.length > 0 && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm text-blue-800">已选择 {selectedIds.length} 个商品</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleBatchAction('delete')}
                            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                            批量下架
                        </button>
                        <button
                            onClick={() => handleBatchAction('promote')}
                            className="px-3 py-1.5 text-xs bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                        >
                            批量推荐
                        </button>
                        <button
                            onClick={() => setSelectedIds([])}
                            className="px-3 py-1.5 text-xs bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                        >
                            取消选择
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-4 py-3 w-12">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.length === products.length && products.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-gray-300"
                                />
                            </th>
                            <th className="px-4 py-3 font-semibold text-gray-600">商品</th>
                            <th className="px-4 py-3 font-semibold text-gray-600">分类</th>
                            <th className="px-4 py-3 font-semibold text-gray-600">价格</th>
                            <th className="px-4 py-3 font-semibold text-gray-600">卖家</th>
                            <th className="px-4 py-3 font-semibold text-gray-600">状态</th>
                            <th className="px-4 py-3 font-semibold text-gray-600">数据</th>
                            <th className="px-4 py-3 font-semibold text-gray-600 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-4 py-3"><div className="w-4 h-4 bg-gray-200 rounded"></div></td>
                                    <td className="px-4 py-3"><div className="h-12 w-12 bg-gray-200 rounded"></div></td>
                                    <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 rounded"></div></td>
                                    <td className="px-4 py-3"><div className="h-4 w-12 bg-gray-200 rounded"></div></td>
                                    <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded"></div></td>
                                    <td className="px-4 py-3"><div className="h-6 w-16 bg-gray-200 rounded-full"></div></td>
                                    <td className="px-4 py-3"><div className="h-4 w-12 bg-gray-200 rounded"></div></td>
                                    <td className="px-4 py-3"></td>
                                </tr>
                            ))
                        ) : products.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
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
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(product.id)}
                                            onChange={() => toggleSelect(product.id)}
                                            className="w-4 h-4 rounded border-gray-300"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={product.images?.[0] || 'https://via.placeholder.com/60'}
                                                alt=""
                                                className="w-12 h-12 rounded object-cover border"
                                            />
                                            <div className="max-w-xs">
                                                <div className="font-medium text-gray-900 truncate">{product.title}</div>
                                                <div className="text-xs text-gray-500">ID: {product.id.slice(0, 8)}...</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                                            {product.category}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-gray-900">¥{product.price}</td>
                                    <td className="px-4 py-3 text-gray-600">{product.seller_email?.split('@')[0] || '未知'}</td>
                                    <td className="px-4 py-3">
                                        {product.status === 'active' ? (
                                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">在售</span>
                                        ) : product.status === 'inactive' ? (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">下架</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">待审</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <EyeIcon /> {product.views_count || 0}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handlePromote(product.id, product.is_promoted)}
                                                className="p-1.5 hover:bg-yellow-50 rounded transition-colors"
                                                title={product.is_promoted ? '取消推荐' : '推荐'}
                                            >
                                                <StarIcon filled={product.is_promoted} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(product.id);
                                                }}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="删除"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center mt-6 gap-2">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50 text-sm"
                    >
                        上一页
                    </button>
                    <span className="px-4 py-2 text-gray-600 text-sm">
                        {page} / {totalPages}
                    </span>
                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50 text-sm"
                    >
                        下一页
                    </button>
                </div>
            )}

            {/* Edit Modal */}
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
        </div>
    );
};
