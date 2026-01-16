import express from 'express';
import cors from 'cors';

// Imports from Server Logic
import { analyzeImage } from '../server/src/controllers/aiController';
import { createProduct, getProducts, getProductById, productsHealthCheck } from '../server/src/controllers/productController';
import { requireAuth } from '../server/src/middleware/userAuth';

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
    res.json({
        pong: true,
        time: new Date().toISOString(),
        location: 'api/index.ts inlined'
    });
});

app.get('/', (req, res) => {
    res.send('DESCU API (Inlined)');
});

export default app;
