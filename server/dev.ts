/**
 * Local development API server.
 *
 * Runs the same Express app that Vercel serves from api/index.ts.
 *   npm run server
 * Vite proxies /api/* to this server (see vite.config.ts).
 */
import 'dotenv/config';
import { createApp } from '../api/_lib/app';
// Standalone Vercel functions that vercel.json rewrites to in production;
// mounted here so /sitemap.xml and /llms-full.txt behave the same locally.
import sitemapHandler from '../api/sitemap';
import llmsFullHandler from '../api/llms-full';

const PORT = Number(process.env.PORT) || 3000;

const app = createApp({
    extraRoutes: app => {
        app.get(['/sitemap.xml', '/api/sitemap.xml', '/api/sitemap'], sitemapHandler);
        app.get(['/llms-full.txt', '/api/llms-full'], llmsFullHandler);
    },
});

app.listen(PORT, () => {
    console.log(`DESCU API listening on http://localhost:${PORT}`);
});
