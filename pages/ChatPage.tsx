
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Conversation } from '../types';
import { ChatList } from '../components/ChatList';
import { ChatWindow } from '../components/ChatWindow';
import { useLanguage } from '../contexts/LanguageContext';

interface ChatPageProps {
    conversations: Conversation[];
    user: User | null;
    onLogin: () => void;
    onSendMessage: (conversationId: string, text: string) => Promise<void>;
}

export const ChatPage: React.FC<ChatPageProps> = ({
    conversations,
    user,
    onLogin,
    onSendMessage
}) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useLanguage();

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
                <h2 className="text-xl font-bold mb-4">{t('nav.login')}</h2>
                <button onClick={onLogin} className="bg-brand-600 text-white px-8 py-3 rounded-full font-bold shadow-lg">Google Login</button>
            </div>
        );
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
            <div className="flex-1 sm:py-8 sm:px-4 flex justify-center bg-gray-50">
                <div className="w-full max-w-4xl h-full sm:h-[85vh] bg-white sm:rounded-2xl shadow-xl overflow-hidden">
                    <ChatWindow
                        conversation={activeConv}
                        currentUser={user}
                        onBack={() => navigate('/chat')}
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
