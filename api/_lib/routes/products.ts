import { Router } from 'express';
import { analyzeImage } from '../controllers/aiController.js';
import { createProduct, getProducts, getProductById } from '../controllers/productController.js';
import { requireAuth } from '../middleware/userAuth.js';

/** Product catalogue + AI image analysis. */
export const productsRouter = Router();

productsRouter.post('/api/analyze', requireAuth, analyzeImage);
productsRouter.post('/api/products', requireAuth, createProduct);
productsRouter.get('/api/products', getProducts);
productsRouter.get('/api/products/:id', getProductById);
