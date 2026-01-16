
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
    // Base path should be / for production deployment on root domain
    base: '/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui': ['lucide-react', 'react-hot-toast', 'framer-motion'],
            'supabase': ['@supabase/supabase-js'],
            'stripe': ['@stripe/stripe-js', '@stripe/react-stripe-js']
          }
        }
      }
    },
    define: {
      'process.env': {
        API_KEY: env.API_KEY || process.env.API_KEY
      }
    }
  };
});