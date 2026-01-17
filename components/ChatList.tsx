
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
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4 animate-fade-in-up pb-24 sm:pb-6">
      <div className="flex items-center justify-between mb-6 px-2">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">{t('chat.inbox')}</h1>
        <div className="bg-white/80 backdrop-blur-sm border border-brand-100 text-brand-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
          {conversations.length} items
        </div>
      </div>

      <div className="grid gap-3">
        {sortedConversations.map((conv, idx) => {
          const lastMsg = conv.messages[conv.messages.length - 1];
          const unreadCount = conv.messages.filter(m => !m.isRead && m.senderId !== currentUser.id).length;

          return (
            <div
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className="group relative flex items-center gap-4 bg-white p-4 rounded-2xl cursor-pointer hover:shadow-md transition-all duration-300 border border-gray-100 active:scale-[0.99]"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {/* Avatar Section */}
              <div className="relative flex-shrink-0">
                <img
                  src={conv.otherUser.avatar}
                  alt={conv.otherUser.name}
                  className="w-14 h-14 rounded-full object-cover border border-gray-200"
                />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full ring-2 ring-white shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </div>

              {/* Content Section */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-bold text-gray-900 text-base truncate pr-2 group-hover:text-brand-600 transition-colors">
                    {conv.otherUser.name}
                  </h3>
                  <span className="text-[11px] font-medium text-gray-400 flex-shrink-0">
                    {lastMsg ? new Date(lastMsg.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <p className={`text-sm truncate leading-relaxed max-w-[70%] ${unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                    {lastMsg?.senderId === currentUser.id && <span className="text-gray-400 font-normal mr-1">{t('chat.you')}:</span>}
                    {lastMsg?.text || t('chat.no_msgs')}
                  </p>

                  {/* Product Tag - Subtle */}
                  <div className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded-lg border border-gray-100 transition-colors max-w-[30%]">
                    <img
                      src={conv.productImage || 'https://images.unsplash.com/photo-1557821552-17105176677c?w=100&h=100&fit=crop'}
                      className="w-4 h-4 rounded object-cover opacity-80"
                      alt=""
                    />
                    <span className="text-[10px] font-medium text-gray-600 truncate">
                      {conv.productTitle}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
