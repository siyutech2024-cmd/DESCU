import React, { useState } from 'react';
import { Loader2, Truck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api, ApiError } from '@/lib/api/client';
import { Sheet } from './ui/Sheet';

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
            await api.post('/api/orders/ship', {
                orderId,
                carrier,
                trackingNumber
            }, { auth: 'optional' });

            toast.success('Order marked as shipped!');
            onSuccess();
            onClose();
        } catch (error) {
            if (error instanceof ApiError) {
                const err = error.body as any;
                toast.error(err?.error || 'Failed to update shipment');
            } else {
                toast.error('Network error');
            }
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
                <span className="flex items-center gap-2 text-gray-800">
                    <Truck className="text-brand-600" />
                    Shipment Details
                </span>
            }
        >
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
        </Sheet>
    );
};
