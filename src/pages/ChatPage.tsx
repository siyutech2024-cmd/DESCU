
import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Conversation } from '../types';
import { ChatList } from '@/features/chat/components/ChatList';
import { ChatWindow } from '@/features/chat/components/ChatWindow';
import { SignedOutPlaceholder } from '@/components/SignedOutPlaceholder';
import { useBackNavigation } from '@/lib/useBackNavigation';

interface ChatPageProps {
    conversations: Conversation[];
    user: User | null;
    /** @deprecated The signed-out state opens the shared login modal via `useAuth()`. */
    onLogin?: () => void;
    onSendMessage: (conversationId: string, text: string) => Promise<void>;
}

export const ChatPage: React.FC<ChatPageProps> = ({
    conversations,
    user,
    onSendMessage
}) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const goBackToList = useBackNavigation('/chat');

    if (!user) {
        return <SignedOutPlaceholder hintKey="auth.signed_out_hint_chat" icon={MessageCircle} />;
    }

    if (id) {
        const activeConv = conversations.find(c => c.id === id);
        if (!activeConv) {
            // Redirect to list if not found, or show loading
            // This might happen if conversations are still loading
            // For now, consistent with App.tsx logic
            return <div className="p-4 text-center">Loading or conversation not found...</div>;
        }
        return (
            <div className="flex-1 md:py-8 md:px-4 flex justify-center bg-gray-50">
                <div className="w-full max-w-4xl h-full md:h-[85vh] bg-white md:rounded-2xl shadow-xl overflow-hidden">
                    <ChatWindow
                        key={activeConv.id}
                        conversation={activeConv}
                        currentUser={user}
                        onBack={goBackToList}
                        onSendMessage={onSendMessage}
                    />
                </div>
            </div>
        );
    }

    return (
        <ChatList
            conversations={conversations}
            currentUser={user}
            onSelectConversation={(convId) => navigate(`/chat/${convId}`)}
        />
    );
};
