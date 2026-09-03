import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Conversation, Product } from '@/types';
import { useLanguage } from '@/i18n';
import { supabase } from '@/services/supabase';
import {
    getUserConversations,
    subscribeToConversations,
    createOrGetConversation,
    sendMessage as sendMessageApi,
} from '@/services/chatService';
import { queryKeys } from '@/lib/queryClient';
import { notify } from '@/lib/toast';
import { useAuth } from '@/features/auth';
import { mapApiConversation, type ApiConversation } from './conversationMapper';

/**
 * The signed-in user's conversations, kept fresh through two realtime channels:
 *  - `conversations` table changes involving the user
 *  - new `messages` rows in any of the user's conversations
 */
export const useConversations = () => {
    const { user, openLoginModal } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const userId = user?.id ?? '';
    const queryKey = queryKeys.conversations(userId);

    const query = useQuery({
        queryKey,
        enabled: !!userId,
        queryFn: async () => {
            const rows = (await getUserConversations(userId)) as ApiConversation[];
            return rows.map(row => mapApiConversation(row, userId));
        },
    });

    const invalidate = useCallback(() => {
        queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    // Realtime: conversation rows
    useEffect(() => {
        if (!userId) return;
        return subscribeToConversations(userId, invalidate);
    }, [userId, invalidate]);

    // Realtime: new messages addressed to this user → refresh unread state
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`global-messages:${userId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async payload => {
                const msg = payload.new as { sender_id: string; conversation_id: string };
                if (msg.sender_id === userId) return;

                const { data: conv } = await supabase
                    .from('conversations')
                    .select('user1_id, user2_id')
                    .eq('id', msg.conversation_id)
                    .single();

                if (conv && (conv.user1_id === userId || conv.user2_id === userId)) invalidate();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, invalidate]);

    const conversations = useMemo<Conversation[]>(() => (userId ? query.data ?? [] : []), [query.data, userId]);

    const unreadCount = useMemo(
        () => conversations.reduce((acc, c) => acc + c.messages.filter(m => !m.isRead && m.senderId !== userId).length, 0),
        [conversations, userId]
    );

    /** Open (or create) the chat with a product's seller. */
    const contactSeller = useCallback(
        async (product: Product) => {
            if (!user) {
                openLoginModal();
                return;
            }

            const existing = conversations.find(c => c.otherUser.id === product.seller.id && c.productId === product.id);
            if (existing) {
                navigate(`/chat/${existing.id}`);
                return;
            }

            try {
                const created = await createOrGetConversation(product.id, user.id, product.seller.id);
                const conversationId: string = created.id || created.conversation?.id;

                queryClient.setQueryData<Conversation[]>(queryKey, current => [
                    ...(current ?? []),
                    {
                        id: conversationId,
                        otherUser: product.seller,
                        productId: product.id,
                        productTitle: product.title,
                        productImage: product.images[0],
                        messages: [],
                        lastMessageTime: Date.now(),
                    },
                ]);
                navigate(`/chat/${conversationId}`);
            } catch (error) {
                console.error('[chat] failed to open conversation:', error);
                notify.error(t('toast.chat_open_failed'));
            }
        },
        [user, conversations, navigate, openLoginModal, queryClient, queryKey, t]
    );

    const sendMessage = useCallback(
        async (conversationId: string, text: string) => {
            if (!user || !text.trim()) return;
            try {
                await sendMessageApi(conversationId, user.id, text);
                invalidate();
            } catch (error) {
                console.error('[chat] send failed:', error);
                notify.error(t('toast.message_send_failed'));
            }
        },
        [user, invalidate, t]
    );

    return { conversations, unreadCount, isLoading: query.isLoading, contactSeller, sendMessage, refresh: invalidate };
};
