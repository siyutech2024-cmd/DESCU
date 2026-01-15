import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/adminApi';
import { AdminUserInfo } from '../types/admin';
import { UserDetailModal } from '../components/UserDetailModal';
import { UserBatchOperationModal } from '../components/UserBatchOperationModal';
import { showToast } from '../utils/toast';
import { exportToCSV } from '../utils/export';
import { Search, Download, Filter, CheckCircle, Trash2, X } from 'lucide-react';

export const UserList: React.FC = () => {
    const [users, setUsers] = useState<AdminUserInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterVerified, setFilterVerified] = useState<string>('all');
    const [selectedUser, setSelectedUser] = useState<AdminUserInfo | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getUsers({
                page,
                limit: 15,
                search,
                is_verified: filterVerified === 'all' ? undefined : filterVerified,
                start_date: startDate || undefined,
                end_date: endDate || undefined
            });
            if (res.data) {
                setUsers(res.data.users);
                setTotalPages(res.data.pagination.totalPages);
            }
        } catch (error) {
            console.error(error);
            showToast.error('加载用户失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(fetchUsers, 300);
        return () => clearTimeout(timer);
    }, [page, search, filterVerified, startDate, endDate]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        setSelectedIds(prev =>
            prev.length === users.length ? [] : users.map(u => u.id)
        );
    };

    const handleBatchOperation = async (operation: string) => {
        if (selectedIds.length === 0) {
            showToast.error('请先选择用户');
            return;
        }

        try {
            if (operation === 'verify') {
                for (const id of selectedIds) {
                    await adminApi.updateUserVerification(id, true);
                }
                showToast.success(`已认证 ${selectedIds.length} 个用户`);
            } else if (operation === 'unverify') {
                for (const id of selectedIds) {
                    await adminApi.updateUserVerification(id, false);
                }
                showToast.success(`已取消 ${selectedIds.length} 个用户的认证`);
            } else if (operation === 'export') {
                const exportUsers = users.filter(u => selectedIds.includes(u.id));
                exportToCSV(exportUsers as any, '用户列表');
                showToast.success(`已导出 ${selectedIds.length} 个用户`);
                return; // Don't refresh
            }

            setSelectedIds([]);
            fetchUsers();
        } catch (error) {
            showToast.error('批量操作失败');
        }
    };

    const handleVerify = async (userId: string, currentStatus: boolean) => {
        try {
            await adminApi.updateUserVerification(userId, !currentStatus);
            showToast.success(currentStatus ? '已取消认证' : '认证成功');
            fetchUsers();
        } catch (error) {
            showToast.error('操作失败');
        }
    };

    const handleDelete = async (userId: string) => {
        if (prompt('请输入 "delete" 确认删除该用户（此操作不可恢复）') === 'delete') {
            try {
                await adminApi.deleteUser(userId, true);
                showToast.success('用户已删除');
                fetchUsers();
            } catch (error) {
                showToast.error('删除失败');
            }
        }
    };

    const handleExport = () => {
        const dataToExport = selectedIds.length > 0
            ? users.filter(u => selectedIds.includes(u.id))
            : users;

        if (dataToExport.length === 0) {
            showToast.error('没有可导出的数据');
            return;
        }

        exportToCSV(dataToExport as any, '用户列表');
        showToast.success(`已导出 ${dataToExport.length} 个用户`);
    };

    return (
        <div className="space-y-6 pb-24 animate-fade-in-up">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-gray-900 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">用户管理</h1>
                <p className="text-gray-600 mt-1">管理平台所有用户</p>
            </div>

            {/* Filters */}
            <div className="glass-panel p-4 rounded-xl">
                <div className="flex flex-wrap gap-3 items-center">
                    {/* Search */}
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="搜索用户..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 glass-input rounded-lg focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Verified Filter */}
                    <select
                        value={filterVerified}
                        onChange={(e) => setFilterVerified(e.target.value)}
                        className="px-4 py-2 glass-input rounded-lg focus:outline-none cursor-pointer"
                    >
                        <option value="all">全部用户</option>
                        <option value="true">已认证</option>
                        <option value="false">未认证</option>
                    </select>

                    {/* Advanced Filters Toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all ${showFilters ? 'bg-brand-50 border-brand-200 text-brand-700' : 'hover:bg-gray-50 border-gray-200 text-gray-600'
                            }`}
                    >
                        <Filter className="w-4 h-4" />
                        日期筛选
                    </button>

                    {/* Export */}
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-all active:scale-95"
                    >
                        <Download className="w-4 h-4" />
                        导出
                    </button>
                </div>

                {/* Advanced Filters Panel */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 animate-slide-down">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                注册开始日期
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 glass-input rounded-lg focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                注册结束日期
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 glass-input rounded-lg focus:outline-none"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Batch Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between shadow-sm animate-fade-in">
                    <span className="text-blue-900 font-bold flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-blue-500" />
                        已选择 {selectedIds.length} 个用户
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowBatchModal(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md hover:shadow-lg transition-all active:scale-95"
                        >
                            批量操作
                        </button>
                        <button
                            onClick={() => setSelectedIds([])}
                            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all"
                        >
                            取消选择
                        </button>
                    </div>
                </div>
            )}

            {/* User Table */}
            <div className="glass-panel rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left w-12">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.length === users.length && users.length > 0}
                                        onChange={toggleSelectAll}
                                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                    />
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">用户</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">邮箱</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">认证状态</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">统计</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                                            <p className="text-sm">加载数据中...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <p className="text-lg font-medium text-gray-400">暂无用户数据</p>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr
                                        key={user.id}
                                        className={`group transition-all hover:bg-gray-50/80 cursor-pointer ${selectedIds.includes(user.id) ? 'bg-blue-50/30' : ''}`}
                                        onClick={() => setSelectedUser(user)}
                                    >
                                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(user.id)}
                                                onChange={() => toggleSelect(user.id)}
                                                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <img
                                                        src={user.avatar || 'https://via.placeholder.com/40'}
                                                        alt=""
                                                        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                                                    />
                                                    {user.is_verified && (
                                                        <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-0.5 border border-white">
                                                            <CheckCircle size={10} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 group-hover:text-brand-600 transition-colors">
                                                        {user.name || '未命名用户'}
                                                    </div>
                                                    <div className="text-xs text-gray-400 font-mono">ID: {user.id.slice(0, 8)}...</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-gray-600 font-medium">{user.email}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.is_verified ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100">
                                                    <CheckCircle className="w-3 h-3" />
                                                    已认证
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                                                    未认证
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
                                                <div title="发布商品" className="flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                                    {user.product_count || 0} 商品
                                                </div>
                                                <div title="参与对话" className="flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                                    {user.conversation_count || 0} 对话
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleVerify(user.id, user.is_verified)}
                                                    className={`p-2 rounded-lg transition-colors ${user.is_verified
                                                        ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                                                        : 'text-green-600 hover:bg-green-50'
                                                        }`}
                                                    title={user.is_verified ? '取消认证' : '认证用户'}
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(user.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="删除用户"
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
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
                        <span className="text-sm text-gray-500 font-medium">
                            第 {page} 页，共 {totalPages} 页
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
                            >
                                上一页
                            </button>
                            <button
                                disabled={page === totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
                            >
                                下一页
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {selectedUser && (
                <UserDetailModal
                    user={selectedUser}
                    isOpen={!!selectedUser}
                    onClose={() => setSelectedUser(null)}
                />
            )}

            {showBatchModal && (
                <UserBatchOperationModal
                    selectedCount={selectedIds.length}
                    onClose={() => setShowBatchModal(false)}
                    onExecute={handleBatchOperation}
                />
            )}
        </div>
    );
};
