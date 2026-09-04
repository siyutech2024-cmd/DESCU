import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, CheckCheck, MoreVertical, Image as ImageIcon, Smile, MapPin, CalendarClock, Tag, Clock, Flag, Ban, ChevronRight } from 'lucide-react';
import { Conversation, User } from '@/types';
import { useLanguage, useLocale } from '@/i18n';
import { subscribeToMessages, markMessagesAsRead, getMessages, sendMessage } from '@/services/chatService';
import { blockUser } from '@/services/moderationService';
import { api, ApiError } from '@/lib/api/client';
import { queryKeys } from '@/lib/queryClient';
import { notify } from '@/lib/toast';
import { useOrders } from '@/features/orders';
import { orderStatusLabel, orderStatusTone } from '@/features/orders/orderStatusLabel';
import { useRegion } from '@/contexts/RegionContext';
import { ReportModal } from '@/features/users/components/ReportModal';
import { MeetupArrangementModal } from '@/features/orders/components/MeetupArrangementModal';
import { Button, Chip, IconButton } from '@/components/ui/primitives';
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
  /** Hide the back arrow (desktop two-pane layout keeps the list visible). */
  hideBack?: boolean;
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

type Composer = 'images' | 'offer' | 'location' | 'meetup' | null;

const MESSAGE_LIMIT = 50;
const OPEN_ORDER_STATUSES_EXCLUDED = new Set(['completed', 'completed_pending_payout', 'cancelled', 'refunded']);
const EMOJIS = ['😂', '❤️', '👍', '🔥', '😊', '😭', '😍', '🤔', '🎉', '👀', '🙏', '💯', '👋', '😅', '🙌', '😎', '😉', '😢'];

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

const dayKey = (iso: string) => new Date(iso).toDateString();

export const ChatWindow: React.FC<ChatWindowProps> = ({ conversation, currentUser, onBack, hideBack = false }) => {
  const { t } = useLanguage();
  const locale = useLocale();
  const { formatCurrency } = useRegion();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [composer, setComposer] = useState<Composer>(null);
  const [isMeetupModalOpen, setIsMeetupModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [product, setProduct] = useState<{ price: number; currency: string; sellerId: string } | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  /** scrollHeight captured before prepending older messages, so the viewport doesn't jump. */
  const preserveScrollFromRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingMessageIds = useRef<Set<string>>(new Set());

  // The order attached to this conversation (newest order for product+buyer, resolved by the API).
  const { orders } = useOrders();
  const activeOrder = useMemo(
    () => (conversation.orderId ? orders.find(o => o.id === conversation.orderId) ?? null : null),
    [orders, conversation.orderId]
  );
  const orderStatus: string | undefined = activeOrder?.status ?? conversation.orderStatus;
  const hasOpenOrder = !!orderStatus && !OPEN_ORDER_STATUSES_EXCLUDED.has(orderStatus);
  const isSeller = !!product && product.sellerId === currentUser.id;
  const isBuyer = conversation.buyerId ? conversation.buyerId === currentUser.id : !isSeller;

  const invalidateConversations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.conversations(currentUser.id) });
  }, [queryClient, currentUser.id]);

  const markRead = useCallback(() => {
    markMessagesAsRead(conversation.id, currentUser.id).catch(console.error).finally(invalidateConversations);
  }, [conversation.id, currentUser.id, invalidateConversations]);

  /** Fetch the newest page and merge it (keeps pages already loaded via "load earlier"). */
  const reloadLatest = useCallback(async () => {
    const page = (await getMessages(conversation.id, { limit: MESSAGE_LIMIT, order: 'desc' })) as ChatMessageRow[];
    const newestFirst = page ?? [];
    setMessages(prev => mergeMessages([...newestFirst].reverse(), prev));
    setHasMoreMessages(prev => prev || newestFirst.length >= MESSAGE_LIMIT);
    return newestFirst;
  }, [conversation.id]);

  useEffect(() => {
    let cancelled = false;
    reloadLatest().then(page => { if (!cancelled && page.length > 0) markRead(); }).catch(err => console.error('Error loading messages:', err));

    const unsubscribe = subscribeToMessages(conversation.id, row => {
      const newMsg = row as ChatMessageRow;
      setMessages(prev => (prev.some(m => m.id === newMsg.id) || pendingMessageIds.current.has(newMsg.id) ? prev : [...prev, newMsg]));
      if (newMsg.sender_id !== currentUser.id) markRead();
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [conversation.id, currentUser.id, reloadLatest, markRead]);

  useEffect(() => {
    if (!conversation.productId) return;
    api.get<{ price?: number; currency?: string; seller_id?: string }>(`/api/products/${conversation.productId}`, { auth: 'optional' })
      .then(d => setProduct({ price: Number(d.price) || 0, currency: d.currency || 'MXN', sellerId: d.seller_id || '' }))
      .catch(err => console.error('Error fetching product info:', err));
  }, [conversation.productId]);

  // Auto scroll to bottom when messages change — except after "load earlier".
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    const previousHeight = preserveScrollFromRef.current;
    if (container && previousHeight !== null) {
      preserveScrollFromRef.current = null;
      const previousBehavior = container.style.scrollBehavior;
      container.style.scrollBehavior = 'auto';
      container.scrollTop += container.scrollHeight - previousHeight;
      container.style.scrollBehavior = previousBehavior;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || isSending) return;
    setIsSending(true);
    const tempId = `temp-${Date.now()}`;
    pendingMessageIds.current.add(tempId);
    const tempMsg: ChatMessageRow = { id: tempId, conversation_id: conversation.id, sender_id: currentUser.id, text, message_type: 'text', created_at: new Date().toISOString(), is_read: false };
    setMessages(prev => [...prev, tempMsg]);
    setNewMessage('');
    setShowEmojiPicker(false);
    inputRef.current?.focus();
    try {
      const sentMsg = (await sendMessage(conversation.id, currentUser.id, text)) as ChatMessageRow;
      pendingMessageIds.current.add(sentMsg.id);
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...tempMsg, ...sentMsg } : m)));
      invalidateConversations();
      setTimeout(() => { pendingMessageIds.current.delete(tempId); pendingMessageIds.current.delete(sentMsg.id); }, 2000);
    } catch (error) {
      pendingMessageIds.current.delete(tempId);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      notify.error(error instanceof ApiError && error.status === 403 ? t('chat.blocked_cannot_send') : t('chat.send_failed'));
    } finally {
      setIsSending(false);
    }
  };

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
    } catch {
      notify.error(t('chat.block_failed'));
    } finally {
      setIsBlocking(false);
    }
  };

  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages) return;
    const oldest = messages.find(m => !m.id.startsWith('temp-'));
    if (!oldest) { setHasMoreMessages(false); return; }
    setIsLoadingMore(true);
    try {
      const older = ((await getMessages(conversation.id, { limit: MESSAGE_LIMIT, order: 'desc', before: oldest.created_at })) as ChatMessageRow[]) ?? [];
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

  const openComposer = (which: Composer) => { setShowEmojiPicker(false); setComposer(which); };
  const afterRichSend = () => { setComposer(null); reloadLatest().catch(console.error); };
  const otherRole = conversation.sellerId ? (conversation.sellerId === conversation.otherUser.id ? t('detail.seller') : t('chat.buyer_one')) : '';

  const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    // Mobile: a fixed full-height column that ends where the bottom nav starts. Desktop (md+): fills its pane.
    <div className="fixed inset-x-0 top-0 bottom-nav-offset z-overlay flex flex-col bg-[#f7f7fb] md:static md:h-full md:z-auto animate-fade-in">

      {/* Header */}
      <div className="flex-shrink-0 relative z-20 bg-white/90 backdrop-blur-md border-b border-gray-100 pt-safe md:pt-0">
        <div className="px-3 md:px-4 h-14 flex items-center gap-2">
          {!hideBack && (
            <IconButton onClick={onBack} aria-label={t('detail.back')} className="-ml-1"><ArrowLeft size={22} /></IconButton>
          )}
          <button type="button" onClick={() => navigate(`/user/${conversation.otherUser.id}`)} className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-xl px-1 py-1 hover:bg-gray-50 transition-colors">
            <img src={conversation.otherUser.avatar} alt="" className="w-9 h-9 rounded-full object-cover bg-gray-100 ring-2 ring-white" />
            <span className="min-w-0">
              <span className="block font-bold text-gray-900 truncate leading-tight">{conversation.otherUser.name}</span>
              {otherRole && <span className="block text-xs text-gray-500 truncate capitalize">{otherRole}</span>}
            </span>
          </button>
          <div className="flex items-center gap-1 relative">
            {activeOrder && activeOrder.order_type === 'meetup' && hasOpenOrder && (
              <IconButton onClick={() => setIsMeetupModalOpen(true)} active title={t('chat.arrange_meetup_btn')} aria-label={t('chat.arrange_meetup_btn')}><MapPin size={20} /></IconButton>
            )}
            <IconButton onClick={() => setShowMenu(v => !v)} aria-label="Menu" aria-expanded={showMenu}><MoreVertical size={20} /></IconButton>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-raised" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-12 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-overlay overflow-hidden animate-scale-in origin-top-right py-1">
                  <button type="button" onClick={() => { setShowMenu(false); setIsReportOpen(true); }} className="w-full flex items-center gap-3 text-left px-4 py-2.5 hover:bg-gray-50 text-gray-800 text-sm font-medium">
                    <Flag size={16} className="text-gray-400" />{t('chat.report_user')}
                  </button>
                  <button type="button" onClick={() => { setShowMenu(false); handleBlockUser(); }} disabled={isBlocking} className="w-full flex items-center gap-3 text-left px-4 py-2.5 hover:bg-red-50 text-red-600 text-sm font-medium disabled:opacity-50">
                    <Ban size={16} />{t('chat.block_user')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Product strip */}
        <div className="px-3 md:px-4 pb-2.5">
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-100 p-2">
            <button type="button" onClick={() => conversation.productId && navigate(`/product/${conversation.productId}`)} className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-lg hover:bg-white transition-colors">
              <img src={conversation.productImage || undefined} alt="" className="w-11 h-11 rounded-lg object-cover bg-gray-200 flex-shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-900 truncate">{conversation.productTitle}</span>
                <span className="block text-xs text-gray-500 truncate">
                  {product && product.price > 0 ? <span className="font-bold text-gray-700 tabular-nums">{formatCurrency(product.price, product.currency)}</span> : t('chat.view_product')}
                  {product && product.price > 0 && <ChevronRight size={12} className="inline ml-0.5 -mt-0.5 text-gray-400" />}
                </span>
              </span>
            </button>
            {orderStatus ? (
              <Chip tone={orderStatusTone(orderStatus)} title={t('chat.order_status_label')}>{orderStatusLabel(orderStatus, t, { paymentMethod: activeOrder?.payment_method })}</Chip>
            ) : isBuyer && conversation.productId ? (
              <Button size="sm" variant="secondary" icon={<Tag size={14} />} onClick={() => openComposer('offer')}>{t('chat.make_offer')}</Button>
            ) : (
              <Chip tone="neutral">{t('chat.tab.inquiring')}</Chip>
            )}
          </div>
          {activeOrder?.meetup_location && (
            <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-xs text-brand-800">
              <MapPin size={12} className="flex-shrink-0" />
              <span className="truncate font-medium flex-1">{activeOrder.meetup_location}</span>
              {activeOrder.meetup_time && <><Clock size={12} className="flex-shrink-0" /><span className="tabular-nums">{new Date(activeOrder.meetup_time).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</span></>}
            </div>
          )}
        </div>
      </div>

      {/* Messages — the only scroll container in the column */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto px-3 md:px-6 py-4 space-y-3 modern-scrollbar scroll-smooth">
        {activeOrder && (
          <MeetupArrangementModal isOpen={isMeetupModalOpen} onClose={() => setIsMeetupModalOpen(false)} order={activeOrder} onSuccess={handleMeetupSuccess} />
        )}

        {hasMoreMessages && (
          <div className="flex justify-center">
            <Button size="sm" variant="subtle" onClick={loadMoreMessages} loading={isLoadingMore}>{t('chat.load_earlier')}</Button>
          </div>
        )}

        {messages.map((msg, index) => {
          const isMe = msg.sender_id === currentUser.id;
          const prev = messages[index - 1];
          const showDay = !prev || dayKey(prev.created_at) !== dayKey(msg.created_at);
          const messageType = msg.message_type || 'text';
          const richContent = messageType !== 'text' && messageType !== 'system'
            ? safeParseContent(msg.content) ?? safeParseContent(msg.text)
            : null;
          const isSystemEvent = messageType === 'order_status';

          const daySeparator = showDay && (
            <div className="flex justify-center py-1">
              <span className="rounded-full bg-white border border-gray-100 px-3 py-1 text-[11px] font-bold text-gray-400 first-letter:uppercase">
                {new Date(msg.created_at).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })}
              </span>
            </div>
          );

          if (richContent) {
            const card =
              messageType === 'order_status' ? <OrderStatusMessage content={richContent as any} currentUserId={currentUser.id} /> :
              messageType === 'price_negotiation' || messageType === 'price_negotiation_response' ? <PriceNegotiationCard content={richContent as any} isSeller={isSeller} onUpdate={() => { reloadLatest().catch(console.error); }} /> :
              messageType === 'location' ? <LocationCard content={richContent as any} senderName={isMe ? currentUser.name : conversation.otherUser.name} isMe={isMe} /> :
              messageType === 'images' || messageType === 'image' ? <ImagesMessage content={richContent as any} /> :
              messageType === 'meetup_time' ? <MeetupTimeMessage content={richContent as any} conversationId={conversation.id} currentUserId={currentUser.id} onUpdate={() => { reloadLatest().catch(console.error); }} onSuggestNew={() => openComposer('meetup')} /> :
              null;
            if (!card) return null;
            return (
              <React.Fragment key={msg.id}>
                {daySeparator}
                <div className={`flex ${isSystemEvent ? 'justify-center' : isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex flex-col ${isMe && !isSystemEvent ? 'items-end' : 'items-start'} w-full max-w-[min(100%,360px)]`}>
                    {card}
                    <span className="mt-1 px-1 text-[10px] text-gray-400 select-none">{timeLabel(msg.created_at)}</span>
                  </div>
                </div>
              </React.Fragment>
            );
          }

          const showAvatar = !isMe && messages[index + 1]?.sender_id !== msg.sender_id;
          return (
            <React.Fragment key={msg.id}>
              {daySeparator}
              <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && (
                  <img src={conversation.otherUser.avatar} alt="" className={`w-7 h-7 rounded-full object-cover bg-gray-100 flex-shrink-0 ${showAvatar ? '' : 'invisible'}`} />
                )}
                <div className={`max-w-[80%] sm:max-w-[70%] px-3.5 py-2 text-[15px] leading-relaxed shadow-sm ${isMe ? 'bg-brand-600 text-white rounded-2xl rounded-br-md' : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-bl-md'}`}>
                  <p className="whitespace-pre-wrap break-words">{msg.text || (typeof msg.content === 'string' ? msg.content : '')}</p>
                  <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] select-none ${isMe ? 'text-brand-100' : 'text-gray-400'}`}>
                    <span>{timeLabel(msg.created_at)}</span>
                    {isMe && <CheckCheck size={13} className={msg.is_read ? 'text-white' : 'text-brand-300'} />}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 relative z-20 px-3 md:px-4 pt-2 pb-2 md:pb-3 bg-white border-t border-gray-100">
        {showEmojiPicker && (
          <div className="absolute bottom-full left-3 mb-2 z-raised animate-scale-in origin-bottom-left">
            <div className="bg-white p-2 rounded-2xl shadow-xl border border-gray-100 w-64 grid grid-cols-6 gap-1">
              {EMOJIS.map(emoji => (
                <button key={emoji} type="button" onClick={() => setNewMessage(v => v + emoji)} className="text-2xl rounded-lg p-1 hover:bg-gray-100 active:scale-95 transition">{emoji}</button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-1">
          <div className="flex items-center flex-shrink-0">
            <IconButton size="sm" onClick={() => openComposer('images')} title={t('image.title')} aria-label={t('image.title')}><ImageIcon size={20} /></IconButton>
            <IconButton size="sm" onClick={() => setShowEmojiPicker(v => !v)} active={showEmojiPicker} className="hidden md:inline-flex" aria-label="Emoji"><Smile size={20} /></IconButton>
            {isBuyer && conversation.productId && !hasOpenOrder && (
              <IconButton size="sm" onClick={() => openComposer('offer')} title={t('chat.ask_price')} aria-label={t('chat.ask_price')}><Tag size={20} /></IconButton>
            )}
            <IconButton size="sm" onClick={() => openComposer('location')} title={t('chat.share_location')} aria-label={t('chat.share_location')}><MapPin size={20} /></IconButton>
            <IconButton size="sm" onClick={() => openComposer('meetup')} title={t('chat.arrange_meetup')} aria-label={t('chat.arrange_meetup')}><CalendarClock size={20} /></IconButton>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onFocus={() => setShowEmojiPicker(false)}
            placeholder={t('chat.type')}
            disabled={isSending}
            enterKeyHint="send"
            className="flex-1 min-w-0 h-11 rounded-full border border-gray-200 bg-gray-50 px-4 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 transition"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            aria-label={t('chat.send')}
            className="w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center transition-colors bg-brand-600 text-white shadow-md shadow-brand-500/25 hover:bg-brand-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Rich message composers (bottom sheets) */}
      {conversation.productId && (
        <PriceNegotiationSender open={composer === 'offer'} currentPrice={product?.price ?? 0} productId={conversation.productId} conversationId={conversation.id} onSent={afterRichSend} onClose={() => setComposer(null)} />
      )}
      <LocationSender open={composer === 'location'} conversationId={conversation.id} onSent={afterRichSend} onClose={() => setComposer(null)} />
      <ImageSender open={composer === 'images'} conversationId={conversation.id} onSent={afterRichSend} onClose={() => setComposer(null)} />
      <MeetupTimeSender open={composer === 'meetup'} conversationId={conversation.id} productTitle={conversation.productTitle} onSent={afterRichSend} onClose={() => setComposer(null)} />

      <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} targetType="user" targetId={conversation.otherUser.id} />
    </div>
  );
};
