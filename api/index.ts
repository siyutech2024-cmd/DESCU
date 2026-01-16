import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

// Imports from Local Lib (Bundled)
import { analyzeImage } from './_lib/controllers/aiController.js';
import { createProduct, getProducts, getProductById, productsHealthCheck } from './_lib/controllers/productController.js';
import { requireAuth } from './_lib/middleware/userAuth.js';

const app = express();

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'https://descu.ai',
        'https://www.descu.ai',
        /https:\/\/.*\.vercel\.app$/
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Feature Routes
app.post('/api/analyze', analyzeImage);
app.get('/api/products/health', productsHealthCheck);
app.post('/api/products', requireAuth, createProduct);
app.get('/api/products', getProducts);
app.get('/api/products/:id', getProductById);

// Test Route
app.get('/api/test_ping', (req, res) => {
    const debug: any = {
        pong: true,
        time: new Date().toISOString(),
        location: 'api/index.ts inlined',
        fs: {}
    };

    try {
        const root = process.cwd();
        debug.fs.cwd = root;

        // Check api folder
        const apiPath = path.join(root, 'api');
        if (fs.existsSync(apiPath)) {
            debug.fs.api = fs.readdirSync(apiPath);

            // Check _lib
            const libPath = path.join(apiPath, '_lib');
            if (fs.existsSync(libPath)) {
                debug.fs.lib = fs.readdirSync(libPath);

                // Check controllers
                const ctrlPath = path.join(libPath, 'controllers');
                if (fs.existsSync(ctrlPath)) {
                    debug.fs.controllers = fs.readdirSync(ctrlPath);
                } else {
                    debug.fs.controllers = 'NOT_FOUND';
                }
            } else {
                debug.fs.lib = 'NOT_FOUND';
            }
        } else {
            debug.fs.api = 'NOT_FOUND';
        }

    } catch (e: any) {
        debug.fs_error = e.message;
    }

    res.json(debug);
});

app.get('/', (req, res) => {
    res.send('DESCU API (Inlined)');
});

export default app;
