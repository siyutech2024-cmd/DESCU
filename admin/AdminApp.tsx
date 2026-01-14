import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLogin } from './pages/AdminLogin';
import { AdminLayout } from './components/AdminLayout';
import { Dashboard } from './pages/Dashboard';

// 占位组件，后续可以扩展
import { ProductList } from './pages/ProductList';
import { UserList } from './pages/UserList';
import { MessageMonitor } from './pages/MessageMonitor';
const Reports = () => <div className="p-8"><h2 className="text-2xl font-bold">数据报表</h2><p className="text-gray-600 mt-2">功能开发中...</p></div>;
const AdminSettings = () => <div className="p-8"><h2 className="text-2xl font-bold">设置</h2><p className="text-gray-600 mt-2">功能开发中...</p></div>;

export const AdminApp: React.FC = () => {
    return (
        <Routes>
            <Route path="login" element={<AdminLogin />} />
            <Route path="" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
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
