import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Send, CheckCheck, Loader2, MoreVertical,
  Image as ImageIcon, Smile, MapPin, Clock, DollarSign
} from 'lucide-react';
import { Conversation, User } from '@/types';
import { useLanguage, useLocale } from '@/i18n';
import { subscribeToMessages, markMessagesAsRead, getMessages, sendMessage } from '@/services/chatService';
import { blockUser } from '@/services/moderationService';
import { api, ApiError } from '@/lib/api/client';
import { queryKeys } from '@/lib/queryClient';
import { notify } from '@/lib/toast';
import { useOrders } from '@/features/orders';
import { ReportModal } from '@/features/users/components/ReportModal';
import { MeetupArrangementModal } from '@/features/orders/components/MeetupArrangementModal';
import { OrderStatusMessage } from './OrderStatusMessage';
import { PriceNegotiationCard } from './PriceNegotiationCard';
import { PriceNegotiationSender } from './PriceNegotiationSender';
import { LocationCard } from './LocationCard';
import { LocationSender } from './LocationSender';
import { ImageSender } from './ImageSender';
import { ImagesMessage } from './ImagesMessage';
import { MeetupTimeSender } from './MeetupTimeSender';
import { MeetupTimeMessage } from './MeetupTimeMessage';

interface ChatWindowProps {
  conversation: Conversation;
  currentUser: User;
  onBack: () => void;
  onSendMessage?: (conversationId: string, text: string) => void;
}

/** Realtime / REST message row (snake_case, as stored in the `messages` table). */
interface ChatMessageRow {
  id: string;
  conversation_id?: string;
  sender_id: string;
  text?: string | null;
  /** JSON string payload for rich message types. */
  content?: string | null;
  message_type?: string | null;
  is_read?: boolean;
  created_at: string;
}

const MESSAGE_LIMIT = 50; // 加载足够多的消息以包含议价卡片
const OPEN_ORDER_STATUSES_EXCLUDED = new Set(['completed', 'completed_pending_payout', 'cancelled', 'refunded']);

/** Parse a rich-message JSON payload; returns null (→ plain-text fallback) when it isn't valid JSON. */
const safeParseContent = (raw: unknown): Record<string, any> | null => {
  if (raw && typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const messageTime = (msg: ChatMessageRow): number => {
  const ms = new Date(msg.created_at).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

/** Merge two id-deduplicated message lists in chronological order. */
const mergeMessages = (a: ChatMessageRow[], b: ChatMessageRow[]): ChatMessageRow[] => {
  const seen = new Set<string>();
  const out: ChatMessageRow[] = [];
  for (const m of [...a, ...b]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out.sort((x, y) => messageTime(x) - messageTime(y));
};

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  currentUser,
  onBack,
  onSendMessage
}) => {
  const { t } = useLanguage();
  const locale = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [, setIsLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isMeetupModalOpen, setIsMeetupModalOpen] = useState(false); // New state
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  // The order attached to this conversation (newest order for product+buyer, resolved by the API).
  // `useOrders` is read-only here: we only look the full row up by id.
  const { orders } = useOrders();
  const activeOrder = useMemo(
    () => (conversation.orderId ? orders.find(o => o.id === conversation.orderId) ?? null : null),
    [orders, conversation.orderId]
  );
  // Status label falls back to the conversation summary while the orders query is still loading.
  const orderStatus: string | undefined = activeOrder?.status ?? conversation.orderStatus;
  const hasOpenOrder = !!orderStatus && !OPEN_ORDER_STATUSES_EXCLUDED.has(orderStatus);

  const invalidateConversations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.conversations(currentUser.id) });
  }, [queryClient, currentUser.id]);

  /** Mark the thread as read server-side, then refresh the list so unread badges drop. */
  const markRead = useCallback(() => {
    markMessagesAsRead(conversation.id, currentUser.id)
      .catch(console.error)
      .finally(invalidateConversations);
  }, [conversation.id, currentUser.id, invalidateConversations]);
  const [showNegotiation, setShowNegotiation] = useState(false); // For price negotiation
  const [showLocation, setShowLocation] = useState(false); // For location sharing
  const [showImages, setShowImages] = useState(false); // For image sharing
  const [showMeetupTime, setShowMeetupTime] = useState(false); // For meetup time
  const [productPrice, setProductPrice] = useState<number>(0); // For price negotiation
  const [productSellerId, setProductSellerId] = useState<string>(''); // 产品卖家ID
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  /** scrollHeight captured before prepending older messages, so the viewport doesn't jump. */
  const preserveScrollFromRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const pendingMessageIds = useRef<Set<string>>(new Set()); // 跟踪正在发送的消息ID，防止重复

  // Pagination states
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  /**
   * Fetch the newest page (newest-first from the API, reversed for display) and merge it into
   * the list. On first load this fills the window; later calls (after sending a rich message)
   * pick up new rows without discarding pages that were already loaded via "load earlier".
   */
  const reloadLatest = useCallback(async () => {
    const page = (await getMessages(conversation.id, { limit: MESSAGE_LIMIT, order: 'desc' })) as ChatMessageRow[];
    const newestFirst = page ?? [];
    // Fresh rows first so an updated payload (e.g. negotiation status) wins over the cached copy.
    setMessages(prev => mergeMessages([...newestFirst].reverse(), prev));
    setHasMoreMessages(prev => prev || newestFirst.length >= MESSAGE_LIMIT);
    return newestFirst;
  }, [conversation.id]);

  // Load messages on mount and subscribe to realtime updates
  useEffect(() => {
    let cancelled = false;

    const loadInitialMessages = async () => {
      setIsLoading(true);
      try {
        const page = await reloadLatest();
        if (!cancelled && page.length > 0) markRead();
      } catch (err) {
        console.error('Error loading messages:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadInitialMessages();

    // Subscribe to new messages (rows arrive snake_case from Postgres)
    const unsubscribe = subscribeToMessages(conversation.id, (row) => {
      const newMsg = row as ChatMessageRow;
      setMessages(prev => {
        // 避免重复：检查已存在或正在发送中
        if (prev.some(m => m.id === newMsg.id) || pendingMessageIds.current.has(newMsg.id)) {
          return prev;
        }
        return [...prev, newMsg];
      });
      // Mark as read if from other user
      if (newMsg.sender_id !== currentUser.id) markRead();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [conversation.id, currentUser.id, reloadLatest, markRead]);

  // Fetch product info for negotiation
  useEffect(() => {
    if (conversation.productId) {
      const fetchProductInfo = async () => {
        try {
          const data = await api.get<{ price?: number; seller_id?: string }>(`/api/products/${conversation.productId}`, { auth: 'optional' });
          if (data) {
            setProductPrice(Number(data.price) || 0);
            setProductSellerId(data.seller_id || '');
          }
        } catch (err) {
          console.error('Error fetching product info:', err);
        }
      };
      fetchProductInfo();
    }
  }, [conversation.productId]);

  // Auto scroll to bottom when messages change — except after "load earlier", where we keep
  // the same messages in view by offsetting scrollTop by the height that was prepended.
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    const previousHeight = preserveScrollFromRef.current;
    if (container && previousHeight !== null) {
      preserveScrollFromRef.current = null;
      // Jump instantly — the container's `scroll-smooth` would otherwise animate the correction.
      const previousBehavior = container.style.scrollBehavior;
      container.style.scrollBehavior = 'auto';
      container.scrollTop += container.scrollHeight - previousHeight;
      container.style.scrollBehavior = previousBehavior;
      return;
    }
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
      const tempMsg: ChatMessageRow = {
        id: tempId,
        conversation_id: conversation.id,
        sender_id: currentUser.id,
        text,
        message_type: 'text',
        created_at: new Date().toISOString(),
        is_read: false
      };

      setMessages(prev => [...prev, tempMsg]);
      setNewMessage('');

      // Keep focus on input for web
      inputRef.current?.focus();

      try {
        const sentMsg = (await sendMessage(conversation.id, currentUser.id, text)) as ChatMessageRow;
        // 添加真实消息ID到pending集合
        pendingMessageIds.current.add(sentMsg.id);
        setMessages(prev => prev.map(m => m.id === tempId ? { ...tempMsg, ...sentMsg } : m));
        invalidateConversations();

        // 延迟清除pending IDs，确保realtime事件已处理
        setTimeout(() => {
          pendingMessageIds.current.delete(tempId);
          pendingMessageIds.current.delete(sentMsg.id);
        }, 2000);
      } catch (error) {
        console.error('Failed to send message:', error);
        pendingMessageIds.current.delete(tempId);
        setMessages(prev => prev.filter(m => m.id !== tempId));
        if (error instanceof ApiError && error.status === 403) {
          notify.error(t('chat.blocked_cannot_send'));
        } else {
          notify.error(t('chat.send_failed'));
        }
      } finally {
        setIsSending(false);
      }
    }
  };


  // Reload order when meetup arranged
  const handleMeetupSuccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.orders(currentUser.id) });
    invalidateConversations();
  };

  const handleBlockUser = async () => {
    if (isBlocking) return;
    setIsBlocking(true);
    try {
      await blockUser(conversation.otherUser.id);
      notify.success(t('chat.user_blocked'));
      invalidateConversations();
    } catch (error) {
      console.error('[chat] block failed:', error);
      notify.error(t('chat.block_failed'));
    } finally {
      setIsBlocking(false);
    }
  };

  // 加载更早的消息（cursor: 当前最早一条的 created_at）
  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages) return;
    const oldest = messages.find(m => !m.id.startsWith('temp-'));
    if (!oldest) {
      setHasMoreMessages(false);
      return;
    }

    setIsLoadingMore(true);
    try {
      const olderNewestFirst = (await getMessages(conversation.id, {
        limit: MESSAGE_LIMIT,
        order: 'desc',
        before: oldest.created_at,
      })) as ChatMessageRow[];
      const older = olderNewestFirst ?? [];

      if (older.length > 0) {
        preserveScrollFromRef.current = scrollContainerRef.current?.scrollHeight ?? null;
        setMessages(prev => mergeMessages([...older].reverse(), prev));
      }
      setHasMoreMessages(older.length >= MESSAGE_LIMIT);
    } catch (error) {
      console.error('[ChatWindow] Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };


  return (
    // Mobile: a fixed full-height column that ends where the bottom nav starts (shared
    // --bottom-nav-h var). Desktop (md+): a normal block inside ChatPage's card.
    <div className="fixed inset-x-0 top-0 bottom-nav-offset z-overlay flex flex-col bg-[#f8f9fa] md:static md:h-full md:rounded-2xl md:overflow-hidden md:border md:border-gray-200 animate-fade-in">

      {/* Header - Glassmorphism (pt-safe: sits under the notch on mobile) */}
      <div className="flex-shrink-0 relative z-20 glass-panel border-b border-white/40 pt-safe md:pt-0">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-gray-600 hover:bg-black/5 rounded-full transition-colors active:scale-95"
          >
            <ArrowLeft size={22} />
          </button>

          {/* ... (User Avatar & Name) ... */}
          <div className="relative cursor-pointer" onClick={() => navigate(`/user/${conversation.otherUser.id}`)}>
            <img
              src={conversation.otherUser.avatar}
              alt={conversation.otherUser.name}
              className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-white/80 hover:ring-brand-300 transition-all"
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
          </div>

          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/user/${conversation.otherUser.id}`)}>
            <h2 className="font-bold text-gray-900 truncate leading-tight hover:text-brand-600 transition-colors">{conversation.otherUser.name}</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <p className="text-xs text-brand-600 font-medium truncate">{t('chat.online')}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 relative">
            {/* Meetup Button (Only if active meetup order exists) */}
            {activeOrder && activeOrder.order_type === 'meetup' && hasOpenOrder && (
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
                <div className="absolute right-0 top-12 w-48 bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/50 z-raised overflow-hidden animate-fade-in-up origin-top-right">
                  <button
                    onClick={() => { setShowMenu(false); setIsReportOpen(true); }}
                    className="w-full text-left px-4 py-3 hover:bg-red-50 text-red-500 text-sm font-medium transition-colors border-b border-gray-100"
                  >
                    {t('chat.report_user')}
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); handleBlockUser(); }}
                    disabled={isBlocking}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {t('chat.block_user')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Product card - pinned under the header as a normal flex child */}
      <div className="flex-shrink-0 relative z-10 glass-panel border-b border-white/40 px-4 py-2">
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
          {!hasOpenOrder && productSellerId && productSellerId !== currentUser.id && (
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
          {orderStatus && (
            <span
              title={t('chat.order_status_label')}
              className={`text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0 ${orderStatus.startsWith('completed') ? 'bg-green-100 text-green-700' :
                orderStatus === 'cancelled' || orderStatus === 'refunded' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
              {orderStatus.replace(/_/g, ' ')}
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
                  <span className="text-xs text-blue-800">{new Date(activeOrder.meetup_time).toLocaleString(locale)}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Messages Area - the only scroll container in the column */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto py-4 px-4 md:px-6 space-y-6 bg-gradient-to-b from-slate-50 to-[#f0f2f5] modern-scrollbar scroll-smooth">

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
          <span className="bg-gray-100 px-3 py-1 rounded-full">{new Date(messages[0]?.created_at || Date.now()).toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
        </div>

        {/* Messages List */}
        {messages.map((msg, index) => {
          const senderId = msg.sender_id;
          const isMe = senderId === currentUser.id;
          const showAvatar = isMe ? false : messages[index + 1]?.sender_id !== senderId;
          const messageType = msg.message_type || 'text';
          // Rich payloads live in `content` (JSON string); some rows only carry a JSON `text`.
          const richContent = messageType !== 'text' && messageType !== 'system'
            ? safeParseContent(msg.content) ?? safeParseContent(msg.text)
            : null;

          // 系统消息（订单状态、议价等）- 居中显示。解析失败时退回普通文本渲染。
          if (richContent) {
            return (
              <div key={msg.id} className="flex justify-center my-3">
                <div className="max-w-md w-full px-2">
                  {messageType === 'order_status' && (
                    <OrderStatusMessage content={richContent as any} currentUserId={currentUser.id} />
                  )}
                  {(messageType === 'price_negotiation' || messageType === 'price_negotiation_response') && (
                    <PriceNegotiationCard
                      content={richContent as any}
                      isSeller={productSellerId === currentUser.id}
                      onUpdate={() => { reloadLatest().catch(console.error); }}
                    />
                  )}
                  {messageType === 'location' && (
                    <LocationCard
                      content={richContent as any}
                      senderName={isMe ? currentUser.name : conversation.otherUser.name}
                      senderAvatar={isMe ? currentUser.avatar : conversation.otherUser.avatar}
                      isMe={isMe}
                    />
                  )}
                  {(messageType === 'images' || messageType === 'image') && (
                    <ImagesMessage content={richContent as any} />
                  )}
                  {messageType === 'meetup_time' && (
                    <MeetupTimeMessage
                      content={richContent as any}
                      conversationId={conversation.id}
                      currentUserId={currentUser.id}
                      onUpdate={() => { reloadLatest().catch(console.error); }}
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
                  <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.text || (typeof msg.content === 'string' ? msg.content : '')}</p>

                  <div className={`flex items-center gap-1 text-[10px] mt-1 select-none ${isMe ? 'justify-end text-brand-100' : 'justify-end text-gray-400'
                    }`}>
                    <span>
                      {new Date(msg.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
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

      {/* Composer - bottom of the flex column (above the bottom nav on mobile) */}
      <div className="flex-shrink-0 relative z-20 p-3 md:p-4 bg-gradient-to-t from-white via-white/95 to-transparent">

        {/* Emoji Picker Popover */}
        {showEmojiPicker && (
          <div className="absolute bottom-20 left-4 animate-fade-in-up z-raised mb-safe">
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
                reloadLatest().catch(console.error);
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
                reloadLatest().catch(console.error);
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
                reloadLatest().catch(console.error);
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
                reloadLatest().catch(console.error);
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
              className={`p-2 sm:p-2.5 transition-colors active:scale-95 rounded-full hidden md:block ${showEmojiPicker ? 'text-brand-600 bg-brand-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'}`}
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

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="user"
        targetId={conversation.otherUser.id}
      />

    </div>
  );
};