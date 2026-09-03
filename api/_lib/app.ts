import express from 'express';
import cors from 'cors';
import { registerRoutes } from './routes/index.js';

export const ALLOWED_ORIGINS: (string | RegExp)[] = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://descu.ai',
    'https://www.descu.ai',
    /https:\/\/.*\.vercel\.app$/
];

/**
 * Build the DESCU API Express application.
 *
 * The same app is exported as a Vercel serverless function (api/index.ts) and
 * listened on directly by the local dev server (server/dev.ts).
 */
export const createApp = () => {
    const app = express();

    app.use(cors({
        origin: ALLOWED_ORIGINS,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Stripe webhooks verify the signature against the RAW body, so these
    // must be registered before the JSON body parser.
    app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
    app.use('/api/stripe/v2/webhook', express.raw({ type: 'application/json' }));

    app.use(express.json({ limit: '10mb' }));

    registerRoutes(app);

    return app;
};
