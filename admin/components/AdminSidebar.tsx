import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Package,
    Users,
    MessageSquare,
    BarChart3,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Shield,
    CheckCircle
} from 'lucide-react';

import { adminApi } from '../services/adminApi';

interface AdminSidebarProps {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onLogout: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
    isCollapsed,
    onToggleCollapse,
    onLogout
}) => {
    const location = useLocation();
    const [pendingReviewsCount, setPendingReviewsCount] = useState<number>(0);

    const isActive = (path: string) => {
        return location.pathname.startsWith(`/admin/${path}`);
    };

    // 获取待审核商品数量
    useEffect(() => {
        const fetchPendingCount = async () => {
            try {
                const response = await adminApi.getProducts({
                    status: 'pending_review',
                    limit: 1,
                    page: 1
                });

                if (response.data && response.data.pagination) {
                    setPendingReviewsCount(response.data.pagination.total);
                }
            } catch (error) {
                console.error('获取待审核数量失败', error);
            }
        };

        fetchPendingCount();
        const interval = setInterval(fetchPendingCount, 60000); // 每分钟刷新
        return () => clearInterval(interval);
    }, []);

    const menuItems = [
        {
            section: '内容管理',
            items: [
                {
                    path: 'dashboard',
                    icon: LayoutDashboard,
                    label: '仪表板',
                    color: 'text-blue-600'
                },
                {
                    path: 'products',
                    icon: Package,
                    label: '商品管理',
                    color: 'text-purple-600'
                },
                {
                    path: 'users',
                    icon: Users,
                    label: '用户管理',
                    color: 'text-green-600'
                },
                {
                    path: 'messages',
                    icon: MessageSquare,
                    label: '对话监控',
                    color: 'text-orange-600'
                },
                {
                    path: 'reviews',
                    icon: CheckCircle,
                    label: '商品审核',
                    color: 'text-yellow-600',
                    badge: pendingReviewsCount > 0 ? String(pendingReviewsCount) : undefined
                },
            ]
        },
        {
            section: '系统管理',
            items: [
                {
                    path: 'reports',
                    icon: BarChart3,
                    label: '数据报表',
                    color: 'text-indigo-600'
                },
                {
                    path: 'admins',
                    icon: Shield,
                    label: '管理员',
                    color: 'text-red-600'
                },
                {
                    path: 'settings',
                    icon: Settings,
                    label: '系统设置',
                    color: 'text-gray-600'
                },
            ]
        }
    ];

    return (
        <aside
            className={`${isCollapsed ? 'w-20' : 'w-64'
                } bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}
        >
            {/* Logo */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
                {!isCollapsed && (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-pink-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">D</span>
                        </div>
                        <span className="text-xl font-black bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
                            DESCU
                        </span>
                    </div>
                )}
                <button
                    onClick={onToggleCollapse}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    {isCollapsed ? (
                        <ChevronRight className="w-5 h-5" />
                    ) : (
                        <ChevronLeft className="w-5 h-5" />
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4">
                {menuItems.map((section, sectionIndex) => (
                    <div key={sectionIndex} className="mb-6">
                        {!isCollapsed && (
                            <div className="px-4 mb-2">
                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    {section.section}
                                </span>
                            </div>
                        )}
                        <div className="space-y-1 px-3">
                            {section.items.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.path);

                                return (
                                    <Link
                                        key={item.path}
                                        to={`/admin/${item.path}`}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${active
                                            ? 'bg-gradient-to-r from-orange-50 to-pink-50 text-orange-600 font-medium shadow-sm'
                                            : 'text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        <Icon
                                            className={`w-5 h-5 ${active ? 'text-orange-600' : item.color
                                                } group-hover:scale-110 transition-transform`}
                                        />
                                        {!isCollapsed && (
                                            <span className="flex-1">{item.label}</span>
                                        )}
                                        {!isCollapsed && item.badge && (
                                            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                                                {item.badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-gray-200">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    {!isCollapsed && <span>退出登录</span>}
                </button>
            </div>
        </aside>
    );
};
