import React, { useState } from 'react';
import {
    Clock,
    CheckCircle,
    MapPin,
    Truck,
    AlertCircle,
    ChevronRight,
    MessageCircle,
    User as UserIcon,
    Package
} from 'lucide-react';
import { Order, User } from '../types';
import { API_BASE_URL } from '../services/apiConfig';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';
import { MeetupArrangementModal } from './MeetupArrangementModal';

interface OrderStatusCardProps {
    order: Order;
    currentUser: User;
    onStatusChange?: () => void;
    className?: string;
}

export const OrderStatusCard: React.FC<OrderStatusCardProps> = ({ order, currentUser, onStatusChange, className = '' }) => {
    const isBuyer = currentUser.id === order.buyer_id;
    const isSeller = currentUser.id === order.seller_id;
    const [isLoading, setIsLoading] = useState(false);
    const [isMeetupModalOpen, setIsMeetupModalOpen] = useState(false);

    // HOTFIX: Support both 'product' and 'products' field names
    // API should return 'product' but due to deployment delays, it might still return 'products'
    const productData = (order as any).product || (order as any).products || null;

    const handleConfirm = async () => {
        if (!confirm('Are you sure you want to confirm completion? This action cannot be undone.')) return;

        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_BASE_URL}/api/orders/${order.id}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

            if (!res.ok) throw new Error('Failed to confirm');

            toast.success('Confirmed successfully!');
            onStatusChange?.();
        } catch (error) {
            console.error(error);
            toast.error('Operation failed');
        } finally {
            setIsLoading(false);
        }
    };

    const StatusBadge = () => {
        const styles = {
            pending_payment: 'bg-yellow-100 text-yellow-700',
            paid: 'bg-blue-100 text-blue-700',
            meetup_arranged: 'bg-purple-100 text-purple-700',
            shipped: 'bg-indigo-100 text-indigo-700',
            delivered: 'bg-teal-100 text-teal-700',
            completed: 'bg-green-100 text-green-700',
            cancelled: 'bg-gray-100 text-gray-700',
            disputed: 'bg-red-100 text-red-700',
            refunded: 'bg-gray-100 text-gray-500 line-through',
        };

        const labels = {
            pending_payment: 'Awaiting Payment',
            paid: 'Paid',
            meetup_arranged: 'Meetup Arranged',
            shipped: 'Shipped',
            delivered: 'Delivered',
            completed: 'Completed',
            cancelled: 'Cancelled',
            disputed: 'Disputed',
            refunded: 'Refunded',
        };

        return (
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${styles[order.status] || 'bg-gray-100'}`}>
                {labels[order.status] || order.status}
            </span>
        );
    };

    // Determine content based on status
    const renderContent = () => {
        // 1. Completion/Confirmation State (Highest Priority if active)
        if (order.status === 'meetup_arranged' || order.status === 'delivered' || order.status === 'paid' || order.status === 'shipped') {
            const myConfirmation = isBuyer ? order.buyer_confirmed_at : order.seller_confirmed_at;
            const otherConfirmation = isBuyer ? order.seller_confirmed_at : order.buyer_confirmed_at;
            const otherRoleLabel = isBuyer ? 'Seller' : 'Buyer';

            // Removed unreachable 'completed' check

            return (
                <div className="mt-4 bg-white/50 rounded-xl p-4 border border-brand-100">
                    <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <CheckCircle size={18} className="text-brand-600" />
                        Completion Status
                    </h4>

                    <div className="space-y-3">
                        {/* My Status */}
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">You ({isBuyer ? 'Buyer' : 'Seller'})</span>
                            {myConfirmation ? (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                                    <CheckCircle size={12} /> Confirmed
                                </span>
                            ) : (
                                <button
                                    onClick={handleConfirm}
                                    disabled={isLoading}
                                    className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-brand-700 transition-colors shadow-sm"
                                >
                                    {isLoading ? '...' : `Confirm ${order.order_type === 'meetup' ? 'Meetup' : 'Receipt'}`}
                                </button>
                            )}
                        </div>

                        {/* Other Party Status */}
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{otherRoleLabel}</span>
                            {otherConfirmation ? (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                                    <CheckCircle size={12} /> Confirmed
                                </span>
                            ) : (
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg font-medium flex items-center gap-1">
                                    <Clock size={12} /> Waiting
                                </span>
                            )}
                        </div>
                    </div>

                    {!myConfirmation && (
                        <p className="text-xs text-brand-600 mt-2 bg-brand-50 p-2 rounded-lg">
                            Please confirm only after you have {isBuyer ? 'received the item' : 'delivered the item'} and are satisfied.
                        </p>
                    )}
                </div>
            );
        }

        // 2. Meetup Details
        if (order.order_type === 'meetup') {
            const hasDetails = !!order.meetup_location;

            return (
                <>
                    <div className="mt-4 bg-white/50 rounded-xl p-4 border border-blue-100">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                                    <MapPin size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm">Meetup Details</h4>
                                    {hasDetails ? (
                                        <>
                                            <p className="text-sm text-gray-600 mt-1">{order.meetup_location}</p>
                                            {order.meetup_time && (
                                                <p className="text-xs text-blue-600 font-bold mt-1 bg-blue-50 w-fit px-2 py-1 rounded">
                                                    {new Date(order.meetup_time).toLocaleString()}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-gray-500 mt-1 italic">Not arranged yet</p>
                                    )}
                                </div>
                            </div>

                            {/* Only allow arranging if not completed/cancelled */}
                            {!['completed', 'cancelled', 'refunded'].includes(order.status) && (
                                <button
                                    onClick={() => setIsMeetupModalOpen(true)}
                                    className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
                                >
                                    {hasDetails ? 'Update' : 'Arrange'}
                                </button>
                            )}
                        </div>
                    </div>
                    <MeetupArrangementModal
                        isOpen={isMeetupModalOpen}
                        onClose={() => setIsMeetupModalOpen(false)}
                        order={order}
                        onSuccess={() => onStatusChange?.()}
                    />
                </>
            );
        }

        return null;
    };

    return (
        <div className={`glass-card p-5 rounded-2xl ${className}`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Order #{order.id.slice(0, 8)}</div>
                    <div className="flex items-center gap-2">
                        <StatusBadge />
                        <span className="text-xs font-bold text-gray-500 capitalize px-2 py-0.5 bg-white rounded-full border border-gray-100">
                            {order.order_type}
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-black text-lg text-gray-900">
                        ${(order.total_amount || 0).toFixed(2)} {order.currency}
                    </div>
                    <div className="text-xs text-gray-400">
                        {order.payment_method === 'cash' ? 'Pay Cash' : 'Paid Online'}
                    </div>
                </div>
            </div>

            {/* Product Snapshot - Always show something even if product data is missing */}
            <div
                className="flex items-center gap-4 p-3 bg-gray-50/80 rounded-xl mb-4 cursor-pointer hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200 group/product"
                onClick={() => window.location.href = `/products/${order.product_id}`}
            >
                <div className="w-16 h-16 rounded-lg bg-white overflow-hidden flex-shrink-0 border border-gray-200 shadow-sm flex items-center justify-center">
                    {productData?.images?.[0] ? (
                        <img src={productData.images[0]} className="w-full h-full object-cover group-hover/product:scale-105 transition-transform duration-500" />
                    ) : (
                        <Package size={28} className="text-gray-300" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 truncate text-base mb-1">
                        {productData?.title || <span className="text-gray-400 italic">Product information unavailable</span>}
                    </div>
                    <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
                        {productData?.price && <span className="bg-white px-2 py-0.5 rounded border border-gray-100 shadow-sm font-medium text-gray-700">${productData.price}</span>}
                        <span className="bg-white px-2 py-0.5 rounded border border-gray-100 shadow-sm text-gray-500">
                            ID: {order.product_id.slice(0, 8)}
                        </span>
                    </div>
                </div>
                <ChevronRight size={20} className="text-gray-300 group-hover/product:text-gray-600 transition-colors" />
            </div>

            {/* Status Content */}
            {renderContent()}

            {/* Hint / Footer */}
            {order.status === 'completed' && (
                <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-xl text-sm font-medium">
                    <CheckCircle size={16} />
                    Transaction completed successfully.
                </div>
            )}
        </div>
    );
};
