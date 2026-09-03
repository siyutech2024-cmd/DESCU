import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Local API server (see server/dev.ts)
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          ui: ['lucide-react', 'react-hot-toast'],
          supabase: ['@supabase/supabase-js'],
          stripe: ['@stripe/stripe-js', '@stripe/react-stripe-js'],
        },
      },
    },
  },
});
