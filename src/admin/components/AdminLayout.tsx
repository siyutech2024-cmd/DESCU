import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AdminSidebar } from '../components/AdminSidebar';
import { supabase } from '../../services/supabase';
import { adminApi } from '../services/adminApi';
import { Bell, Search, User } from 'lucide-react';

export const AdminLayout: React.FC = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [adminInfo, setAdminInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        checkAdminAccess();
    }, []);

    const checkAdminAccess = async () => {
        try {
            // 检查 Dev Mode
            if (localStorage.getItem('descu_admin_dev_mode') === 'true') {
                setAdminInfo({
                    email: 'admin@local.com',
                    role: 'admin',
                    user_metadata: { role: 'admin' }
                });
                setLoading(false);
                return;
            }

            const result = await adminApi.getAdminInfo();

            if (result.error) {
                console.error('不是管理员:', result.error);
                alert('您没有管理员权限，请使用管理员账号登录');
                await supabase.auth.signOut();
                navigate('/admin/login');
                return;
            }

            setAdminInfo(result.data);
            setLoading(false);
        } catch (error) {
            console.error('验证管理员权限失败:', error);
            navigate('/admin/login');
        }
    };

    const handleLogout = async () => {
        if (confirm('确定要退出登录吗？')) {
            localStorage.removeItem('descu_admin_dev_mode');
            await supabase.auth.signOut();
            navigate('/admin/login');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">正在验证管理员权限...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <AdminSidebar
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
                onLogout={handleLogout}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative flex-1 max-w-lg">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="搜索..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Notifications */}
                        <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <Bell className="w-5 h-5 text-gray-600" />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                        </button>

                        {/* Admin Profile */}
                        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                            <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">
                                    {adminInfo?.email || '管理员'}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {adminInfo?.role === 'super_admin' ? '超级管理员' : '管理员'}
                                    {localStorage.getItem('descu_admin_dev_mode') === 'true' && (
                                        <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-800 px-1 rounded">DEV</span>
                                    )}
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
