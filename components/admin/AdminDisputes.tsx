import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../services/apiConfig';
import { supabase } from '../../services/supabase';
import { Loader2, MessageCircle, Check, X, ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const AdminDisputes: React.FC = () => {
    const [disputes, setDisputes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
    const [resolveNote, setResolveNote] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        fetchDisputes();
    }, []);

    const fetchDisputes = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_BASE_URL}/api/admin/disputes?status=open`, {
                headers: { Authorization: `Bearer ${session?.access_token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDisputes(data.disputes);
            }
        } catch (error) {
            console.error('Failed to fetch disputes', error);
            toast.error('Failed to load disputes');
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (action: 'refund' | 'release') => {
        if (!selectedDisputeId) return;
        if (!resolveNote.trim()) {
            toast.error('Please add a note explaining the decision');
            return;
        }
        if (!confirm(`Confirm action: ${action.toUpperCase()}?`)) return;

        setIsProcessing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_BASE_URL}/api/admin/disputes/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    disputeId: selectedDisputeId,
                    action,
                    adminNote: resolveNote
                })
            });

            if (res.ok) {
                toast.success(`Dispute resolved: ${action}`);
                setSelectedDisputeId(null);
                setResolveNote('');
                fetchDisputes();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Resolution failed');
            }
        } catch (error) {
            toast.error('Network error');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <ShieldAlert className="text-red-500" />
                Dispute Resolution
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* List */}
                <div className="lg:col-span-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[600px]">
                    <div className="p-4 border-b border-gray-100 font-medium text-gray-600 bg-gray-50">
                        Open Disputes ({disputes.length})
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-brand-500" /></div>
                        ) : disputes.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">No open disputes</div>
                        ) : (
                            disputes.map(d => (
                                <div
                                    key={d.id}
                                    onClick={() => setSelectedDisputeId(d.id)}
                                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${selectedDisputeId === d.id ? 'bg-brand-50 border-l-4 border-l-brand-500' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-medium text-gray-900 truncate">Order #{d.order_id.slice(0, 8)}</span>
                                        <span className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 line-clamp-2">{d.reason}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Detail & Action */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    {selectedDisputeId ? (
                        (() => {
                            const dispute = disputes.find(d => d.id === selectedDisputeId);
                            if (!dispute) return null;
                            return (
                                <div className="h-full flex flex-col">
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">Dispute Details</h3>
                                            <p className="text-sm text-gray-500">ID: {dispute.id}</p>
                                        </div>

                                        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                                            <h4 className="font-bold text-red-800 text-sm mb-1">Reason for Dispute</h4>
                                            <p className="text-gray-800">{dispute.reason}</p>
                                            {dispute.description && <p className="text-gray-600 text-sm mt-2">{dispute.description}</p>}
                                        </div>

                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                            <h4 className="font-bold text-gray-800 text-sm mb-2">Order Context</h4>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Amount:</span>
                                                    <div className="font-mono">${dispute.order.total_amount} {dispute.order.currency}</div>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Status:</span>
                                                    <div className="capitalize">{dispute.order.status}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Decision Note</label>
                                            <textarea
                                                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                                rows={4}
                                                placeholder="Explain your decision..."
                                                value={resolveNote}
                                                onChange={e => setResolveNote(e.target.value)}
                                            ></textarea>
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-100 pt-6 mt-6 flex justify-end gap-4">
                                        <button
                                            onClick={() => handleResolve('release')}
                                            disabled={isProcessing}
                                            className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                                            Release to Seller
                                        </button>
                                        <button
                                            onClick={() => handleResolve('refund')}
                                            disabled={isProcessing}
                                            className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <X size={18} />}
                                            Refund Buyer
                                        </button>
                                    </div>
                                </div>
                            );
                        })()
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <MessageCircle size={48} className="mb-4 opacity-50" />
                            <p>Select a dispute to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
