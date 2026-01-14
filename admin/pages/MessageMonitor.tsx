import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/adminApi';
import { AdminConversation } from '../types/admin';

// Icons
const SearchIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>);
const FlagIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>);
const MessageIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>);
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);

export const MessageMonitor: React.FC = () => {
    const [conversations, setConversations] = useState<AdminConversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterDeleted, setFilterDeleted] = useState(false);
    const [selectedConv, setSelectedConv] = useState<string | null>(null);
    const [messages, setMessages] = useState<any[]>([]);

    const fetchConversations = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getConversations({
                page,
                limit: 20,
                include_deleted: filterDeleted ? 'true' : 'false'
            });
            if (res.data) {
                setConversations(res.data.conversations);
                setTotalPages(res.data.pagination.totalPages);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadConversationDetails = async (convId: string) => {
        const res = await adminApi.getConversation(convId);
        if (res.data) {
            setMessages(res.data.messages);
            setSelectedConv(convId);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, [page, filterDeleted]);

    const handleDeleteConversation = async (id: string) => {
        if (confirm('确定要删除此对话吗？')) {
            await adminApi.deleteConversation(id, false);
            fetchConversations();
        }
    };

    const handleFlagMessage = async (msgId: string, isFlagged: boolean) => {
        const reason = isFlagged ? '' : prompt('请输入标记原因（可选）') || '';
        await adminApi.flagMessage(msgId, !isFlagged, reason);
        if (selectedConv) {
            loadConversationDetails(selectedConv);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">消息监控</h2>
                    <p className="text-sm text-gray-500 mt-1">查看和管理平台所有对话</p>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                        type="checkbox"
                        checked={filterDeleted}
                        onChange={(e) => setFilterDeleted(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                    />
                    显示已删除对话
                </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Conversations List */}
                <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b bg-gray-50">
                        <h3 className="font-semibold text-gray-900">对话列表</h3>
                    </div>
                    <div className="overflow-y-auto max-h-[600px] divide-y">
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="p-4 animate-pulse">
                                    <div className="h-4 w-3/4 bg-gray-200 rounded mb-2"></div>
                                    <div className="h-3 w-1/2 bg-gray-200 rounded"></div>
                                </div>
                            ))
                        ) : conversations.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                暂无对话数据
                            </div>
                        ) : (
                            conversations.map(conv => (
                                <div
                                    key={conv.id}
                                    onClick={() => loadConversationDetails(conv.id)}
                                    className={`p-4 cursor-pointer transition-colors ${selectedConv === conv.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <MessageIcon />
                                            <span className="font-medium text-sm text-gray-900 truncate">
                                                {conv.product_title || '未知商品'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteConversation(conv.id);
                                            }}
                                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                    <div className="text-xs text-gray-500 space-y-1">
                                        <div>买家: {conv.buyer_email?.split('@')[0]}</div>
                                        <div>卖家: {conv.seller_email?.split('@')[0]}</div>
                                        <div>{new Date(conv.created_at).toLocaleDateString('zh-CN')}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {totalPages > 1 && (
                        <div className="p-3 border-t bg-gray-50 flex justify-between text-sm">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-white"
                            >
                                上一页
                            </button>
                            <span className="py-1 text-gray-600">{page}/{totalPages}</span>
                            <button
                                disabled={page === totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-white"
                            >
                                下一页
                            </button>
                        </div>
                    )}
                </div>

                {/* Message Details */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border">
                    <div className="p-4 border-b bg-gray-50">
                        <h3 className="font-semibold text-gray-900">消息详情</h3>
                    </div>
                    <div className="p-6 overflow-y-auto max-h-[600px]">
                        {!selectedConv ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                <MessageIcon />
                                <p className="mt-4">选择一个对话查看消息</p>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="text-center text-gray-500 py-12">
                                此对话暂无消息
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {messages.map(msg => (
                                    <div
                                        key={msg.id}
                                        className={`p-4 rounded-lg border ${msg.is_flagged ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-gray-600">
                                                    {msg.sender_email?.split('@')[0]}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {new Date(msg.created_at).toLocaleString('zh-CN')}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleFlagMessage(msg.id, msg.is_flagged)}
                                                className={`p-1.5 rounded transition-colors ${msg.is_flagged
                                                        ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                                        : 'text-gray-400 hover:bg-gray-200'
                                                    }`}
                                                title={msg.is_flagged ? '取消标记' : '标记为不当内容'}
                                            >
                                                <FlagIcon />
                                            </button>
                                        </div>
                                        <p className="text-gray-900 text-sm">{msg.content}</p>
                                        {msg.is_flagged && msg.flag_reason && (
                                            <div className="mt-2 text-xs text-red-700">
                                                标记原因: {msg.flag_reason}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
