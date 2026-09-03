/**
 * Vercel serverless entry point.
 * vercel.json rewrites /api/(.*) here; all routing lives in ./_lib.
 */
import { createApp } from './_lib/app.js';

const app = createApp();

export default app;
