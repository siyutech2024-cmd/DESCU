import React from 'react';
import ReactDOM from 'react-dom/client';
import RootApp from './RootApp';
import './index.css';

// 部署后 chunk 文件名变化导致 404，自动刷新一次获取新版本
window.addEventListener('error', (e) => {
  if (e.message?.includes('Failed to fetch dynamically imported module') ||
    e.message?.includes('Loading chunk') ||
    e.message?.includes('Loading CSS chunk')) {
    const lastReload = sessionStorage.getItem('chunk_reload');
    const now = Date.now();
    // 防止无限刷新：30秒内最多刷新一次
    if (!lastReload || now - parseInt(lastReload) > 30000) {
      sessionStorage.setItem('chunk_reload', String(now));
      window.location.reload();
    }
  }
}, true);

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.message?.includes('Failed to fetch dynamically imported module')) {
    const lastReload = sessionStorage.getItem('chunk_reload');
    const now = Date.now();
    if (!lastReload || now - parseInt(lastReload) > 30000) {
      sessionStorage.setItem('chunk_reload', String(now));
      window.location.reload();
    }
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
