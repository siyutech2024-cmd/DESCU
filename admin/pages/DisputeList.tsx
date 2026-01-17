import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { AlertCircle, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { judgeDisputeWithGemini } from '../../services/geminiService';

const DisputeList = () => {
    const [disputes, setDisputes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDisputes();
    }, []);

    const fetchDisputes = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/disputes`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setDisputes(data.disputes || []);
            } else {
                console.error("Failed to fetch disputes:", data);
            }
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

        const token = localStorage.getItem('adminToken');
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/disputes/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    disputeId,
                    action,
                    adminNote: note
                })
            });

            if (res.ok) {
                alert('裁决成功 (Resolved)');
                fetchDisputes();
            } else {
                const err = await res.json();
                alert(`失败: ${err.error}`);
            }
        } catch (e) {
            console.error(e);
            alert('网络错误');
        }
    };

    const handleAiJudge = async (dispute: any) => {
        const toastId = alert('AI is analyzing... (Check console/wait for popup)');

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

    if (loading) return <div>Loading...</div>;

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Dispute Management</h1>
            <div className="space-y-4">
                {disputes.map(d => (
                    <div key={d.id} className="bg-white p-4 rounded-lg shadow border border-gray-200">
                        <div className="flex justify-between">
                            <div>
                                <h3 className="font-bold">Dispute #{d.id.slice(0, 8)}</h3>
                                <p className="text-sm text-gray-500">Reason: {d.reason}</p>
                                <p className="text-sm">Status: <span className="font-bold">{d.status}</span></p>
                                {d.status === 'open' && (
                                    <button
                                        onClick={() => handleAiJudge(d)}
                                        className="text-xs text-purple-600 flex items-center gap-1 mt-1 hover:underline"
                                    >
                                        <Sparkles size={12} /> AI Suggestion
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {d.status === 'open' && (
                                    <>
                                        <button
                                            onClick={() => handleResolve(d.id, 'refund')}
                                            className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                        >
                                            Refund Buyer
                                        </button>
                                        <button
                                            onClick={() => handleResolve(d.id, 'release')}
                                            className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
                                        >
                                            Release to Seller
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DisputeList;
