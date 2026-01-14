
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Fix: Cast process to any to avoid TS error regarding missing cwd() in Process type
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        }
      }
    },
    plugins: [react()],
    // 关键配置：使用相对路径，允许生成的静态文件在本地文件夹或子目录中直接运行
    base: './',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
    },
    define: {
      'process.env': {
        API_KEY: env.API_KEY || process.env.API_KEY
      }
    }
  };
});