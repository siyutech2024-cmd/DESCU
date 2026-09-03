import { Router } from 'express';
import { requireAuth } from '../middleware/userAuth.js';
import {
    createConversation,
    getUserConversations,
    sendMessage,
    getMessages,
    markMessagesAsRead,
    deleteConversation
} from '../controllers/chatController.js';

/** Conversations & messages. Every route requires a signed-in participant. */
export const chatRouter = Router();

chatRouter.post('/api/conversations', requireAuth, createConversation);
chatRouter.get('/api/users/:userId/conversations', requireAuth, getUserConversations);
chatRouter.post('/api/messages', requireAuth, sendMessage);
chatRouter.get('/api/conversations/:conversationId/messages', requireAuth, getMessages); // legacy path
chatRouter.get('/api/messages/:conversationId', requireAuth, getMessages);
chatRouter.put('/api/messages/:conversationId/read', requireAuth, markMessagesAsRead);
chatRouter.delete('/api/conversations/:conversationId', requireAuth, deleteConversation);
