import React, { useState, useMemo, useRef } from 'react';
import { Conversation, ConversationLastMessage, User } from '@/types';
import { useLanguage, useLocale } from '@/i18n';
import { deleteConversation } from '@/services/chatService';
import { MessageCircle, ChevronRight, ChevronDown, Package, ShoppingBag, CheckCircle, MessageSquare, Users, Trash2, EyeOff, X } from 'lucide-react';
import { ConfirmSheet } from '@/components/ui/Sheet';
import { Chip, EmptyState, type ChipTone } from '@/components/ui/primitives';
import { orderStatusLabel, orderStatusTone } from '@/features/orders/orderStatusLabel';

interface ChatListProps {
  conversations: Conversation[];
  currentUser: User;
  onSelectConversation: (id: string) => void;
  /** Highlighted row (desktop two-pane layout). */
  selectedId?: string;
  /** Narrow sidebar rendering (desktop two-pane layout). */
  compact?: boolean;
}

type TabType = 'all' | 'active' | 'inquiry' | 'completed';
type Categorized = Conversation & { category: Exclude<TabType, 'all'> };

interface ProductGroup {
  productId: string;
  productTitle: string;
  productImage: string;
  conversations: Categorized[];
  totalUnread: number;
  latestMessageTime: number;
}

const COMPLETED_ORDER_STATUSES = new Set(['completed', 'completed_pending_payout']);
const CLOSED_ORDER_STATUSES = new Set(['cancelled', 'refunded']);

/**
 * Bucket a conversation by its newest order:
 *  - completed: order finished (payout may still be pending)
 *  - active:    an order exists and is neither finished nor cancelled/refunded
 *  - inquiry:   no order yet, or the order fell through
 */
const categorizeConversation = (conv: Conversation): Exclude<TabType, 'all'> => {
  const status = conv.orderStatus;
  if (!status) return 'inquiry';
  if (COMPLETED_ORDER_STATUSES.has(status)) return 'completed';
  if (CLOSED_ORDER_STATUSES.has(status)) return 'inquiry';
  return 'active';
};

/** Preview label for the last message (rich message types get a short i18n placeholder). */
const previewText = (msg: ConversationLastMessage, t: (key: string) => string): string => {
  switch (msg.messageType) {
    case 'image':
    case 'images':
      return t('chat.preview.image');
    case 'location':
      return t('chat.preview.location');
    case 'price_negotiation':
    case 'price_negotiation_response':
      return t('chat.preview.offer');
    case 'order_status':
      return t('chat.preview.order_update');
    case 'meetup_time':
    case 'meetup':
      return t('chat.preview.meetup');
    default:
      return msg.text || t('chat.no_msgs');
  }
};

/** "14:05" today, "lun" this week, "4 sep" otherwise. */
const shortTime = (ms: number, locale: string): string => {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (now.getTime() - ms < 6 * 86400000) return d.toLocaleDateString(locale, { weekday: 'short' });
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
};

const CATEGORY_TONE: Record<Exclude<TabType, 'all'>, ChipTone> = { active: 'info', completed: 'success', inquiry: 'neutral' };

export const ChatList: React.FC<ChatListProps> = ({ conversations, currentUser, onSelectConversation, selectedId, compact = false }) => {
  const { t } = useLanguage();
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [hiddenConversations, setHiddenConversations] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('descu_hidden_chats');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [contextMenu, setContextMenu] = useState<{ convId: string; x: number; y: number } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletedConversations, setDeletedConversations] = useState<Set<string>>(new Set());

  // Swipe-to-reveal (touch) — only the conversation rows
  const [swipedConvId, setSwipedConvId] = useState<string | null>(null);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);

  const categorized = useMemo<Categorized[]>(() => conversations.map(conv => ({ ...conv, category: categorizeConversation(conv) })), [conversations]);

  const filtered = useMemo(() => {
    const list = categorized.filter(conv => !hiddenConversations.has(conv.id) && !deletedConversations.has(conv.id) && (activeTab === 'all' || conv.category === activeTab));
    return list.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
  }, [categorized, activeTab, hiddenConversations, deletedConversations]);

  // One row per product; products with several buyers expand into their conversations.
  const groups = useMemo(() => {
    const map = new Map<string, ProductGroup>();
    for (const conv of filtered) {
      const productId = conv.productId || 'unknown';
      const g = map.get(productId);
      if (g) {
        g.conversations.push(conv);
        g.totalUnread += conv.unreadCount ?? 0;
        g.latestMessageTime = Math.max(g.latestMessageTime, conv.lastMessageTime || 0);
      } else {
        map.set(productId, {
          productId,
          productTitle: conv.productTitle || t('chat.unknown_product'),
          productImage: conv.productImage || '',
          conversations: [conv],
          totalUnread: conv.unreadCount ?? 0,
          latestMessageTime: conv.lastMessageTime || 0,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.latestMessageTime - a.latestMessageTime);
  }, [filtered, t]);

  const counts = useMemo(() => ({
    all: conversations.length,
    active: categorized.filter(c => c.category === 'active').length,
    inquiry: categorized.filter(c => c.category === 'inquiry').length,
    completed: categorized.filter(c => c.category === 'completed').length,
  }), [conversations, categorized]);

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: t('chat.tab.all'), icon: <MessageCircle size={14} /> },
    { key: 'active', label: t('chat.tab.active'), icon: <ShoppingBag size={14} /> },
    { key: 'inquiry', label: t('chat.tab.inquiring'), icon: <MessageSquare size={14} /> },
    { key: 'completed', label: t('chat.tab.completed'), icon: <CheckCircle size={14} /> },
  ];

  const toggleGroup = (productId: string) => setExpandedProducts(prev => {
    const next = new Set(prev);
    if (next.has(productId)) next.delete(productId); else next.add(productId);
    return next;
  });

  const hideConversation = (convId: string) => {
    setHiddenConversations(prev => {
      const next = new Set(prev).add(convId);
      try { localStorage.setItem('descu_hidden_chats', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
    setContextMenu(null);
    setSwipedConvId(null);
  };

  const removeConversation = async (convId: string) => {
    try {
      await deleteConversation(convId, currentUser.id);
      setDeletedConversations(prev => new Set(prev).add(convId));
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    } finally {
      setContextMenu(null);
      setSwipedConvId(null);
    }
  };

  const onContextMenu = (e: React.MouseEvent, convId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ convId, x: Math.min(e.clientX, window.innerWidth - 220), y: e.clientY });
  };
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = touchCurrentX.current = e.touches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent, convId: string) => {
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchCurrentX.current;
    if (diff > 50) setSwipedConvId(convId);
    else if (diff < -30) setSwipedConvId(null);
  };
  const onTouchEnd = () => { if (touchStartX.current - touchCurrentX.current < 50) setSwipedConvId(null); };

  if (conversations.length === 0) {
    return <EmptyState icon={<MessageCircle size={28} />} title={t('chat.empty_inbox')} hint={t('chat.empty_inbox_hint')} className="min-h-[60vh]" />;
  }

  /** One conversation row (the whole product row when the product has a single buyer). */
  const renderConversation = (conv: Categorized, opts: { nested: boolean; group: ProductGroup }) => {
    const lastMsg = conv.lastMessage;
    const unread = conv.unreadCount ?? 0;
    const selected = conv.id === selectedId;
    const swiped = swipedConvId === conv.id;
    return (
      <div key={conv.id} className={`relative overflow-hidden ${opts.nested ? 'rounded-xl' : 'rounded-2xl'}`}>
        {/* swipe actions (mounted only while revealed, so the card corners stay clean) */}
        {swiped && <div className="absolute inset-y-0 right-0 flex items-stretch">
          <button type="button" onClick={e => { e.stopPropagation(); hideConversation(conv.id); }} className="w-16 bg-gray-500 text-white flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold">
            <EyeOff size={16} />{t('chat.hide')}
          </button>
          <button type="button" onClick={e => { e.stopPropagation(); setConfirmDeleteId(conv.id); setSwipedConvId(null); }} className="w-16 bg-red-500 text-white flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold">
            <Trash2 size={16} />{t('chat.delete')}
          </button>
        </div>}

        <div
          role="button"
          tabIndex={0}
          aria-current={selected ? 'true' : undefined}
          onClick={() => { if (swiped) { setSwipedConvId(null); return; } if (!contextMenu) onSelectConversation(conv.id); }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectConversation(conv.id); } }}
          onContextMenu={e => onContextMenu(e, conv.id)}
          onTouchStart={onTouchStart}
          onTouchMove={e => onTouchMove(e, conv.id)}
          onTouchEnd={onTouchEnd}
          className={`relative flex items-center gap-3 p-3 cursor-pointer transition-[transform,background-color,box-shadow] duration-200 border focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200
            ${opts.nested ? 'rounded-xl bg-white' : 'rounded-2xl bg-white shadow-sm hover:shadow-md'}
            ${selected ? 'border-brand-300 bg-brand-50/60' : 'border-gray-100 hover:border-brand-100'}`}
          style={{ transform: swiped ? 'translateX(-128px)' : 'translateX(0)' }}
        >
          {/* product thumb with buyer avatar overlapped */}
          <div className="relative flex-shrink-0">
            {opts.nested ? (
              <img src={conv.otherUser.avatar} alt="" className="w-11 h-11 rounded-full object-cover bg-gray-100" />
            ) : (
              <>
                <img src={opts.group.productImage || undefined} alt="" className="w-14 h-14 rounded-xl object-cover bg-gray-100 border border-gray-100" />
                <img src={conv.otherUser.avatar} alt="" className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full object-cover bg-gray-100 ring-2 ring-white" />
              </>
            )}
            {unread > 0 && (
              <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">{unread}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className={`text-sm truncate ${unread > 0 ? 'font-black text-gray-900' : 'font-bold text-gray-900'}`}>
                {opts.nested ? conv.otherUser.name : opts.group.productTitle}
              </p>
              <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">{shortTime(lastMsg ? lastMsg.createdAt : conv.lastMessageTime, locale)}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <p className={`text-xs truncate ${unread > 0 ? 'text-gray-800 font-semibold' : 'text-gray-500'}`}>
                {!opts.nested && <span className="font-bold text-gray-600">{conv.otherUser.name} · </span>}
                {lastMsg?.senderId === currentUser.id && <span className="text-gray-400">{t('chat.you')}: </span>}
                {lastMsg ? previewText(lastMsg, t) : t('chat.no_msgs')}
              </p>
              {conv.category !== 'inquiry' && !compact && (
                <Chip tone={conv.orderStatus ? orderStatusTone(conv.orderStatus) : CATEGORY_TONE[conv.category]} className="flex-shrink-0 !py-0.5 !text-[10px]">
                  {orderStatusLabel(conv.orderStatus, t) || t('chat.trading')}
                </Chip>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`${compact ? 'px-3 py-4' : 'max-w-3xl mx-auto px-4 py-6'} space-y-4 animate-fade-in`}>
      <div className="flex items-center justify-between px-1">
        <h1 className={`${compact ? 'text-xl' : 'text-2xl'} font-black text-gray-900 tracking-tight`}>{t('chat.inbox')}</h1>
        {!compact && <Chip tone="brand">{conversations.length} {t('chat.conversations')}</Chip>}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar" role="tablist">
        {tabs.map(tab => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors border ${active ? 'bg-brand-600 text-white border-brand-600 shadow-sm shadow-brand-500/25' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-200 hover:text-brand-700'}`}
            >
              {tab.icon}
              {!compact && <span>{tab.label}</span>}
              {counts[tab.key] > 0 && <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${active ? 'bg-white/25' : 'bg-gray-100 text-gray-500'}`}>{counts[tab.key]}</span>}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {groups.length === 0 ? (
          <EmptyState icon={<Package size={26} />} title={t('chat.no_chats_in_tab')} />
        ) : groups.map(group => {
          if (group.conversations.length === 1) return renderConversation(group.conversations[0], { nested: false, group });
          const expanded = expandedProducts.has(group.productId) || group.conversations.some(c => c.id === selectedId);
          return (
            <div key={group.productId} className="space-y-1.5">
              <button
                type="button"
                onClick={() => toggleGroup(group.productId)}
                aria-expanded={expanded}
                className={`w-full flex items-center gap-3 rounded-2xl bg-white p-3 text-left border shadow-sm transition-colors hover:border-brand-100 ${expanded ? 'border-brand-200' : 'border-gray-100'}`}
              >
                <div className="relative flex-shrink-0">
                  <img src={group.productImage || undefined} alt="" className="w-14 h-14 rounded-xl object-cover bg-gray-100 border border-gray-100" />
                  {group.totalUnread > 0 && <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">{group.totalUnread}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{group.productTitle}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500"><Users size={12} />{group.conversations.length} {t('chat.buyers')}<span className="text-gray-300">·</span>{shortTime(group.latestMessageTime, locale)}</p>
                </div>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${expanded ? 'bg-brand-50 text-brand-600' : 'bg-gray-50 text-gray-400'}`}>
                  {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </span>
              </button>
              {expanded && (
                <div className="ml-4 pl-3 border-l-2 border-brand-100 space-y-1.5">
                  {group.conversations.map(conv => renderConversation(conv, { nested: true, group }))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-overlay" onClick={() => setContextMenu(null)} onContextMenu={e => { e.preventDefault(); setContextMenu(null); }} />
          <div className="fixed z-overlay w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1 animate-scale-in" style={{ left: contextMenu.x, top: contextMenu.y }} role="menu">
            <button type="button" role="menuitem" onClick={() => hideConversation(contextMenu.convId)} className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50">
              <EyeOff size={16} className="text-gray-400" />{t('chat.hide_conversation')}
            </button>
            <button type="button" role="menuitem" onClick={() => { setConfirmDeleteId(contextMenu.convId); setContextMenu(null); }} className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
              <Trash2 size={16} />{t('chat.delete_conversation')}
            </button>
          </div>
        </>
      )}

      <ConfirmSheet
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => { if (confirmDeleteId) removeConversation(confirmDeleteId); setConfirmDeleteId(null); }}
        title={t('chat.delete_conversation')}
        description={t('chat.delete_confirm')}
        confirmLabel={t('chat.delete')}
        cancelLabel={t('chat.cancel')}
        destructive
        icon={<Trash2 size={20} />}
      />

      {hiddenConversations.size > 0 && (
        <div className="fixed bottom-nav-offset mb-2 md:bottom-6 md:mb-0 left-1/2 -translate-x-1/2 z-sticky animate-fade-in-up">
          <button type="button" onClick={() => { setHiddenConversations(new Set()); try { localStorage.removeItem('descu_hidden_chats'); } catch { /* ignore */ } }} className="flex items-center gap-2 bg-gray-900 text-white px-4 h-10 rounded-full shadow-lg text-sm font-bold hover:bg-gray-800 transition-colors">
            <EyeOff size={14} />{hiddenConversations.size} {t('chat.hidden_count')}<X size={14} className="opacity-60" />
          </button>
        </div>
      )}
    </div>
  );
};
