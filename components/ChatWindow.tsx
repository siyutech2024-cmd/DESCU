import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, CheckCheck, Loader2, MoreVertical, Phone, Video,
  Image as ImageIcon, Smile, MapPin, Clock
} from 'lucide-react';
import { Conversation, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { subscribeToMessages, markMessagesAsRead, getMessages, sendMessage } from '../services/chatService';
import { MeetupArrangementModal } from './MeetupArrangementModal';
import { OrderStatusMessage } from './chat/OrderStatusMessage';
import { PriceNegotiationCard } from './chat/PriceNegotiationCard';
import { PriceNegotiationSender } from './chat/PriceNegotiationSender';

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
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null); // Simplified Order type
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false); // Placeholder for modal logic
  const [isMeetupModalOpen, setIsMeetupModalOpen] = useState(false); // New state
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showMenu, setShowMenu] = useState(false);

  // Handle product click navigation
  const handleProductClick = () => {
    if (conversation.productId) {
      navigate(`/product/${conversation.productId}`);
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
  };

  // ... (handleSend below) ...
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

      // Keep focus on input for web
      inputRef.current?.focus();

      try {
        const sentMsg = await sendMessage(conversation.id, currentUser.id, text);
        setMessages(prev => prev.map(m => m.id === tempId ? sentMsg : m));
        if (onSendMessage) onSendMessage(conversation.id, text);
      } catch (error) {
        console.error('Failed to send message:', error);
        setMessages(prev => prev.filter(m => m.id !== tempId));
        alert('Send failed, please retry');
      } finally {
        setIsSending(false);
      }
    }
  };


  // Reload order when meetup arranged

  // Reload order when meetup arranged
  const handleMeetupSuccess = () => {
    // Re-fetch order
    if (activeOrder) {
      import('../services/apiConfig').then(async ({ API_BASE_URL }) => {
        // ... fetch logic similar to useEffect ...
        // For simplicity, just reload page or trigger re-fetch.
        // Let's trigger re-fetch by toggling a trigger or calling the fetch function if extracted.
        // simplified:
        window.location.reload();
      });
    }
  };

  // ... (handleSend, showMenu state) ...

  return (
    <div className="flex flex-col h-full fixed inset-0 z-50 bg-[#f8f9fa] sm:static sm:h-full sm:rounded-2xl sm:overflow-hidden sm:border sm:border-gray-200 animate-fade-in">

      {/* Header - Glassmorphism */}
      <div className="absolute top-0 left-0 right-0 z-20 glass-panel border-b border-white/40 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-gray-600 hover:bg-black/5 rounded-full transition-colors active:scale-95"
        >
          <ArrowLeft size={22} />
        </button>

        {/* ... (User Avatar & Name) ... */}
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

        <div className="flex items-center gap-1 relative">
          {/* Meetup Button (Only if active meetup order exists) */}
          {activeOrder && activeOrder.order_type === 'meetup' && activeOrder.status !== 'completed' && activeOrder.status !== 'cancelled' && (
            <button
              onClick={() => setIsMeetupModalOpen(true)}
              className="p-2 text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-full transition-colors mr-1"
              title="Arrange Meetup"
            >
              <MapPin size={20} />
            </button>
          )}

          <button className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors hidden sm:block">
            <Phone size={20} />
          </button>
          <button className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors hidden sm:block">
            <Video size={20} />
          </button>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors"
          >
            <MoreVertical size={20} />
          </button>

          {/* Action Menu Breakdown */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-12 w-48 bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/50 z-40 overflow-hidden animate-fade-in-up origin-top-right">
                <button
                  onClick={() => { setShowMenu(false); alert('User reported'); }}
                  className="w-full text-left px-4 py-3 hover:bg-red-50 text-red-500 text-sm font-medium transition-colors border-b border-gray-100"
                >
                  Report User
                </button>
                <button
                  onClick={() => { setShowMenu(false); alert('User blocked'); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                >
                  Block User
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto pt-[72px] pb-[120px] px-4 sm:px-6 space-y-6 bg-gradient-to-b from-slate-50 to-[#f0f2f5] modern-scrollbar scroll-smooth">

        {/* Product & Order Context Card */}
        <div
          onClick={handleProductClick}
          className="mx-auto max-w-sm glass-panel p-3 rounded-xl flex flex-col gap-2 animate-fade-in-up mt-2 cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden"
        >
          {/* Order Status Strip */}
          {activeOrder && (
            <div className={`absolute top-0 left-0 bottom-0 w-1 ${activeOrder.status === 'completed' ? 'bg-green-500' :
              activeOrder.status === 'cancelled' ? 'bg-red-500' :
                'bg-blue-500'
              }`} />
          )}

          <div className="flex items-center gap-3">
            <img src={conversation.productImage || 'https://images.unsplash.com/photo-1557821552-17105176677c?w=100&h=100&fit=crop'} className="w-12 h-12 rounded-lg object-cover shadow-sm bg-gray-100" alt="Product" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <p className="text-sm font-bold text-gray-900 truncate">{conversation.productTitle}</p>
                {activeOrder ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 truncate max-w-[80px]">
                    {activeOrder.status.replace('_', ' ')}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-gray-900">Ask Price</span>
                )}
              </div>

              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-brand-600 font-medium">Click to view details</p>
                {!activeOrder && (conversation.sellerId || (conversation as any).seller_id) !== currentUser.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCheckoutOpen(true);
                    }}
                    className="text-[10px] bg-black text-white px-2 py-1 rounded-lg font-bold hover:bg-gray-800 transition-colors"
                  >
                    Buy Now
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Meetup Details Card */}
          {activeOrder && activeOrder.meetup_location && (
            <div className="bg-blue-50/50 rounded-lg p-2 border border-blue-100 mt-1">
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={12} className="text-blue-600" />
                <span className="text-xs font-bold text-blue-900 line-clamp-1">{activeOrder.meetup_location}</span>
              </div>
              {activeOrder.meetup_time && (
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-blue-600" />
                  <span className="text-xs text-blue-800">{new Date(activeOrder.meetup_time).toLocaleString()}</span>
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-blue-100/50">
                <p className="text-[10px] text-blue-600 text-center font-medium">
                  Both parties must confirm meetup to release funds.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ... (CheckoutModal logic placeholder) ... */}
        {activeOrder && (
          <MeetupArrangementModal
            isOpen={isMeetupModalOpen}
            onClose={() => setIsMeetupModalOpen(false)}
            order={activeOrder}
            onSuccess={handleMeetupSuccess}
          />
        )}


        <div className="text-center text-xs text-gray-400 font-medium my-4">
          <span className="bg-gray-100 px-3 py-1 rounded-full">{new Date(messages[0]?.timestamp || Date.now()).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
        </div>

        {/* ... (Messages mapping remains same) ... */}
        {messages.map((msg, index) => {
          const senderId = msg.senderId || msg.sender_id;
          const isMe = senderId === currentUser.id;
          const showAvatar = isMe ? false : (messages[index + 1]?.senderId || messages[index + 1]?.sender_id) !== senderId;
          const messageType = msg.message_type || 'text';

          // 系统消息（订单状态、议价等）- 居中显示
          if (messageType !== 'text' && messageType !== 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-3">
                <div className="max-w-md w-full px-2">
                  {messageType === 'order_status' && msg.content && (
                    <OrderStatusMessage content={JSON.parse(msg.content)} />
                  )}
                  {messageType === 'price_negotiation' && msg.content && (
                    <PriceNegotiationCard
                      content={JSON.parse(msg.content)}
                      isSeller={conversation.sellerId === currentUser.id}
                      onUpdate={() => {
                        // 重新加载消息
                        getMessages(conversation.id).then(setMessages);
                      }}
                    />
                  )}
                  {messageType === 'price_negotiation_response' && msg.content && (
                    <PriceNegotiationCard
                      content={JSON.parse(msg.content)}
                      isSeller={conversation.sellerId === currentUser.id}
                      onUpdate={() => {
                        getMessages(conversation.id).then(setMessages);
                      }}
                    />
                  )}
                </div>
              </div>
            );
          }

          // 普通文本消息
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
                  <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.text || msg.content}</p>

                  <div className={`flex items-center gap-1 text-[10px] mt-1 select-none ${isMe ? 'justify-end text-brand-100' : 'justify-end text-gray-400'
                    }`}>
                    <span>
                      {new Date(msg.timestamp || msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      {/* ... (Existing input area code) ... */}
      <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-white via-white/95 to-transparent z-[150] sm:absolute sm:bottom-0 sm:left-0 sm:right-0 pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-4">

        {/* Emoji Picker Popover */}
        {showEmojiPicker && (
          <div className="absolute bottom-20 left-4 animate-fade-in-up z-50 mb-safe">
            <div className="glass-panel p-3 rounded-2xl shadow-xl border border-white/50 w-64">
              <div className="grid grid-cols-6 gap-2">
                {['😂', '❤️', '👍', '🔥', '😊', '😭', '😍', '🤔', '🎉', '👀', '🙏', '💯', '👋', '😅', '🙌', '😎', '😉', '😢'].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleAddEmoji(emoji)}
                    className="text-2xl hover:bg-black/5 p-1 rounded-lg transition-colors hover:scale-110 active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="max-w-4xl mx-auto relative flex gap-2 items-end glass-input rounded-[1.5rem] p-1.5 shadow-lg shadow-gray-200/50"
        >
          <button
            type="button"
            onClick={() => {
              // Image Stub
              const toast = document.createElement('div');
              toast.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-6 py-3 rounded-full shadow-xl animate-fade-in z-[80] backdrop-blur-md';
              toast.innerText = '📷 Image sharing coming soon!';
              document.body.appendChild(toast);
              setTimeout(() => toast.remove(), 2000);
            }}
            className="p-2.5 text-gray-400 hover:text-brand-600 hover:bg-gray-100/50 rounded-full transition-colors active:scale-95"
          >
            <ImageIcon size={22} />
          </button>

          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-2.5 transition-colors active:scale-95 rounded-full ${showEmojiPicker ? 'text-brand-600 bg-brand-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'}`}
          >
            <Smile size={22} />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onFocus={() => setShowEmojiPicker(false)}
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