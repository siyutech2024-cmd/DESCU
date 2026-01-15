import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/adminApi'
import { showToast } from '../utils/toast';
import { Shield, UserPlus, Edit2, Trash2, AlertCircle } from 'lucide-react';

interface Admin {
    id: string;
    email: string;
    name: string;
    role: string;
    is_active: boolean;
    last_login?: string;
    created_at: string;
}

export const AdminManagement: React.FC = () => {
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
    const [formData, setFormData] = useState({
        email: '',
        name: '',
        role: 'admin',
    });

    useEffect(() => {
        loadAdmins();
    }, []);

    const loadAdmins = async () => {
        setLoading(true);
        try {
            // 直接查询admin_users表
            const { data, error } = await (window as any).supabaseClient
                .from('admin_users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAdmins(data || []);
        } catch (error) {
            console.error('加载管理员失败:', error);
            showToast.error('加载管理员列表失败');
        } finally {
            setLoading(false);
        }
    };

    const handleAddAdmin = async () => {
        if (!formData.email || !formData.name) {
            showToast.error('请填写所有必填字段');
            return;
        }

        try {
            const { data, error } = await (window as any).supabaseClient
                .from('admin_users')
                .insert([{
                    id: `admin-${Date.now()}`,
                    email: formData.email,
                    name: formData.name,
                    role: formData.role,
                    is_active: true,
                }])
                .select();

            if (error) throw error;

            showToast.success('管理员添加成功');
            setShowAddModal(false);
            setFormData({ email: '', name: '', role: 'admin' });
            loadAdmins();
        } catch (error) {
            console.error('添加管理员失败:', error);
            showToast.error('添加管理员失败');
        }
    };

    const handleDeleteAdmin = async (id: string) => {
        if (!confirm('确定要删除该管理员吗？')) return;

        try {
            const { error } = await (window as any).supabaseClient
                .from('admin_users')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showToast.success('管理员删除成功');
            loadAdmins();
        } catch (error) {
            console.error('删除管理员失败:', error);
            showToast.error('删除管理员失败');
        }
    };

    const handleToggleActive = async (admin: Admin) => {
        try {
            const { error } = await (window as any).supabaseClient
                .from('admin_users')
                .update({ is_active: !admin.is_active })
                .eq('id', admin.id);

            if (error) throw error;

            showToast.success(`管理员已${admin.is_active ? '禁用' : '启用'}`);
            loadAdmins();
        } catch (error) {
            console.error('更新管理员状态失败:', error);
            showToast.error('操作失败');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-gray-900">管理员管理</h1>
                    <p className="text-gray-600 mt-1">管理系统管理员账户</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <UserPlus className="w-5 h-5" />
                    添加管理员
                </button>
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                    <h3 className="font-semibold text-yellow-900">重要提示</h3>
                    <p className="text-sm text-yellow-800 mt-1">
                        添加管理员后，需要在Supabase Auth中手动更新对应用户的metadata，添加 <code className="bg-yellow-100 px-1 rounded">role: admin</code>
                    </p>
                </div>
            </div>

            {/* Admin List */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">管理员</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">角色</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">状态</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">最后登录</th>
                            <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    加载中...
                                </td>
                            </tr>
                        ) : admins.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    暂无管理员
                                </td>
                            </tr>
                        ) : (
                            admins.map((admin) => (
                                <tr key={admin.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div>
                                            <div className="font-medium text-gray-900">{admin.name}</div>
                                            <div className="text-sm text-gray-500">{admin.email}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs rounded-full ${admin.role === 'super_admin'
                                                ? 'bg-purple-100 text-purple-800'
                                                : 'bg-blue-100 text-blue-800'
                                            }`}>
                                            {admin.role === 'super_admin' ? '超级管理员' : '管理员'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggleActive(admin)}
                                            className={`px-2 py-1 text-xs rounded-full ${admin.is_active
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-800'
                                                }`}
                                        >
                                            {admin.is_active ? '激活' : '禁用'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {admin.last_login
                                            ? new Date(admin.last_login).toLocaleDateString('zh-CN')
                                            : '从未登录'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDeleteAdmin(admin.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Admin Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                        <h2 className="text-2xl font-bold mb-4">添加管理员</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱 *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="admin@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="管理员名称"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    <option value="admin">管理员</option>
                                    <option value="super_admin">超级管理员</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleAddAdmin}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                添加
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
