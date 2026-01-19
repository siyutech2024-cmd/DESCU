import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, CheckCheck, Loader2, MoreVertical,
  Image as ImageIcon, Smile, MapPin, Clock, DollarSign
} from 'lucide-react';
import { Conversation, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import { subscribeToMessages, markMessagesAsRead, getMessages, sendMessage } from '../services/chatService';
import { MeetupArrangementModal } from './MeetupArrangementModal';
import { OrderStatusMessage } from './chat/OrderStatusMessage';
import { PriceNegotiationCard } from './chat/PriceNegotiationCard';
import { PriceNegotiationSender } from './chat/PriceNegotiationSender';
import { LocationCard } from './chat/LocationCard';
import { LocationSender } from './chat/LocationSender';
import { ImageSender } from './chat/ImageSender';
import { ImagesMessage } from './chat/ImagesMessage';
import { MeetupTimeSender } from './chat/MeetupTimeSender';
import { MeetupTimeMessage } from './chat/MeetupTimeMessage';

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
  const [showNegotiation, setShowNegotiation] = useState(false); // For price negotiation
  const [showLocation, setShowLocation] = useState(false); // For location sharing
  const [showImages, setShowImages] = useState(false); // For image sharing
  const [showMeetupTime, setShowMeetupTime] = useState(false); // For meetup time
  const [productPrice, setProductPrice] = useState<number>(0); // For price negotiation
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showMenu, setShowMenu] = useState(false);

  // Pagination states
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const MESSAGE_LIMIT = 10; // Load 10 messages at a time

  // Load messages on mount and subscribe to realtime updates
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const loadInitialMessages = async () => {
      setIsLoading(true);
      try {
        const msgs = await getMessages(conversation.id, MESSAGE_LIMIT, 0);
        if (msgs && msgs.length > 0) {
          setMessages(msgs);
          setHasMoreMessages(msgs.length === MESSAGE_LIMIT);
          // Mark as read
          markMessagesAsRead(conversation.id, currentUser.id).catch(console.error);
        }
      } catch (err) {
        console.error('Error loading messages:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialMessages();

    // Subscribe to new messages
    unsubscribe = subscribeToMessages(conversation.id, (newMsg) => {
      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      // Mark as read if from other user
      if (newMsg.sender_id !== currentUser.id) {
        markMessagesAsRead(conversation.id, currentUser.id).catch(console.error);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [conversation.id, currentUser.id]);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle product click navigation
  const handleProductClick = () => {
    if (conversation.productId) {
      navigate(`/product/${conversation.productId}`);
    }
  };

  // Fetch product price when negotiation is opened
  useEffect(() => {
    if (showNegotiation && conversation.productId && productPrice === 0) {
      const fetchProductPrice = async () => {
        try {
          const { data } = await supabase
            .from('products')
            .select('price')
            .eq('id', conversation.productId)
            .single();
          if (data?.price) {
            setProductPrice(data.price);
          }
        } catch (err) {
          console.error('Error fetching product price:', err);
        }
      };
      fetchProductPrice();
    }
  }, [showNegotiation, conversation.productId]);

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

  // 加载更多消息
  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages) return;

    setIsLoadingMore(true);
    try {
      const newOffset = messages.length;
      console.log('[ChatWindow] Loading more messages, offset:', newOffset);

      const olderMsgs = await getMessages(conversation.id, MESSAGE_LIMIT, newOffset);
      console.log('[ChatWindow] Loaded', olderMsgs?.length || 0, 'older messages');

      if (olderMsgs && olderMsgs.length > 0) {
        const combined = [...olderMsgs, ...messages];
        const sorted = combined.sort((a, b) =>
          new Date(a.created_at || a.timestamp).getTime() -
          new Date(b.created_at || b.timestamp).getTime()
        );
        setMessages(sorted);
        setHasMoreMessages(olderMsgs.length === MESSAGE_LIMIT);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('[ChatWindow] Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };


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
            <p className="text-xs text-brand-600 font-medium truncate">活跃中 / En línea</p>
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
                  举报用户 / Reportar
                </button>
                <button
                  onClick={() => { setShowMenu(false); alert('User blocked'); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                >
                  屏蔽用户 / Bloquear
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
                  <span className="text-xs font-bold text-gray-900">{t('chat.ask_price')}</span>
                )}
              </div>

              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-brand-600 font-medium">点击查看详情 / Ver detalles</p>
                {!activeOrder && (conversation.sellerId || (conversation as any).seller_id) !== currentUser.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNegotiation(true);
                    }}
                    className="text-[10px] bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold hover:from-green-600 hover:to-emerald-700 transition-all shadow-sm"
                  >
                    {t('chat.ask_price')}
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
                  双方确认后自动放款。
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


        {/* Load More Button */}
        {hasMoreMessages && (
          <div className="flex justify-center my-4">
            <button
              onClick={loadMoreMessages}
              disabled={isLoadingMore}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>加载中...</span>
                </>
              ) : (
                <span>加载更早的消息 / Cargar más</span>
              )}
            </button>
          </div>
        )}

        <div className="text-center text-xs text-gray-400 font-medium my-4">
          <span className="bg-gray-100 px-3 py-1 rounded-full">{new Date(messages[0]?.timestamp || Date.now()).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
        </div>

        {/* Messages List */}
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
                  {messageType === 'location' && msg.content && (
                    <LocationCard content={JSON.parse(msg.content)} />
                  )}
                  {messageType === 'images' && msg.content && (
                    <ImagesMessage content={JSON.parse(msg.content)} />
                  )}
                  {messageType === 'meetup_time' && msg.content && (
                    <MeetupTimeMessage
                      content={JSON.parse(msg.content)}
                      conversationId={conversation.id}
                      currentUserId={currentUser.id}
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


        {/* Price Negotiation Area */}
        {showNegotiation && conversation.productId && (
          <div className="max-w-4xl mx-auto mb-3 px-2">
            <PriceNegotiationSender
              currentPrice={productPrice}
              productId={conversation.productId}
              conversationId={conversation.id}
              onSent={() => {
                setShowNegotiation(false);
                // Refresh messages to show the new negotiation card
                getMessages(conversation.id).then(setMessages);
              }}
            />
          </div>
        )}

        {/* Location Sender Area */}
        {showLocation && (
          <div className="max-w-4xl mx-auto mb-3 px-2">
            <LocationSender
              conversationId={conversation.id}
              onSent={() => {
                setShowLocation(false);
                getMessages(conversation.id).then(setMessages);
              }}
              onClose={() => setShowLocation(false)}
            />
          </div>
        )}

        {/* Image Sender Area */}
        {showImages && (
          <div className="max-w-4xl mx-auto mb-3 px-2">
            <ImageSender
              conversationId={conversation.id}
              onSent={() => {
                setShowImages(false);
                getMessages(conversation.id).then(setMessages);
              }}
              onClose={() => setShowImages(false)}
            />
          </div>
        )}

        {/* Meetup Time Sender Area */}
        {showMeetupTime && (
          <div className="max-w-4xl mx-auto mb-3 px-2">
            <MeetupTimeSender
              conversationId={conversation.id}
              productTitle={conversation.productTitle}
              onSent={() => {
                setShowMeetupTime(false);
                getMessages(conversation.id).then(setMessages);
              }}
              onClose={() => setShowMeetupTime(false)}
            />
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="max-w-4xl mx-auto relative flex gap-1 items-end glass-input rounded-[1.5rem] p-1 sm:p-1.5 shadow-lg shadow-gray-200/50"
        >
          {/* Action buttons - scrollable on mobile */}
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowImages(!showImages);
                setShowEmojiPicker(false);
                setShowNegotiation(false);
                setShowLocation(false);
              }}
              className={`p-2 sm:p-2.5 transition-colors active:scale-95 rounded-full ${showImages ? 'text-purple-600 bg-purple-50' : 'text-gray-400 hover:text-brand-600 hover:bg-gray-100/50'}`}
            >
              <ImageIcon size={18} className="sm:w-[22px] sm:h-[22px]" />
            </button>

            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2 sm:p-2.5 transition-colors active:scale-95 rounded-full hidden sm:block ${showEmojiPicker ? 'text-brand-600 bg-brand-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'}`}
            >
              <Smile size={18} className="sm:w-[22px] sm:h-[22px]" />
            </button>

            {/* Price Negotiation Button (Only for buyer) */}
            {conversation.buyerId === currentUser.id && conversation.productId && (
              <button
                type="button"
                onClick={() => {
                  setShowNegotiation(!showNegotiation);
                  setShowEmojiPicker(false);
                  setShowLocation(false);
                }}
                className={`p-2 sm:p-2.5 transition-colors active:scale-95 rounded-full ${showNegotiation ? 'text-brand-600 bg-brand-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'}`}
                title="议价"
              >
                <DollarSign size={18} className="sm:w-[22px] sm:h-[22px]" />
              </button>
            )}

            {/* Location Share Button */}
            <button
              type="button"
              onClick={() => {
                setShowLocation(!showLocation);
                setShowEmojiPicker(false);
                setShowNegotiation(false);
              }}
              className={`p-2 sm:p-2.5 transition-colors active:scale-95 rounded-full ${showLocation ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'}`}
              title="分享位置"
            >
              <MapPin size={18} className="sm:w-[22px] sm:h-[22px]" />
            </button>

            {/* Meetup Time Button - hidden on mobile */}
            <button
              type="button"
              onClick={() => {
                setShowMeetupTime(!showMeetupTime);
                setShowEmojiPicker(false);
                setShowNegotiation(false);
                setShowLocation(false);
                setShowImages(false);
              }}
              className={`p-2 sm:p-2.5 transition-colors active:scale-95 rounded-full hidden sm:block ${showMeetupTime ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'}`}
              title="约定时间"
            >
              <Clock size={18} className="sm:w-[22px] sm:h-[22px]" />
            </button>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onFocus={() => setShowEmojiPicker(false)}
            placeholder={t('chat.type')}
            disabled={isSending}
            className="flex-1 min-w-0 bg-transparent text-gray-900 placeholder-gray-400 px-1 py-2.5 sm:py-3 focus:outline-none text-sm sm:text-[15px]"
          />

          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className={`p-2.5 sm:p-3 rounded-full shadow-lg transition-all duration-300 active:scale-90 flex-shrink-0
              ${newMessage.trim()
                ? 'bg-brand-600 text-white shadow-brand-300 hover:bg-brand-700 hover:shadow-brand-400 hover:-translate-y-0.5'
                : 'bg-gray-200 text-gray-400 shadow-none cursor-not-allowed'
              }`}
          >
            {isSending ? <Loader2 size={18} className="animate-spin sm:w-5 sm:h-5" /> : <Send size={18} className="sm:w-5 sm:h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
};