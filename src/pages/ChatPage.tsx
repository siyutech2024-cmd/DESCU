import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Conversation } from '../types';
import { useLanguage } from '@/i18n';
import { ChatList } from '@/features/chat/components/ChatList';
import { ChatWindow } from '@/features/chat/components/ChatWindow';
import { SignedOutPlaceholder } from '@/components/SignedOutPlaceholder';
import { EmptyState } from '@/components/ui/primitives';
import { useBackNavigation } from '@/lib/useBackNavigation';

interface ChatPageProps {
    conversations: Conversation[];
    user: User | null;
    /** @deprecated The signed-out state opens the shared login modal via `useAuth()`. */
    onLogin?: () => void;
    onSendMessage: (conversationId: string, text: string) => Promise<void>;
}

/**
 * Mobile: list OR thread (the thread is a fixed full-screen column).
 * Desktop (md+): list on the left, thread on the right, like any mail client.
 */
export const ChatPage: React.FC<ChatPageProps> = ({ conversations, user }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useLanguage();
    const goBackToList = useBackNavigation('/chat');

    if (!user) {
        return <SignedOutPlaceholder hintKey="auth.signed_out_hint_chat" icon={MessageCircle} />;
    }

    const activeConv = id ? conversations.find(c => c.id === id) : undefined;
    const select = (convId: string) => navigate(`/chat/${convId}`);

    const thread = activeConv ? (
        <ChatWindow key={activeConv.id} conversation={activeConv} currentUser={user} onBack={goBackToList} hideBack />
    ) : id ? (
        <EmptyState icon={<MessageCircle size={26} />} title={t('chat.loading')} className="h-full" />
    ) : (
        <EmptyState icon={<MessageCircle size={26} />} title={t('chat.pick_conversation')} hint={t('chat.pick_conversation_hint')} className="h-full" />
    );

    return (
        <>
            {/* Mobile */}
            <div className="md:hidden flex-1">
                {activeConv ? (
                    <ChatWindow key={activeConv.id} conversation={activeConv} currentUser={user} onBack={goBackToList} />
                ) : id ? (
                    <EmptyState icon={<MessageCircle size={26} />} title={t('chat.loading')} className="min-h-[60vh]" />
                ) : (
                    <ChatList conversations={conversations} currentUser={user} onSelectConversation={select} />
                )}
            </div>

            {/* Desktop two-pane */}
            <div className="hidden md:flex flex-1 max-w-6xl w-full mx-auto px-4 py-6 min-h-0">
                <div className="flex w-full h-[calc(100dvh-7.5rem)] min-h-[520px] rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                    <aside className="w-[340px] lg:w-[380px] flex-shrink-0 border-r border-gray-100 overflow-y-auto modern-scrollbar bg-[#fafafc]">
                        <ChatList conversations={conversations} currentUser={user} onSelectConversation={select} selectedId={activeConv?.id} compact />
                    </aside>
                    <section className="flex-1 min-w-0 flex flex-col">{thread}</section>
                </div>
            </div>
        </>
    );
};
