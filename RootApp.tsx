import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { AdminApp } from './admin/AdminApp';

/**
 * 根应用组件
 * 整合用户端和管理后台路由
 */
const RootApp: React.FC = () => {
    return (
        <BrowserRouter>
            <Routes>
                {/* 管理后台路由 */}
                <Route path="/admin/*" element={<AdminApp />} />

                {/* 用户端应用 - 默认路由 */}
                <Route path="/*" element={<App />} />
            </Routes>
        </BrowserRouter>
    );
};

export default RootApp;
