import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { AlertTriangle, X, Upload } from 'lucide-react';
import { API_BASE_URL } from '../services/apiConfig';

interface DisputeModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: string;
    onSuccess: () => void;
}

export const DisputeModal: React.FC<DisputeModalProps> = ({ isOpen, onClose, orderId, onSuccess }) => {
    const [reason, setReason] = useState('not_received');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();

            const res = await fetch(`${API_BASE_URL}/api/disputes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    orderId,
                    reason,
                    description
                })
            });

            if (res.ok) {
                alert('Dispute submitted. Admin will review within 24 hours.');
                onSuccess();
                onClose();
            } else {
                throw new Error(await res.text());
            }

        } catch (error: any) {
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle />
                        <h2 className="text-xl font-bold">Report Issue</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                        <select
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2.5 bg-white"
                        >
                            <option value="not_received">Item Not Received</option>
                            <option value="not_as_described">Not as Described</option>
                            <option value="damaged">Damaged</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={4}
                            className="w-full border border-gray-300 rounded-lg p-3"
                            placeholder="Please provide details about the issue..."
                        />
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl text-xs text-blue-800 leading-relaxed">
                        Funds will be held by the platform until the dispute is resolved. Admin may contact you for further evidence.
                    </div>

                    <button
                        disabled={loading}
                        className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Submitting...' : 'Submit Dispute'}
                    </button>
                </form>
            </div>
        </div>
    );
};
