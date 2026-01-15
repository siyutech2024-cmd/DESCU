import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, CheckCheck, Loader2 } from 'lucide-react';
import { Conversation, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { subscribeToMessages, markMessagesAsRead, getMessages, sendMessage } from '../services/chatService';

interface ChatWindowProps {
  conversation: Conversation;
  currentUser: User;
  onBack: () => void;
  onSendMessage?: (conversationId: string, text: string) => void; // Optional now, for list refresh
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  currentUser,
  onBack,
  onSendMessage
}) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<any[]>([]); // Identify type properly if possible, using any for ease now matching other parts
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const data = await getMessages(conversation.id);
        setMessages(data);
      } catch (error) {
        console.error('Failed to load messages', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadMessages();
  }, [conversation.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Subscribe to real-time messages
  useEffect(() => {
    const unsubscribe = subscribeToMessages(conversation.id, (newMsg) => {
      setMessages(prev => {
        // Check if message already exists (e.g. from optimistic update with real ID)
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      // Mark as read if it's from other user
      if (newMsg.sender_id !== currentUser.id) {
        markMessagesAsRead(conversation.id, currentUser.id);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [conversation.id, currentUser.id]);

  // Mark messages as read when opening conversation
  useEffect(() => {
    markMessagesAsRead(conversation.id, currentUser.id);
  }, [conversation.id, currentUser.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && !isSending) {
      setIsSending(true);
      const text = newMessage.trim();
      const tempId = `temp-${Date.now()}`;

      // Optimistic update
      const tempMsg = {
        id: tempId,
        conversation_id: conversation.id,
        sender_id: currentUser.id, // Using snake_case to match backend/realtime
        senderId: currentUser.id, // Keep camelCase for some UI adaptivity if needed
        text: text,
        timestamp: new Date().toISOString(),
        is_read: false
      };

      setMessages(prev => [...prev, tempMsg]);
      setNewMessage('');

      try {
        const sentMsg = await sendMessage(conversation.id, currentUser.id, text);
        // Update temp message with real one
        setMessages(prev => prev.map(m => m.id === tempId ? sentMsg : m));

        // Notify parent to refresh list (optional)
        if (onSendMessage) onSendMessage(conversation.id, text);
      } catch (error) {
        console.error('Failed to send message:', error);
        // Remove temp message on error
        setMessages(prev => prev.filter(m => m.id !== tempId));
        alert('发送失败，请重试');
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
          {new Date(messages[0]?.timestamp || Date.now()).toLocaleDateString()}
        </div>

        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-400 mt-10">
            <p>{t('chat.no_msgs')}</p>
          </div>
        )}

        {messages.map((msg) => {
          // Normalize sender ID (handle both camelCase and snake_case)
          const senderId = msg.senderId || msg.sender_id;
          const isMe = senderId === currentUser.id;
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