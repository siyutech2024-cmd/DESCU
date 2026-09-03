import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import { judgeDisputeWithGemini } from '../../services/geminiService';
import { api, ApiError } from '@/lib/api/client';

const DisputeList = () => {
    const [disputes, setDisputes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDisputes();
    }, []);

    const fetchDisputes = async () => {
        try {
            const data = await api.get<{ disputes?: any[] }>('/api/admin/disputes', { auth: 'required' });
            setDisputes(data.disputes || []);
        } catch (error) {
            console.error("Error fetching disputes:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (disputeId: string, action: 'refund' | 'release') => {
        const actionText = action === 'refund' ? '退款给买家 (Refund)' : '放款给卖家 (Release)';
        if (!confirm(`确定要 ${actionText}?`)) return;

        const note = prompt('请输入裁决备注 (Admin Note):', '人工裁决');
        if (note === null) return; // Cancelled

        try {
            try {
                await api.post('/api/admin/disputes/resolve', { disputeId, action, adminNote: note }, { auth: 'required' });
                alert('裁决成功 (Resolved)');
                fetchDisputes();
            } catch (err) {
                if (!(err instanceof ApiError)) throw err;
                alert(`失败: ${err.message}`);
            }
        } catch (e) {
            console.error(e);
            alert('网络错误');
        }
    };

    const handleAiJudge = async (dispute: any) => {
        alert('AI is analyzing... (Check console/wait for popup)');

        const verdict = await judgeDisputeWithGemini({
            reason: dispute.reason,
            description: dispute.description
        });

        if (verdict) {
            const msg = `🤖 AI Suggestion:\n\nVerdict: ${verdict.verdict}\nReason: ${verdict.reasoning}\nConfidence: ${(verdict.confidence * 100).toFixed(0)}%\n\nApply this verdict?`;
            if (confirm(msg)) {
                if (verdict.verdict.includes('Refund')) handleResolve(dispute.id, 'refund');
                else if (verdict.verdict.includes('Release')) handleResolve(dispute.id, 'release');
            }
        } else {
            alert('AI could not determine a verdict.');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg shadow-red-200">
                        <AlertCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800">交易纠纷</h1>
                        <p className="text-sm text-gray-500 font-medium">管理买卖双方纠纷</p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-yellow-100 shadow-sm">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-1">待处理</div>
                    <div className="text-2xl font-black text-yellow-600">
                        {disputes.filter(d => d.status === 'open').length}
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-green-100 shadow-sm">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-1">已解决</div>
                    <div className="text-2xl font-black text-green-600">
                        {disputes.filter(d => d.status !== 'open').length}
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-1">总计</div>
                    <div className="text-2xl font-black text-gray-800">{disputes.length}</div>
                </div>
            </div>

            {/* Disputes List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {disputes.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">暂无纠纷</h3>
                        <p className="text-sm text-gray-500">当用户发起交易纠纷时，将在此处显示</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {disputes.map(d => (
                            <div key={d.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-bold text-gray-800">纠纷 #{d.id.slice(0, 8)}</h3>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${d.status === 'open'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-green-100 text-green-800'
                                                }`}>
                                                {d.status === 'open' ? '待处理' : '已解决'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">
                                            <span className="font-medium">原因：</span>{d.reason}
                                        </p>
                                        {d.description && (
                                            <p className="text-sm text-gray-500 mb-2 line-clamp-2">{d.description}</p>
                                        )}
                                        <p className="text-xs text-gray-400">
                                            创建时间：{new Date(d.created_at).toLocaleString()}
                                        </p>
                                        {d.status === 'open' && (
                                            <button
                                                onClick={() => handleAiJudge(d)}
                                                className="mt-3 text-xs text-purple-600 flex items-center gap-1 hover:underline bg-purple-50 px-3 py-1.5 rounded-full"
                                            >
                                                <Sparkles size={14} /> AI智能分析
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        {d.status === 'open' && (
                                            <>
                                                <button
                                                    onClick={() => handleResolve(d.id, 'refund')}
                                                    className="px-4 py-2 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 font-medium text-sm transition-colors"
                                                >
                                                    退款给买家
                                                </button>
                                                <button
                                                    onClick={() => handleResolve(d.id, 'release')}
                                                    className="px-4 py-2 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 font-medium text-sm transition-colors"
                                                >
                                                    放款给卖家
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DisputeList;
