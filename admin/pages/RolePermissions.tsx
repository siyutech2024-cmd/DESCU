import React from 'react';
import { Shield, Users, Lock, Eye } from 'lucide-react';

export const RolePermissions: React.FC = () => {
    const roles = [
        {
            name: 'super_admin',
            label: '超级管理员',
            description: '拥有所有权限',
            color: 'bg-purple-100 text-purple-800',
            count: 2
        },
        {
            name: 'admin',
            label: '管理员',
            description: '拥有大部分管理权限',
            color: 'bg-blue-100 text-blue-800',
            count: 5
        },
        {
            name: 'moderator',
            label: '审核员',
            description: '仅能审核内容',
            color: 'bg-green-100 text-green-800',
            count: 3
        },
        {
            name: 'support',
            label: '客服',
            description: '仅能查看和回复',
            color: 'bg-yellow-100 text-yellow-800',
            count: 8
        }
    ];

    const permissions = [
        { module: 'Dashboard', view: true, edit: false, delete: false },
        { module: '商品管理', view: true, edit: true, delete: true },
        { module: '用户管理', view: true, edit: true, delete: false },
        { module: '对话监控', view: true, edit: true, delete: true },
        { module: '管理员管理', view: true, edit: true, delete: true },
        { module: '系统设置', view: true, edit: true, delete: false },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-gray-900">角色权限</h1>
                <p className="text-gray-600 mt-1">管理系统角色和权限配置</p>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    💡 提示：完整的权限管理功能将在第2批实施中完成。当前显示的是基础权限框架。
                </p>
            </div>

            {/* Roles Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {roles.map((role) => (
                    <div key={role.name} className="bg-white rounded-xl p-6 shadow-sm border">
                        <div className="flex items-start justify-between mb-4">
                            <Shield className="w-8 h-8 text-gray-400" />
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${role.color}`}>
                                {role.count} 人
                            </span>
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 mb-1">{role.label}</h3>
                        <p className="text-sm text-gray-600">{role.description}</p>
                    </div>
                ))}
            </div>

            {/* Permissions Matrix */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-6 border-b">
                    <h2 className="text-lg font-bold text-gray-900">权限矩阵（示例）</h2>
                    <p className="text-sm text-gray-600 mt-1">超级管理员的权限配置</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">模块</th>
                                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">
                                    <Eye className="w-4 h-4 inline mr-1" />
                                    查看
                                </th>
                                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">
                                    <Lock className="w-4 h-4 inline mr-1" />
                                    编辑
                                </th>
                                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">
                                    <Shield className="w-4 h-4 inline mr-1" />
                                    删除
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {permissions.map((perm, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{perm.module}</td>
                                    <td className="px-6 py-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={perm.view}
                                            readOnly
                                            className="w-4 h-4 rounded"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={perm.edit}
                                            readOnly
                                            className="w-4 h-4 rounded"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={perm.delete}
                                            readOnly
                                            className="w-4 h-4 rounded"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Coming Soon */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-8 text-center border">
                <Shield className="w-16 h-16 text-purple-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">更多功能即将推出</h3>
                <p className="text-gray-600 mb-4">
                    完整的角色权限管理系统将在第2批功能中实现，包括：
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-2xl mx-auto">
                    <div className="bg-white p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-1">自定义角色</h4>
                        <p className="text-sm text-gray-600">创建和管理自定义角色</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-1">权限配置</h4>
                        <p className="text-sm text-gray-600">细粒度权限控制</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-1">角色分配</h4>
                        <p className="text-sm text-gray-600">批量分配用户角色</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
