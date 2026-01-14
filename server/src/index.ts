import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for image uploads

// Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

// Routes
import { analyzeImage } from './controllers/aiController';
import { createProduct, getProducts } from './controllers/productController';
import {
    createConversation,
    getUserConversations,
    sendMessage,
    getMessages,
    markMessagesAsRead
} from './controllers/chatController';

// API Endpoints
app.post('/api/analyze', analyzeImage);
app.post('/api/products', createProduct);
app.get('/api/products', getProducts);

// Chat Endpoints
app.post('/api/conversations', createConversation);
app.get('/api/conversations/:userId', getUserConversations);
app.post('/api/messages', sendMessage);
app.get('/api/messages/:conversationId', getMessages);
app.put('/api/messages/:conversationId/read', markMessagesAsRead);

app.get('/', (req, res) => {
    res.send('Venya Marketplace API is running');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
