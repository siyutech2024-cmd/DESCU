import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Package,
    Users,
    MessageSquare,
    BarChart3,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

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
    const menuItems = [
        { path: '/admin/dashboard', icon: LayoutDashboard, label: '仪表板' },
        { path: '/admin/products', icon: Package, label: '商品管理' },
        { path: '/admin/users', icon: Users, label: '用户管理' },
        { path: '/admin/messages', icon: MessageSquare, label: '消息监控' },
        { path: '/admin/reports', icon: BarChart3, label: '数据报表' },
        { path: '/admin/settings', icon: Settings, label: '设置' },
    ];

    return (
        <div
            className={`${isCollapsed ? 'w-20' : 'w-64'
                } bg-slate-900 min-h-screen text-white transition-all duration-300 flex flex-col`}
        >
            {/* Logo */}
            <div className="p-6 flex items-center justify-between border-b border-slate-800">
                {!isCollapsed && (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">D</span>
                        </div>
                        <div>
                            <h2 className="font-bold text-lg">DESCU</h2>
                            <p className="text-xs text-slate-400">管理后台</p>
                        </div>
                    </div>
                )}
                <button
                    onClick={onToggleCollapse}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                    {isCollapsed ? (
                        <ChevronRight className="w-5 h-5" />
                    ) : (
                        <ChevronLeft className="w-5 h-5" />
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                                ? 'bg-orange-600 text-white shadow-lg'
                                : 'text-slate-300 hover:bg-slate-800'
                            }`
                        }
                    >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        {!isCollapsed && <span className="font-medium">{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && <span className="font-medium">退出登录</span>}
                </button>
            </div>
        </div>
    );
};
