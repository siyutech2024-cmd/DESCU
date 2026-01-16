import express from 'express';
import cors from 'cors';

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

app.use(express.json());

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
