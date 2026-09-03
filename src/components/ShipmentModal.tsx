import React, { useState } from 'react';
import { Loader2, Truck, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_BASE_URL } from '../services/apiConfig';
import { supabase } from '../services/supabase';

interface ShipmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: string;
    onSuccess: () => void;
}

export const ShipmentModal: React.FC<ShipmentModalProps> = ({ isOpen, onClose, orderId, onSuccess }) => {
    const [carrier, setCarrier] = useState('');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_BASE_URL}/api/orders/ship`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    orderId,
                    carrier,
                    trackingNumber
                })
            });

            if (res.ok) {
                toast.success('Order marked as shipped!');
                onSuccess();
                onClose();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to update shipment');
            }
        } catch (error) {
            toast.error('Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Truck className="text-brand-600" />
                        Shipment Details
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Carrier / Courier</label>
                        <select
                            value={carrier}
                            onChange={e => setCarrier(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white"
                            required
                        >
                            <option value="">Select Carrier</option>
                            <option value="DHL">DHL</option>
                            <option value="FedEx">FedEx</option>
                            <option value="UPS">UPS</option>
                            <option value="Estafeta">Estafeta (MX)</option>
                            <option value="Correos de Mexico">Correos de Mexico</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Number</label>
                        <input
                            type="text"
                            value={trackingNumber}
                            onChange={e => setTrackingNumber(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono"
                            placeholder="e.g. 1Z9999999999999999"
                            required
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading || !carrier || !trackingNumber}
                            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Confirm Shipment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
