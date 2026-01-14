
import React from 'react';
import { Conversation, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { MessageCircle } from 'lucide-react';

interface ChatListProps {
  conversations: Conversation[];
  currentUser: User;
  onSelectConversation: (id: string) => void;
}

export const ChatList: React.FC<ChatListProps> = ({ 
  conversations, 
  currentUser, 
  onSelectConversation 
}) => {
  const { t } = useLanguage();

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 p-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <MessageCircle size={32} className="opacity-30" />
        </div>
        <p className="font-medium">{t('chat.empty_inbox')}</p>
      </div>
    );
  }

  const sortedConversations = [...conversations].sort((a, b) => b.lastMessageTime - a.lastMessageTime);

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 px-2">{t('chat.inbox')}</h1>
      {sortedConversations.map(conv => {
        const lastMsg = conv.messages[conv.messages.length - 1];
        const unreadCount = conv.messages.filter(m => !m.isRead && m.senderId !== currentUser.id).length;
        
        return (
          <div 
            key={conv.id} 
            onClick={() => onSelectConversation(conv.id)}
            className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="relative">
              <img 
                src={conv.otherUser.avatar} 
                alt={conv.otherUser.name} 
                className="w-14 h-14 rounded-full object-cover border border-gray-100"
              />
              {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full ring-2 ring-white">
                      {unreadCount}
                  </span>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-gray-900 truncate pr-2">{conv.otherUser.name}</h3>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {lastMsg ? new Date(lastMsg.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                    </span>
                </div>
                
                <div className="flex items-center gap-2">
                     <p className={`text-sm truncate flex-1 ${unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                        {lastMsg?.senderId === currentUser.id ? `${t('chat.you')}: ` : ''}
                        {lastMsg?.text || t('chat.no_msgs')}
                     </p>
                </div>
                
                <p className="text-[10px] text-brand-600 mt-1 truncate">
                    {conv.productTitle}
                </p>
            </div>

            <img 
                src={conv.productImage} 
                alt="Product" 
                className="w-12 h-12 rounded-lg object-cover border border-gray-100 flex-shrink-0"
            />
          </div>
        );
      })}
    </div>
  );
};
