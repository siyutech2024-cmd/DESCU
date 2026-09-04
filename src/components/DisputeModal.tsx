import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { Sheet } from './ui/Sheet';

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
            await api.post('/api/disputes', {
                orderId,
                reason,
                description
            }, { auth: 'optional' });

            alert('Dispute submitted. Admin will review within 24 hours.');
            onSuccess();
            onClose();

        } catch (error: any) {
            // Old code surfaced the raw response body text for non-2xx responses
            const message = error instanceof ApiError
                ? (error.body === undefined ? '' : typeof error.body === 'string' ? error.body : JSON.stringify(error.body))
                : error.message;
            alert(`Error: ${message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Sheet
            open={isOpen}
            onClose={onClose}
            size="md"
            title={
                <span className="flex items-center gap-2 text-red-600">
                    <AlertTriangle />
                    Report Issue
                </span>
            }
        >
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
        </Sheet>
    );
};
