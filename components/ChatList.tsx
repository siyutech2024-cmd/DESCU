
import React, { useState, useMemo, useRef } from 'react';
import { Conversation, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { MessageCircle, Clock, ChevronRight, ChevronDown, Package, ShoppingBag, CheckCircle, MessageSquare, Users, Trash2, EyeOff, X } from 'lucide-react';

interface ChatListProps {
  conversations: Conversation[];
  currentUser: User;
  onSelectConversation: (id: string) => void;
}

type TabType = 'all' | 'active' | 'inquiry' | 'completed';

// 按产品分组的对话类型
interface ProductGroup {
  productId: string;
  productTitle: string;
  productImage: string;
  conversations: (Conversation & { category: string })[];
  totalUnread: number;
  latestMessageTime: number;
}

export const ChatList: React.FC<ChatListProps> = ({
  conversations,
  currentUser,
  onSelectConversation
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [hiddenConversations, setHiddenConversations] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ convId: string; x: number; y: number } | null>(null);

  // iOS 滑动删除状态
  const [swipedConvId, setSwipedConvId] = useState<string | null>(null);
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);

  // 分类对话
  const categorizedConversations = useMemo(() => {
    return conversations.map(conv => {
      const hasOrder = !!(conv as any).orderId || !!(conv as any).order_id;
      const orderStatus = (conv as any).orderStatus || (conv as any).order_status;

      let category: 'all' | 'active' | 'inquiry' | 'completed' = 'inquiry';

      if (orderStatus === 'completed' || orderStatus === 'confirmed' || orderStatus === 'delivered') {
        category = 'completed';
      } else if (hasOrder || orderStatus) {
        category = 'active';
      } else {
        category = 'inquiry';
      }

      return { ...conv, category };
    });
  }, [conversations]);

  // 根据标签筛选（排除隐藏的对话）
  const filteredConversations = useMemo(() => {
    let filtered = categorizedConversations.filter(conv => !hiddenConversations.has(conv.id));

    if (activeTab !== 'all') {
      filtered = filtered.filter(conv => conv.category === activeTab);
    }

    return filtered.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
  }, [categorizedConversations, activeTab, hiddenConversations]);

  // 按产品分组
  const productGroups = useMemo(() => {
    const groups: Map<string, ProductGroup> = new Map();

    filteredConversations.forEach(conv => {
      const productId = conv.productId || 'unknown';
      const existing = groups.get(productId);

      const unreadCount = conv.messages?.filter(m => !m.isRead && m.senderId !== currentUser.id).length || 0;
      const latestTime = conv.lastMessageTime || 0;

      if (existing) {
        existing.conversations.push(conv);
        existing.totalUnread += unreadCount;
        existing.latestMessageTime = Math.max(existing.latestMessageTime, latestTime);
      } else {
        groups.set(productId, {
          productId,
          productTitle: conv.productTitle || '商品',
          productImage: conv.productImage || 'https://via.placeholder.com/40',
          conversations: [conv],
          totalUnread: unreadCount,
          latestMessageTime: latestTime
        });
      }
    });

    // 按最新消息时间排序
    return Array.from(groups.values()).sort((a, b) => b.latestMessageTime - a.latestMessageTime);
  }, [filteredConversations, currentUser.id]);

  // 统计各分类数量
  const counts = useMemo(() => ({
    all: conversations.length,
    active: categorizedConversations.filter(c => c.category === 'active').length,
    inquiry: categorizedConversations.filter(c => c.category === 'inquiry').length,
    completed: categorizedConversations.filter(c => c.category === 'completed').length,
  }), [conversations, categorizedConversations]);

  const tabs: { key: TabType; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'all', label: '全部', icon: <MessageCircle size={14} />, color: 'brand' },
    { key: 'active', label: '进行中', icon: <ShoppingBag size={14} />, color: 'blue' },
    { key: 'inquiry', label: '咨询中', icon: <MessageSquare size={14} />, color: 'orange' },
    { key: 'completed', label: '已完成', icon: <CheckCircle size={14} />, color: 'green' },
  ];

  const toggleProductExpand = (productId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // 隐藏对话
  const handleHideConversation = (convId: string) => {
    setHiddenConversations(prev => new Set(prev).add(convId));
    setContextMenu(null);
  };

  // 显示右键/长按菜单
  const handleContextMenu = (e: React.MouseEvent | React.TouchEvent, convId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setContextMenu({ convId, x: rect.left, y: rect.bottom });
  };

  // iOS 滑动手势处理
  const handleTouchStart = (e: React.TouchEvent, convId: string) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent, convId: string) => {
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchCurrentX.current;
    // 左滑超过 50px 则显示操作按钮
    if (diff > 50) {
      setSwipedConvId(convId);
    } else if (diff < -30) {
      // 右滑复位
      setSwipedConvId(null);
    }
  };

  const handleTouchEnd = () => {
    // 触摸结束时检查是否需要保持滑动状态
    const diff = touchStartX.current - touchCurrentX.current;
    if (diff < 50) {
      setSwipedConvId(null);
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 p-8 animate-fade-in">
        <div className="w-24 h-24 bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
          <MessageCircle size={40} className="opacity-20 text-gray-600" />
        </div>
        <p className="font-bold text-lg text-gray-500">{t('chat.empty_inbox')}</p>
        <p className="text-sm text-gray-400 mt-2">Start a conversation from a product page</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4 animate-fade-in-up pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('chat.inbox')}</h1>
        <div className="bg-brand-50 text-brand-700 px-3 py-1 rounded-full text-xs font-bold">
          {conversations.length} {t('chat.conversations') || '对话'}
        </div>
      </div>

      {/* 分类标签 */}
      <div className="flex gap-2 overflow-x-auto pb-2 px-2 -mx-2 scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 ${activeTab === tab.key
              ? `bg-${tab.color}-100 text-${tab.color}-700 shadow-sm`
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            style={{
              backgroundColor: activeTab === tab.key
                ? tab.color === 'brand' ? '#fce7f3'
                  : tab.color === 'blue' ? '#dbeafe'
                    : tab.color === 'orange' ? '#ffedd5'
                      : '#dcfce7'
                : undefined,
              color: activeTab === tab.key
                ? tab.color === 'brand' ? '#be185d'
                  : tab.color === 'blue' ? '#1d4ed8'
                    : tab.color === 'orange' ? '#c2410c'
                      : '#166534'
                : undefined
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {counts[tab.key] > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === tab.key ? 'bg-white/50' : 'bg-gray-200'
                }`}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 按产品分组的对话列表 */}
      <div className="grid gap-3">
        {productGroups.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">此分类暂无对话</p>
          </div>
        ) : (
          productGroups.map((group, groupIdx) => {
            const isExpanded = expandedProducts.has(group.productId);
            const buyerCount = group.conversations.length;

            return (
              <div key={group.productId} className="animate-fade-in" style={{ animationDelay: `${groupIdx * 50}ms` }}>
                {/* 产品卡片头部 */}
                <div
                  onClick={() => toggleProductExpand(group.productId)}
                  className={`group flex items-center gap-3 bg-white p-4 rounded-2xl cursor-pointer hover:shadow-md transition-all duration-300 border ${isExpanded ? 'border-brand-200 shadow-sm' : 'border-gray-100'}`}
                >
                  {/* 产品图片 */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={group.productImage}
                      alt={group.productTitle}
                      className="w-14 h-14 rounded-xl object-cover border border-gray-100"
                    />
                    {group.totalUnread > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full ring-2 ring-white">
                        {group.totalUnread}
                      </span>
                    )}
                  </div>

                  {/* 产品信息 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm truncate group-hover:text-brand-600 transition-colors">
                      {group.productTitle}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Users size={12} />
                        <span>{buyerCount} {buyerCount > 1 ? '位买家' : '位买家'}</span>
                      </div>
                      <span className="text-gray-300">•</span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(group.latestMessageTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* 展开/折叠图标 */}
                  <div className={`p-2 rounded-full transition-all ${isExpanded ? 'bg-brand-50 text-brand-600' : 'bg-gray-50 text-gray-400'}`}>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </div>

                {/* 展开的买家列表 */}
                {isExpanded && (
                  <div className="mt-1 ml-2 pl-2 border-l-2 border-brand-100 space-y-2">
                    {group.conversations.map((conv, idx) => {
                      const lastMsg = conv.messages?.[conv.messages.length - 1];
                      const unreadCount = conv.messages?.filter(m => !m.isRead && m.senderId !== currentUser.id).length || 0;

                      return (
                        <div key={conv.id} className="relative overflow-hidden rounded-xl">
                          {/* 滑动操作按钮背景 - z-0 在底层 */}
                          <div className="absolute right-0 top-0 bottom-0 flex items-stretch z-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHideConversation(conv.id);
                              }}
                              className="w-14 bg-gray-500 text-white flex flex-col items-center justify-center gap-0.5"
                            >
                              <EyeOff size={16} />
                              <span className="text-[9px] font-bold">隐藏</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('确定删除此对话？')) {
                                  handleHideConversation(conv.id);
                                }
                              }}
                              className="w-14 bg-red-500 text-white flex flex-col items-center justify-center gap-0.5"
                            >
                              <Trash2 size={16} />
                              <span className="text-[9px] font-bold">删除</span>
                            </button>
                          </div>

                          {/* 对话卡片主体 - z-10 覆盖按钮 */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!contextMenu && swipedConvId !== conv.id) onSelectConversation(conv.id);
                              if (swipedConvId === conv.id) setSwipedConvId(null);
                            }}
                            onTouchStart={(e) => handleTouchStart(e, conv.id)}
                            onTouchMove={(e) => handleTouchMove(e, conv.id)}
                            onTouchEnd={handleTouchEnd}
                            onContextMenu={(e) => handleContextMenu(e, conv.id)}
                            className={`group relative z-10 w-full flex items-center gap-3 bg-gray-50 hover:bg-white p-3 cursor-pointer hover:shadow-sm transition-transform duration-200 border border-transparent hover:border-gray-100 ${swipedConvId === conv.id ? '-translate-x-28' : 'translate-x-0'
                              }`}
                            style={{ animationDelay: `${idx * 30}ms` }}
                          >
                            {/* 状态指示条 */}
                            <div className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${conv.category === 'active' ? 'bg-blue-500' :
                              conv.category === 'completed' ? 'bg-green-500' :
                                'bg-orange-400'
                              }`} />

                            {/* 买家头像 */}
                            <div className="relative flex-shrink-0 ml-2">
                              <img
                                src={conv.otherUser.avatar}
                                alt={conv.otherUser.name}
                                className="w-10 h-10 rounded-full object-cover border-2 border-white"
                              />
                              {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full ring-2 ring-gray-50">
                                  {unreadCount}
                                </span>
                              )}
                            </div>

                            {/* 买家信息 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-0.5">
                                <h4 className="font-semibold text-gray-800 text-sm truncate pr-2 group-hover:text-brand-600 transition-colors">
                                  {conv.otherUser.name}
                                </h4>
                                <span className="text-[10px] font-medium text-gray-400 flex-shrink-0">
                                  {lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              </div>

                              <p className={`text-xs truncate leading-relaxed ${unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                                {lastMsg?.senderId === currentUser.id && <span className="text-gray-400 font-normal mr-1">{t('chat.you')}:</span>}
                                {lastMsg?.text || t('chat.no_msgs')}
                              </p>
                            </div>

                            {/* 状态标签 */}
                            {conv.category === 'active' && (
                              <span className="text-[9px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full flex-shrink-0">
                                交易中
                              </span>
                            )}

                            <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-500 transition-colors flex-shrink-0" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 上下文菜单 */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-2 w-48 animate-fade-in"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => handleHideConversation(contextMenu.convId)}
              className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
              <EyeOff size={16} className="text-gray-400" />
              隐藏对话 / Hide
            </button>
            <button
              onClick={() => {
                if (window.confirm('确定删除此对话？此操作不可撤销。\nDelete this chat? This cannot be undone.')) {
                  handleHideConversation(contextMenu.convId);
                }
              }}
              className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-3"
            >
              <Trash2 size={16} />
              删除对话 / Delete
            </button>
          </div>
        </>
      )}

      {/* 隐藏的对话恢复提示 */}
      {hiddenConversations.size > 0 && (
        <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 animate-fade-in-up">
          <button
            onClick={() => setHiddenConversations(new Set())}
            className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            <EyeOff size={14} />
            {hiddenConversations.size} 个对话已隐藏
            <X size={14} className="opacity-60" />
          </button>
        </div>
      )}
    </div>
  );
};
