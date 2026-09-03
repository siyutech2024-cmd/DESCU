import { Router } from 'express';
import {
    createConversation,
    getUserConversations,
    sendMessage,
    getMessages,
    markMessagesAsRead,
    deleteConversation
} from '../controllers/chatController.js';

/** Conversations & messages. */
export const chatRouter = Router();

chatRouter.post('/api/conversations', createConversation);
chatRouter.get('/api/users/:userId/conversations', getUserConversations);
chatRouter.post('/api/messages', sendMessage);
chatRouter.get('/api/conversations/:conversationId/messages', getMessages); // legacy path
chatRouter.get('/api/messages/:conversationId', getMessages);
chatRouter.put('/api/messages/:conversationId/read', markMessagesAsRead);
chatRouter.delete('/api/conversations/:conversationId', deleteConversation);
