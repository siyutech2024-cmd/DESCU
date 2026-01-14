import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/adminApi';
import { AdminUserInfo } from '../types/admin';

// Simple Icons
const SearchIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>);
const CheckCircleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>);
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);

export const UserList: React.FC = () => {
    const [users, setUsers] = useState<AdminUserInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterVerified, setFilterVerified] = useState<string>('all'); // all, true, false
    const [selectedUser, setSelectedUser] = useState<AdminUserInfo | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getUsers({
                page,
                limit: 10,
                search,
                is_verified: filterVerified === 'all' ? undefined : filterVerified
            });
            if (res.data) {
                setUsers(res.data.users);
                setTotalPages(res.data.pagination.totalPages);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers();
        }, 300); // Debounce
        return () => clearTimeout(timer);
    }, [page, search, filterVerified]);

    const handleVerify = async (userId: string, currentStatus: boolean) => {
        if (confirm(`确定要${currentStatus ? '取消' : '通过'}该用户的实名认证吗？`)) {
            await adminApi.updateUserVerification(userId, !currentStatus);
            fetchUsers();
        }
    };

    const handleDelete = async (userId: string) => {
        if (prompt('请输入 "delete" 确认删除该用户（此操作不可恢复）') === 'delete') {
            await adminApi.deleteUser(userId, true);
            fetchUsers();
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">用户管理</h2>
                <div className="flex gap-4">
                    <select
                        className="border rounded-lg px-3 py-2 bg-white"
                        value={filterVerified}
                        onChange={(e) => setFilterVerified(e.target.value)}
                    >
                        <option value="all">所有状态</option>
                        <option value="true">已认证</option>
                        <option value="false">未认证</option>
                    </select>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="搜索用户..."
                            className="pl-10 pr-4 py-2 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <div className="absolute left-3 top-2.5 text-gray-400">
                            <SearchIcon />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-gray-600">用户</th>
                            <th className="px-6 py-4 font-semibold text-gray-600">邮箱</th>
                            <th className="px-6 py-4 font-semibold text-gray-600">状态</th>
                            <th className="px-6 py-4 font-semibold text-gray-600">数据统计</th>
                            <th className="px-6 py-4 font-semibold text-gray-600 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-6 py-4"><div className="h-10 w-10 bg-gray-200 rounded-full"></div></td>
                                    <td className="px-6 py-4"><div className="h-4 w-32 bg-gray-200 rounded"></div></td>
                                    <td className="px-6 py-4"><div className="h-6 w-16 bg-gray-200 rounded-full"></div></td>
                                    <td className="px-6 py-4"><div className="h-4 w-24 bg-gray-200 rounded"></div></td>
                                    <td className="px-6 py-4"></td>
                                </tr>
                            ))
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    暂无用户数据
                                </td>
                            </tr>
                        ) : (
                            users.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <img src={user.avatar || 'https://via.placeholder.com/40'} alt="" className="w-10 h-10 rounded-full object-cover border" />
                                            <div>
                                                <div className="font-medium text-gray-900">{user.name || '未命名'}</div>
                                                <div className="text-xs text-gray-500">ID: {user.id.slice(0, 8)}...</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{user.email}</td>
                                    <td className="px-6 py-4">
                                        {user.is_verified ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <CheckCircleIcon /> 已认证
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                未认证
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        <div>发布商品: {user.product_count}</div>
                                        <div>对话数量: {user.conversation_count}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleVerify(user.id, user.is_verified)}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${user.is_verified
                                                        ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                    }`}
                                            >
                                                {user.is_verified ? '取消认证' : '通过认证'}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="删除用户"
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

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center mt-6 gap-2">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                    >
                        上一页
                    </button>
                    <span className="px-4 py-2 text-gray-600">
                        {page} / {totalPages}
                    </span>
                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                    >
                        下一页
                    </button>
                </div>
            )}
        </div>
    );
};
