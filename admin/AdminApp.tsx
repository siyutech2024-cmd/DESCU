import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLogin } from './pages/AdminLogin';
import { AdminLayout } from './components/AdminLayout';
import { Dashboard } from './pages/Dashboard';

// 占位组件，后续可以扩展
const ProductList = () => <div className="p-8"><h2 className="text-2xl font-bold">商品管理</h2><p className="text-gray-600 mt-2">功能开发中...</p></div>;
const UserList = () => <div className="p-8"><h2 className="text-2xl font-bold">用户管理</h2><p className="text-gray-600 mt-2">功能开发中...</p></div>;
const MessageMonitor = () => <div className="p-8"><h2 className="text-2xl font-bold">消息监控</h2><p className="text-gray-600 mt-2">功能开发中...</p></div>;
const Reports = () => <div className="p-8"><h2 className="text-2xl font-bold">数据报表</h2><p className="text-gray-600 mt-2">功能开发中...</p></div>;
const AdminSettings = () => <div className="p-8"><h2 className="text-2xl font-bold">设置</h2><p className="text-gray-600 mt-2">功能开发中...</p></div>;

export const AdminApp: React.FC = () => {
    return (
        <Routes>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="products" element={<ProductList />} />
                <Route path="users" element={<UserList />} />
                <Route path="messages" element={<MessageMonitor />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<AdminSettings />} />
            </Route>
        </Routes>
    );
};
