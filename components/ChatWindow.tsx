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
import { UserProfileModal } from './UserProfileModal';

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
  const [productSellerId, setProductSellerId] = useState<string>(''); // 产品卖家ID
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const pendingMessageIds = useRef<Set<string>>(new Set()); // 跟踪正在发送的消息ID，防止重复
  const [showUserProfile, setShowUserProfile] = useState(false);

  // Pagination states
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const MESSAGE_LIMIT = 50; // 加载足够多的消息以包含议价卡片

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
        // 避免重复：检查已存在或正在发送中
        if (prev.some(m => m.id === newMsg.id) || pendingMessageIds.current.has(newMsg.id)) {
          return prev;
        }
        return [...prev, newMsg];
      });
      // Mark as read if from other user
      if (newMsg.senderId !== currentUser.id) {
        markMessagesAsRead(conversation.id, currentUser.id).catch(console.error);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [conversation.id, currentUser.id]);

  // Fetch product info for negotiation
  useEffect(() => {
    if (conversation.productId) {
      const fetchProductInfo = async () => {
        try {
          const { data } = await supabase
            .from('products')
            .select('price, seller_id')
            .eq('id', conversation.productId)
            .single();
          if (data) {
            setProductPrice(data.price || 0);
            setProductSellerId(data.seller_id || '');
          }
        } catch (err) {
          console.error('Error fetching product info:', err);
        }
      };
      fetchProductInfo();
    }
  }, [conversation.productId]);

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

      // 添加临时ID到pending集合
      pendingMessageIds.current.add(tempId);

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
        // 添加真实消息ID到pending集合
        pendingMessageIds.current.add(sentMsg.id);
        setMessages(prev => prev.map(m => m.id === tempId ? sentMsg : m));

        // 延迟清除pending IDs，确保realtime事件已处理
        setTimeout(() => {
          pendingMessageIds.current.delete(tempId);
          pendingMessageIds.current.delete(sentMsg.id);
        }, 2000);
      } catch (error) {
        console.error('Failed to send message:', error);
        pendingMessageIds.current.delete(tempId);
        setMessages(prev => prev.filter(m => m.id !== tempId));
        alert(t('chat.send_failed'));
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
        <div className="relative cursor-pointer" onClick={() => setShowUserProfile(true)}>
          <img
            src={conversation.otherUser.avatar}
            alt={conversation.otherUser.name}
            className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-white/80 hover:ring-brand-300 transition-all"
          />
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
        </div>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowUserProfile(true)}>
          <h2 className="font-bold text-gray-900 truncate leading-tight hover:text-brand-600 transition-colors">{conversation.otherUser.name}</h2>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            <p className="text-xs text-brand-600 font-medium truncate">{t('chat.online')}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 relative">
          {/* Meetup Button (Only if active meetup order exists) */}
          {activeOrder && activeOrder.order_type === 'meetup' && activeOrder.status !== 'completed' && activeOrder.status !== 'cancelled' && (
            <button
              onClick={() => setIsMeetupModalOpen(true)}
              className="p-2 text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-full transition-colors mr-1"
              title={t('chat.arrange_meetup_btn')}
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
                  onClick={() => { setShowMenu(false); alert(t('chat.user_reported')); }}
                  className="w-full text-left px-4 py-3 hover:bg-red-50 text-red-500 text-sm font-medium transition-colors border-b border-gray-100"
                >
                  {t('chat.report_user')}
                </button>
                <button
                  onClick={() => { setShowMenu(false); alert(t('chat.user_blocked')); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                >
                  {t('chat.block_user')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 固定的商品卡片 - Fixed Product Card */}
      <div className="absolute top-[72px] left-0 right-0 z-10 glass-panel border-b border-white/40 px-4 py-2">
        <div
          onClick={handleProductClick}
          className="flex items-center gap-3 cursor-pointer hover:bg-white/50 rounded-xl p-2 transition-all"
        >
          <img
            src={conversation.productImage || 'https://images.unsplash.com/photo-1557821552-17105176677c?w=100&h=100&fit=crop'}
            className="w-14 h-14 rounded-xl object-cover shadow-sm bg-gray-100 ring-2 ring-white/50"
            alt="Product"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{conversation.productTitle}</p>
            <p className="text-xs text-brand-600 font-medium">{t('chat.view_product')}</p>
          </div>

          {/* 议价按钮 */}
          {!activeOrder && productSellerId && productSellerId !== currentUser.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNegotiation(true);
              }}
              className="text-xs bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
            >
              {t('chat.make_offer')}
            </button>
          )}

          {/* 订单状态标签 */}
          {activeOrder && (
            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${activeOrder.status === 'completed' ? 'bg-green-100 text-green-700' :
              activeOrder.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
              }`}>
              {activeOrder.status.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* 见面详情 */}
        {activeOrder && activeOrder.meetup_location && (
          <div className="bg-blue-50 rounded-lg p-2 mt-2 border border-blue-100">
            <div className="flex items-center gap-2">
              <MapPin size={12} className="text-blue-600" />
              <span className="text-xs font-medium text-blue-900 truncate flex-1">{activeOrder.meetup_location}</span>
              {activeOrder.meetup_time && (
                <>
                  <Clock size={12} className="text-blue-600" />
                  <span className="text-xs text-blue-800">{new Date(activeOrder.meetup_time).toLocaleString()}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Messages Area - 调整 padding 适应固定商品卡 */}
      <div className="flex-1 overflow-y-auto pt-[140px] pb-[120px] px-4 sm:px-6 space-y-6 bg-gradient-to-b from-slate-50 to-[#f0f2f5] modern-scrollbar scroll-smooth">

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
                  <span>{t('chat.loading')}</span>
                </>
              ) : (
                <span>{t('chat.load_earlier')}</span>
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
                      isSeller={productSellerId === currentUser.id}
                      onUpdate={() => {
                        // 重新加载消息
                        getMessages(conversation.id).then(setMessages);
                      }}
                    />
                  )}
                  {messageType === 'price_negotiation_response' && msg.content && (
                    <PriceNegotiationCard
                      content={JSON.parse(msg.content)}
                      isSeller={productSellerId === currentUser.id}
                      onUpdate={() => {
                        getMessages(conversation.id).then(setMessages);
                      }}
                    />
                  )}
                  {messageType === 'location' && msg.content && (
                    <LocationCard
                      content={JSON.parse(msg.content)}
                      senderName={isMe ? currentUser.name : conversation.otherUser.name}
                      senderAvatar={isMe ? currentUser.avatar : conversation.otherUser.avatar}
                      isMe={isMe}
                    />
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
                title={t('chat.ask_price')}
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
              title={t('chat.share_location')}
            >
              <MapPin size={18} className="sm:w-[22px] sm:h-[22px]" />
            </button>

            {/* Meetup Time Button - now visible on mobile */}
            <button
              type="button"
              onClick={() => {
                setShowMeetupTime(!showMeetupTime);
                setShowEmojiPicker(false);
                setShowNegotiation(false);
                setShowLocation(false);
                setShowImages(false);
              }}
              className={`p-2 sm:p-2.5 transition-colors active:scale-95 rounded-full ${showMeetupTime ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'}`}
              title={t('chat.arrange_meetup')}
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
      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={showUserProfile}
        onClose={() => setShowUserProfile(false)}
        userId={conversation.otherUser.id}
        userName={conversation.otherUser.name}
        userAvatar={conversation.otherUser.avatar}
        currentUserId={currentUser.id}
        canRate={!!activeOrder && (activeOrder.status === 'completed' || activeOrder.status === 'delivered')}
      />
    </div>
  );
};