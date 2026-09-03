import { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { ApiError } from '@/lib/api/client';
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
    const queryKey = useMemo(() => queryKeys.conversations(userId), [userId]);

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

    const conversations = useMemo<Conversation[]>(() => (userId ? query.data ?? [] : []), [query.data, userId]);

    // Ids of the conversations we currently know about, readable from the realtime callback
    // without re-subscribing every time the list changes.
    const knownIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        knownIdsRef.current = new Set(conversations.map(c => c.id));
    }, [conversations]);

    // Realtime: new messages addressed to this user → refresh unread state.
    // The channel receives every `messages` INSERT, so we decide locally (no DB round-trip):
    //  - conversation id is one of ours → invalidate (badge / preview / ordering changed)
    //  - unknown id → invalidate at most once per conversation id, in case a brand-new
    //    conversation was just opened with us. If the refetch still doesn't include it, the id
    //    belongs to someone else and is ignored from then on.
    useEffect(() => {
        if (!userId) return;

        const checkedUnknownIds = new Set<string>();

        const channel = supabase
            .channel(`global-messages:${userId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                const msg = payload.new as { sender_id?: string; conversation_id?: string };
                if (!msg.conversation_id || msg.sender_id === userId) return;

                if (knownIdsRef.current.has(msg.conversation_id)) {
                    invalidate();
                    return;
                }

                if (checkedUnknownIds.has(msg.conversation_id)) return;
                checkedUnknownIds.add(msg.conversation_id);
                invalidate();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, invalidate]);

    const unreadCount = useMemo(
        () => conversations.reduce((acc, c) => acc + (c.unreadCount ?? 0), 0),
        [conversations]
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
                notify.error(t(error instanceof ApiError && error.status === 403 ? 'chat.blocked_cannot_send' : 'toast.message_send_failed'));
            }
        },
        [user, invalidate, t]
    );

    return { conversations, unreadCount, isLoading: query.isLoading, contactSeller, sendMessage, refresh: invalidate };
};
