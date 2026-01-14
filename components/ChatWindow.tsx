import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, CheckCheck, Loader2 } from 'lucide-react';
import { Conversation, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { subscribeToMessages, markMessagesAsRead } from '../services/chatService';

interface ChatWindowProps {
  conversation: Conversation;
  currentUser: User;
  onBack: () => void;
  onSendMessage: (conversationId: string, text: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  currentUser,
  onBack,
  onSendMessage
}) => {
  const { t } = useLanguage();
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on mount and when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages, conversation.id]);

  // Subscribe to real-time messages
  useEffect(() => {
    const unsubscribe = subscribeToMessages(conversation.id, (newMsg) => {
      // The parent component (App.tsx) will handle updating conversations
      // This is just  to ensure scrolling when new messages arrive
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => {
      unsubscribe();
    };
  }, [conversation.id]);

  // Mark messages as read when opening conversation
  useEffect(() => {
    markMessagesAsRead(conversation.id, currentUser.id);
  }, [conversation.id, currentUser.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && !isSending) {
      setIsSending(true);
      try {
        await onSendMessage(conversation.id, newMessage);
        setNewMessage('');
      } catch (error) {
        console.error('Failed to send message:', error);
      } finally {
        setIsSending(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 fixed inset-0 z-40">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-100 flex items-center gap-3 shadow-sm">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={24} className="text-gray-600" />
        </button>

        <div className="relative">
          <img
            src={conversation.otherUser.avatar}
            alt={conversation.otherUser.name}
            className="w-10 h-10 rounded-full object-cover border border-gray-100"
          />
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 truncate">{conversation.otherUser.name}</h2>
          <p className="text-xs text-brand-600 font-medium truncate flex items-center gap-1">
            Regarding: {conversation.productTitle}
          </p>
        </div>

        <img
          src={conversation.productImage}
          alt="Product"
          className="w-10 h-10 rounded-md object-cover border border-gray-200"
        />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        <div className="text-center text-xs text-gray-400 my-4">
          {new Date(conversation.messages[0]?.timestamp || Date.now()).toLocaleDateString()}
        </div>

        {conversation.messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            <p>{t('chat.no_msgs')}</p>
          </div>
        )}

        {conversation.messages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${isMe
                  ? 'bg-brand-600 text-white rounded-tr-none'
                  : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                  }`}
              >
                <p className="leading-relaxed">{msg.text}</p>
                <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${isMe ? 'text-brand-200' : 'text-gray-400'}`}>
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMe && <CheckCheck size={12} />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white p-3 border-t border-gray-100 safe-area-pb">
        <form onSubmit={handleSend} className="flex gap-2 items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('chat.type')}
            disabled={isSending}
            className="flex-1 bg-gray-100 text-gray-900 placeholder-gray-400 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="p-3 bg-brand-600 text-white rounded-full shadow-lg shadow-brand-200 disabled:opacity-50 disabled:shadow-none hover:bg-brand-700 transition-all active:scale-95 flex-shrink-0"
          >
            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
};