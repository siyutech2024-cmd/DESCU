import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Component gallery for visual checks (never deployed):
 *   VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite build -c vite.gallery.config.ts
 *   npx vite preview -c vite.gallery.config.ts   → http://localhost:4174/gallery.html?view=chat-list
 */
export default defineConfig({
    plugins: [react()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    build: { outDir: 'dist-gallery', rollupOptions: { input: 'gallery.html' } },
    preview: { port: 4174 },
});
