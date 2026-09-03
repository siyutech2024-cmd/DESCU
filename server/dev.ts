/**
 * Local development API server.
 *
 * Runs the same Express app that Vercel serves from api/index.ts.
 *   npm run server
 * Vite proxies /api/* to this server (see vite.config.ts).
 */
import 'dotenv/config';
import { createApp } from '../api/_lib/app';

const PORT = Number(process.env.PORT) || 3000;

createApp().listen(PORT, () => {
    console.log(`DESCU API listening on http://localhost:${PORT}`);
});
