import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AdminLogin } from './pages/AdminLogin';
import { AdminLayout } from './components/AdminLayout';
import { Dashboard } from './pages/Dashboard';
import { ProductList } from './pages/ProductList';
import { UserList } from './pages/UserList';
import { MessageMonitor } from './pages/MessageMonitor';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { AdminManagement } from './pages/AdminManagement';
import { RolePermissions } from './pages/RolePermissions';
import { ProductReview } from './pages/ProductReview';
import DisputeList from './pages/DisputeList';
import OrderList from './pages/OrderList';
import PayoutManagement from './pages/PayoutManagement';

export const AdminApp: React.FC = () => {
    return (
        <>
            <Toaster />
            <Routes>
                <Route path="login" element={<AdminLogin />} />
                <Route path="" element={<AdminLayout />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="products" element={<ProductList />} />
                    <Route path="users" element={<UserList />} />
                    <Route path="messages" element={<MessageMonitor />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="admins" element={<AdminManagement />} />
                    <Route path="roles" element={<RolePermissions />} />
                    <Route path="reviews" element={<ProductReview />} />
                    <Route path="orders" element={<OrderList />} />
                    <Route path="disputes" element={<DisputeList />} />
                    <Route path="payouts" element={<PayoutManagement />} />
                </Route>
            </Routes>
        </>
    );
};
