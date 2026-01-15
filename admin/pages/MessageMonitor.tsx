import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/adminApi';
import { AdminConversation } from '../types/admin';
import { showToast } from '../utils/toast';
import { MessageSquare, Flag, Trash2, Send, AlertCircle } from 'lucide-react';

export const MessageMonitor: React.FC = () => {
    const [conversations, setConversations] = useState<AdminConversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterDeleted, setFilterDeleted] = useState(false);
    const [selectedConv, setSelectedConv] = useState<string | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [adminMessage, setAdminMessage] = useState('');
    const [sending, setSending] = useState(false);

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
            showToast.error('加载对话失败');
        } finally {
            setLoading(false);
        }
    };

    const loadConversationDetails = async (convId: string) => {
        try {
            const res = await adminApi.getConversation(convId);
            if (res.data) {
                setMessages(res.data.messages);
                setSelectedConv(convId);
            }
        } catch (error) {
            showToast.error('加载消息失败');
        }
    };

    useEffect(() => {
        fetchConversations();
    }, [page, filterDeleted]);

    const handleDeleteConversation = async (id: string) => {
        if (confirm('确定要删除此对话吗？')) {
            try {
                await adminApi.deleteConversation(id, false);
                showToast.success('对话已删除');
                fetchConversations();
                if (selectedConv === id) {
                    setSelectedConv(null);
                    setMessages([]);
                }
            } catch (error) {
                showToast.error('删除失败');
            }
        }
    };

    const handleFlagMessage = async (msgId: string, isFlagged: boolean) => {
        const reason = isFlagged ? '' : prompt('请输入标记原因（可选）') || '';
        try {
            await adminApi.flagMessage(msgId, !isFlagged, reason);
            showToast.success(isFlagged ? '已取消标记' : '已标记为不当内容');
            if (selectedConv) {
                loadConversationDetails(selectedConv);
            }
        } catch (error) {
            showToast.error('操作失败');
        }
    };

    const handleSendAdminMessage = async () => {
        if (!adminMessage.trim()) {
            showToast.error('请输入消息内容');
            return;
        }

        if (!selectedConv) return;

        setSending(true);
        try {
            // 使用admin API发送系统消息
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://descu-production.up.railway.app'}/api/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    conversation_id: selectedConv,
                    sender_id: 'system',
                    sender_email: 'system@descu.ai',
                    text: `【系统消息】${adminMessage}`,
                }),
            });

            if (response.ok) {
                showToast.success('系统消息已发送');
                setAdminMessage('');
                loadConversationDetails(selectedConv);
            } else {
                throw new Error('发送失败');
            }
        } catch (error) {
            showToast.error('发送系统消息失败');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-gray-900">消息监控</h2>
                    <p className="text-gray-600 mt-1">查看和管理平台所有对话，支持后台介入</p>
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

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                    <h3 className="font-semibold text-blue-900">后台介入功能</h3>
                    <p className="text-sm text-blue-800 mt-1">
                        您可以在任何对话中发送系统消息，消息将以「系统消息」前缀显示给双方用户
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Conversations List */}
                <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b bg-gray-50">
                        <h3 className="font-semibold text-gray-900">对话列表</h3>
                        <p className="text-xs text-gray-500 mt-1">共 {conversations.length} 个对话</p>
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
                                        <div className="flex items-center gap-2 flex-1">
                                            <MessageSquare className="w-4 h-4 text-gray-400" />
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
                                            <Trash2 className="w-4 h-4" />
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
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border flex flex-col">
                    <div className="p-4 border-b bg-gray-50">
                        <h3 className="font-semibold text-gray-900">消息详情</h3>
                    </div>
                    <div className="flex-1 p-6 overflow-y-auto max-h-[500px]">
                        {!selectedConv ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                <MessageSquare className="w-12 h-12 mb-4" />
                                <p>选择一个对话查看消息</p>
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
                                        className={`p-4 rounded-lg border ${msg.is_flagged ? 'bg-red-50 border-red-200' :
                                            msg.sender_id === 'system' ? 'bg-yellow-50 border-yellow-200' :
                                                'bg-gray-50 border-gray-200'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-medium ${msg.sender_id === 'system' ? 'text-yellow-700' : 'text-gray-600'
                                                    }`}>
                                                    {msg.sender_id === 'system' ? '系统' : msg.sender_email?.split('@')[0]}
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
                                                <Flag className="w-4 h-4" />
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

                    {/* Admin Intervention Input */}
                    {selectedConv && (
                        <div className="p-4 border-t bg-gray-50">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={adminMessage}
                                    onChange={(e) => setAdminMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendAdminMessage()}
                                    placeholder="输入系统消息（将以「系统消息」前缀发送）..."
                                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    disabled={sending}
                                />
                                <button
                                    onClick={handleSendAdminMessage}
                                    disabled={sending || !adminMessage.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <Send className="w-4 h-4" />
                                    {sending ? '发送中...' : '发送'}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                💡 提示：系统消息将同时显示给买家和卖家
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
