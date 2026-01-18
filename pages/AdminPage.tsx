import React, { useState } from 'react';
import { Route, Routes, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, AlertCircle, Menu, UserCircle } from 'lucide-react';
import { AdminDashboardStats } from '../components/admin/AdminDashboardStats';
import { AdminOrders } from '../components/admin/AdminOrders';
import { AdminDisputes } from '../components/admin/AdminDisputes';

export const AdminPage: React.FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const location = useLocation();

    const navItems = [
        { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
        { path: '/admin/disputes', icon: AlertCircle, label: 'Disputes' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 bg-white border-r border-gray-200 w-64 transform transition-transform duration-300 z-30 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
                <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-600 text-white rounded-lg flex items-center justify-center font-bold">A</div>
                    <span className="font-bold text-xl text-gray-900">Admin Area</span>
                </div>

                <nav className="p-4 space-y-1">
                    {navItems.map(item => {
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive ? 'bg-brand-50 text-brand-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <item.icon size={20} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
                    <div className="flex items-center gap-3 px-4 py-3 text-gray-500">
                        <UserCircle size={20} />
                        <span className="text-sm">Admin User</span>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between md:hidden">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-600">
                        <Menu size={24} />
                    </button>
                    <span className="font-bold text-gray-800">Admin</span>
                    <div className="w-10"></div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <Routes>
                        <Route path="dashboard" element={<AdminDashboardStats />} />
                        <Route path="orders" element={<AdminOrders />} />
                        <Route path="disputes" element={<AdminDisputes />} />
                        <Route path="*" element={<AdminDashboardStats />} />
                    </Routes>
                </div>
            </main>
        </div>
    );
};
