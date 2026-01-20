
import React, { useState, useMemo } from 'react';
import { Conversation, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { MessageCircle, Clock, ChevronRight, Package, ShoppingBag, CheckCircle, MessageSquare } from 'lucide-react';

interface ChatListProps {
  conversations: Conversation[];
  currentUser: User;
  onSelectConversation: (id: string) => void;
}

type TabType = 'all' | 'active' | 'inquiry' | 'completed';

export const ChatList: React.FC<ChatListProps> = ({
  conversations,
  currentUser,
  onSelectConversation
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // 分类对话
  const categorizedConversations = useMemo(() => {
    return conversations.map(conv => {
      // 判断对话类型（这里需要根据实际订单状态来判断）
      // 暂时通过消息数量和内容来简单分类
      const hasMessages = conv.messages && conv.messages.length > 0;

      // 检查是否有议价或订单相关消息
      const hasOrderActivity = conv.messages?.some(m =>
        m.text?.includes('议价') ||
        m.text?.includes('订单') ||
        m.text?.includes('Oferta') ||
        m.text?.includes('order')
      );

      // 检查是否有完成相关消息
      const isCompleted = conv.messages?.some(m =>
        m.text?.includes('完成') ||
        m.text?.includes('已接受') ||
        m.text?.includes('confirmed') ||
        m.text?.includes('completed')
      );

      let category: 'all' | 'active' | 'inquiry' | 'completed' = 'inquiry';

      if (isCompleted) {
        category = 'completed';
      } else if (hasOrderActivity) {
        // 有订单活动的归类为进行中
        category = 'active';
      } else if (!hasMessages || conv.messages.length === 0) {
        // 无消息的归类为咨询
        category = 'inquiry';
      }

      return { ...conv, category };
    });
  }, [conversations]);

  // 根据标签筛选
  const filteredConversations = useMemo(() => {
    let filtered = categorizedConversations;

    if (activeTab !== 'all') {
      filtered = categorizedConversations.filter(conv => conv.category === activeTab);
    }

    // 按最后消息时间排序
    return filtered.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
  }, [categorizedConversations, activeTab]);

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
          {conversations.length} 对话
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

      {/* 对话列表 */}
      <div className="grid gap-3">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">此分类暂无对话</p>
          </div>
        ) : (
          filteredConversations.map((conv, idx) => {
            const lastMsg = conv.messages?.[conv.messages.length - 1];
            const unreadCount = conv.messages?.filter(m => !m.isRead && m.senderId !== currentUser.id).length || 0;

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className="group relative flex items-center gap-4 bg-white p-4 rounded-2xl cursor-pointer hover:shadow-md transition-all duration-300 border border-gray-100 active:scale-[0.99]"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* 状态指示条 */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${(conv as any).category === 'active' ? 'bg-blue-500' :
                  (conv as any).category === 'completed' ? 'bg-green-500' :
                    'bg-orange-400'
                  }`} />

                {/* Avatar Section */}
                <div className="relative flex-shrink-0 ml-2">
                  <img
                    src={conv.otherUser.avatar}
                    alt={conv.otherUser.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-100"
                  />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full ring-2 ring-white">
                      {unreadCount}
                    </span>
                  )}
                </div>

                {/* Content Section */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-bold text-gray-900 text-sm truncate pr-2 group-hover:text-brand-600 transition-colors">
                      {conv.otherUser.name}
                    </h3>
                    <span className="text-[10px] font-medium text-gray-400 flex-shrink-0">
                      {lastMsg ? new Date(lastMsg.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  </div>

                  <p className={`text-xs truncate leading-relaxed mb-2 ${unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                    {lastMsg?.senderId === currentUser.id && <span className="text-gray-400 font-normal mr-1">{t('chat.you')}:</span>}
                    {lastMsg?.text || t('chat.no_msgs')}
                  </p>

                  {/* Product Tag */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                      <img
                        src={conv.productImage || 'https://via.placeholder.com/40'}
                        className="w-5 h-5 rounded object-cover"
                        alt=""
                      />
                      <span className="text-[10px] font-medium text-gray-600 truncate max-w-[100px]">
                        {conv.productTitle || '商品'}
                      </span>
                    </div>

                    {/* 状态标签 */}
                    {(conv as any).category === 'active' && (
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                        交易中
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-500 transition-colors" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
