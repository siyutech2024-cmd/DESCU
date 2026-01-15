import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, CheckCheck, Loader2, MoreVertical, Phone, Video } from 'lucide-react';
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
      // Ignore my own messages from realtime to avoid duplicates with optimistic UI
      if (newMsg.sender_id === currentUser.id || newMsg.senderId === currentUser.id) return;

      setMessages(prev => {
        // Check if message already exists (e.g. from optimistic update with real ID)
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // Keep "Mark as read" logic, though effectively it's always implied for received messages
      markMessagesAsRead(conversation.id, currentUser.id);
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
    <div className="flex flex-col h-full bg-[#f8f9fa] fixed inset-0 z-40 sm:static sm:h-full animate-fade-in-right">
      {/* Premium Glassmorphism Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center gap-4 shadow-sm">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95"
        >
          <ArrowLeft size={24} className="text-gray-700" />
        </button>

        <div className="relative">
          <img
            src={conversation.otherUser.avatar}
            alt={conversation.otherUser.name}
            className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-white"
          />
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm ring-1 ring-green-100"></div>
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 truncate leading-tight">{conversation.otherUser.name}</h2>
          <p className="text-xs text-brand-600 font-medium truncate">Online now</p>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors">
            <Phone size={20} />
          </button>
          <button className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors">
            <Video size={20} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto pt-20 pb-4 px-4 space-y-6 bg-gradient-to-b from-gray-50 to-[#f8f9fa]">

        {/* Product Context Card */}
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 mx-auto max-w-sm flex items-center gap-3 animate-slide-down">
          <img src={conversation.productImage} className="w-12 h-12 rounded-lg object-cover" alt="Product" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Trading</p>
            <p className="text-sm font-bold text-gray-900 truncate">{conversation.productTitle}</p>
          </div>
          <div className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-md">
            Offer
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 font-medium">
          {new Date(messages[0]?.timestamp || Date.now()).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>

        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-400 py-10 opacity-60">
            <p>{t('chat.no_msgs')}</p>
          </div>
        )}

        {messages.map((msg, index) => {
          const senderId = msg.senderId || msg.sender_id;
          const isMe = senderId === currentUser.id;
          const showAvatar = isMe ? false : (messages[index + 1]?.senderId || messages[index + 1]?.sender_id) !== senderId;

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start items-end'} gap-2 group`}>
              {!isMe && (
                <div className={`w-8 h-8 rounded-full flex-shrink-0 bg-gray-200 overflow-hidden ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
                  {showAvatar && <img src={conversation.otherUser.avatar} className="w-full h-full object-cover" alt="Avatar" />}
                </div>
              )}

              <div
                className={`max-w-[75%] px-5 py-3 text-[15px] shadow-sm relative transition-all duration-200 hover:shadow-md ${isMe
                  ? 'bg-gradient-to-br from-brand-600 to-brand-500 text-white rounded-2xl rounded-tr-sm'
                  : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-sm'
                  }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${isMe ? 'text-brand-100' : 'text-gray-400'}`}>
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMe && <CheckCheck size={14} className={msg.is_read ? "text-white" : "text-brand-200"} />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Floating Input Area */}
      <div className="bg-white/80 backdrop-blur-md p-4 border-t border-gray-100 safe-area-pb">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex gap-3 items-end bg-gray-50 p-2 rounded-[2rem] border border-gray-200 focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-300 transition-all shadow-inner">
          <button type="button" className="p-2 text-gray-400 hover:text-brand-600 hover:bg-gray-100 rounded-full transition-colors">
            <MoreVertical size={20} />
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('chat.type')}
            disabled={isSending}
            className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 px-2 py-3 focus:outline-none text-sm min-h-[44px]"
          />

          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="p-3 bg-brand-600 text-white rounded-full shadow-lg shadow-brand-200 disabled:opacity-50 disabled:shadow-none hover:bg-brand-700 hover:scale-105 transition-all active:scale-95 flex-shrink-0"
          >
            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-0.5" />}
          </button>
        </form>
      </div>
    </div>
  );
};