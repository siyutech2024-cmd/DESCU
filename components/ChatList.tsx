
import React from 'react';
import { Conversation, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { MessageCircle, Clock, ChevronRight } from 'lucide-react';

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
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 p-8 animate-fade-in">
        <div className="w-24 h-24 bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
          <MessageCircle size={40} className="opacity-20 text-gray-600" />
        </div>
        <p className="font-bold text-lg text-gray-500">{t('chat.empty_inbox')}</p>
        <p className="text-sm text-gray-400 mt-2">Start a conversation from a product page</p>
      </div>
    );
  }

  const sortedConversations = [...conversations].sort((a, b) => b.lastMessageTime - a.lastMessageTime);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between mb-8 px-2">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">{t('chat.inbox')}</h1>
        <div className="bg-brand-50 text-brand-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
          {conversations.length} items
        </div>
      </div>

      <div className="grid gap-3">
        {sortedConversations.map(conv => {
          const lastMsg = conv.messages[conv.messages.length - 1];
          const unreadCount = conv.messages.filter(m => !m.isRead && m.senderId !== currentUser.id).length;

          return (
            <div
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className="group relative flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-brand-200 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden"
            >
              {/* Hover highlight bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500 opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Avatar Section */}
              <div className="relative flex-shrink-0">
                <img
                  src={conv.otherUser.avatar}
                  alt={conv.otherUser.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm group-hover:scale-105 transition-transform duration-300"
                />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 bg-gradient-to-r from-brand-600 to-pink-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full ring-2 ring-white shadow-md animate-pulse-slow">
                    {unreadCount}
                  </span>
                )}
              </div>

              {/* Content Section */}
              <div className="flex-1 min-w-0 py-1">
                <div className="flex justify-between items-start mb-1.5">
                  <h3 className="font-bold text-gray-900 text-lg truncate pr-2 group-hover:text-brand-600 transition-colors">
                    {conv.otherUser.name}
                  </h3>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                    <Clock size={10} />
                    {lastMsg ? new Date(lastMsg.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <p className={`text-sm truncate flex-1 leading-relaxed ${unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                    {lastMsg?.senderId === currentUser.id && <span className="text-brand-600 font-medium mr-1">{t('chat.you')}:</span>}
                    {lastMsg?.text || t('chat.no_msgs')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-md truncate max-w-[200px] group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors">
                    Product: {conv.productTitle}
                  </div>
                </div>
              </div>

              {/* Product Image & Arrow */}
              <div className="flex flex-col items-end gap-2 pl-2">
                <img
                  src={conv.productImage}
                  alt="Product"
                  className="w-14 h-14 rounded-xl object-cover border border-gray-100 shadow-sm group-hover:rotate-3 transition-transform duration-300"
                />
                <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-500 transition-colors" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
