import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, CheckCheck, Loader2, MoreVertical, Phone, Video, Image as ImageIcon, Smile } from 'lucide-react';
import { Conversation, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { subscribeToMessages, markMessagesAsRead, getMessages, sendMessage } from '../services/chatService';

interface ChatWindowProps {
  conversation: Conversation;
  currentUser: User;
  onBack: () => void;
  onSendMessage?: (conversationId: string, text: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  currentUser,
  onBack,
  onSendMessage
}) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
  }, [messages, isLoading]);

  // Subscribe to real-time messages
  useEffect(() => {
    const unsubscribe = subscribeToMessages(conversation.id, (newMsg) => {
      if (newMsg.sender_id === currentUser.id || newMsg.senderId === currentUser.id) return;

      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

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
        sender_id: currentUser.id,
        senderId: currentUser.id,
        text: text,
        timestamp: new Date().toISOString(),
        is_read: false
      };

      setMessages(prev => [...prev, tempMsg]);
      setNewMessage('');

      // Keep focus on input for web, might dismiss on mobile depending on preference
      inputRef.current?.focus();

      try {
        const sentMsg = await sendMessage(conversation.id, currentUser.id, text);
        setMessages(prev => prev.map(m => m.id === tempId ? sentMsg : m));
        if (onSendMessage) onSendMessage(conversation.id, text);
      } catch (error) {
        console.error('Failed to send message:', error);
        setMessages(prev => prev.filter(m => m.id !== tempId));
        alert('发送失败，请重试');
      } finally {
        setIsSending(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen fixed inset-0 z-50 bg-[#f8f9fa] sm:static sm:h-full sm:rounded-2xl sm:overflow-hidden sm:border sm:border-gray-200 animate-fade-in">

      {/* Header - Glassmorphism */}
      <div className="absolute top-0 left-0 right-0 z-20 glass-panel border-b border-white/40 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-gray-600 hover:bg-black/5 rounded-full transition-colors active:scale-95"
        >
          <ArrowLeft size={22} />
        </button>

        <div className="relative">
          <img
            src={conversation.otherUser.avatar}
            alt={conversation.otherUser.name}
            className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-white/80"
          />
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 truncate leading-tight">{conversation.otherUser.name}</h2>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            <p className="text-xs text-brand-600 font-medium truncate">Online now</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors hidden sm:block">
            <Phone size={20} />
          </button>
          <button className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors hidden sm:block">
            <Video size={20} />
          </button>
          <button className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Messages Area - with modern background */}
      <div className="flex-1 overflow-y-auto pt-[72px] pb-[80px] px-4 sm:px-6 space-y-6 bg-gradient-to-b from-slate-50 to-[#f0f2f5] modern-scrollbar scroll-smooth">

        {/* Product Context Card */}
        <div className="mx-auto max-w-sm glass-panel p-3 rounded-xl flex items-center gap-3 animate-fade-in-up mt-2 cursor-pointer hover:shadow-md transition-shadow">
          <img src={conversation.productImage} className="w-12 h-12 rounded-lg object-cover shadow-sm" alt="Product" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Listing</span>
            </div>
            <p className="text-sm font-bold text-gray-900 truncate">{conversation.productTitle}</p>
            <p className="text-xs text-brand-600 font-medium">Click to view details</p>
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 font-medium my-4">
          <span className="bg-gray-100 px-3 py-1 rounded-full">{new Date(messages[0]?.timestamp || Date.now()).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
        </div>

        {messages.length === 0 && !isLoading && (
          <div className="text-center py-10 opacity-60 animate-fade-in">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Smile size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-500">{t('chat.no_msgs')}</p>
            <p className="text-xs text-gray-400 mt-1">Start the conversation!</p>
          </div>
        )}

        {messages.map((msg, index) => {
          const senderId = msg.senderId || msg.sender_id;
          const isMe = senderId === currentUser.id;
          const showAvatar = isMe ? false : (messages[index + 1]?.senderId || messages[index + 1]?.sender_id) !== senderId;
          const isLast = index === messages.length - 1;

          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start items-end'} gap-2.5 group animate-slide-in-right`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {!isMe && (
                <div className={`flex flex-col space-y-1 ${!showAvatar && 'invisible'}`}>
                  <img src={conversation.otherUser.avatar} className="w-8 h-8 rounded-full object-cover shadow-sm" alt="Avatar" />
                </div>
              )}

              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%] sm:max-w-[70%]`}>
                <div
                  className={`px-4 py-2.5 text-[15px] shadow-sm relative transition-all duration-200 
                  ${isMe
                      ? 'bg-gradient-to-br from-brand-600 to-brand-500 text-white rounded-2xl rounded-tr-sm shadow-brand-200/50'
                      : 'bg-white text-gray-800 border-none shadow-glass-sm rounded-2xl rounded-tl-sm'
                    }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>

                  <div className={`flex items-center gap-1 text-[10px] mt-1 select-none ${isMe ? 'justify-end text-brand-100' : 'justify-end text-gray-400'
                    }`}>
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && (
                      <CheckCheck size={14} className={msg.is_read ? "text-white" : "text-brand-300/80"} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Floating Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-white via-white/90 to-transparent z-20">
        <form
          onSubmit={handleSend}
          className="max-w-4xl mx-auto relative flex gap-2 items-end glass-input rounded-[1.5rem] p-1.5 shadow-lg shadow-gray-200/50"
        >
          <button type="button" className="p-2.5 text-gray-400 hover:text-brand-600 hover:bg-gray-100/50 rounded-full transition-colors active:scale-95">
            <ImageIcon size={22} />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('chat.type')}
            disabled={isSending}
            className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 px-1 py-3 focus:outline-none text-[15px] min-h-[48px]"
          />

          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className={`p-3 rounded-full shadow-lg transition-all duration-300 active:scale-90 flex-shrink-0 mb-0.5 mr-0.5
              ${newMessage.trim()
                ? 'bg-brand-600 text-white shadow-brand-300 hover:bg-brand-700 hover:shadow-brand-400 hover:-translate-y-0.5'
                : 'bg-gray-200 text-gray-400 shadow-none cursor-not-allowed'
              }`}
          >
            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className={newMessage.trim() ? "ml-0.5" : ""} />}
          </button>
        </form>
      </div>
    </div>
  );
};