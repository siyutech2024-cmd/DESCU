import { Router } from 'express';
import { requireAuth } from '../middleware/userAuth.js';
import { createReport, blockUser, unblockUser, getMyBlocks } from '../controllers/moderationController.js';

/** Reports & blocks. All routes require a signed-in user. */
export const moderationRouter = Router();

moderationRouter.post('/api/reports', requireAuth, createReport);
moderationRouter.get('/api/blocks', requireAuth, getMyBlocks);
moderationRouter.post('/api/blocks', requireAuth, blockUser);
moderationRouter.delete('/api/blocks/:userId', requireAuth, unblockUser);
