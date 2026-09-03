import { Router } from 'express';
import { analyzeImage } from '../controllers/aiController.js';
import { createProduct, getProducts, getProductById, productsHealthCheck } from '../controllers/productController.js';
import { requireAuth } from '../middleware/userAuth.js';

/** Product catalogue + AI image analysis. */
export const productsRouter = Router();

productsRouter.post('/api/analyze', requireAuth, analyzeImage);
productsRouter.get('/api/products/health', productsHealthCheck);
productsRouter.post('/api/products', requireAuth, createProduct);
productsRouter.get('/api/products', getProducts);
productsRouter.get('/api/products/:id', getProductById);
