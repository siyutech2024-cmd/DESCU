import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loadStripe } from '@stripe/stripe-js';
import {
    PaymentElement,
    Elements,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js';
import { X, Lock, CreditCard, MapPin, Truck, Wallet, ArrowLeft, CheckCircle } from 'lucide-react';
import { Product, User } from '../types';
import { API_BASE_URL } from '../services/apiConfig';
// import { GlassToast } from './GlassToast'; // Removed unused import if not needed, or keep if used globally
import { supabase } from '../services/supabase';
import { AddressList } from './AddressList';

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_live_51Sq0FTQ21K2ZcCkTeSAIFszExSoxuA6L5qGSn20wjF1MIyYECOM2O8zZU0YSTFVCQs8RAMiuTeLyyWmr4wv4gtkL00eEWCifnz';
const stripePromise = loadStripe(STRIPE_KEY);

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    user: User;
}

type OrderType = 'meetup' | 'shipping';
type PaymentMethod = 'online' | 'cash';
type Step = 'type-selection' | 'details' | 'payment' | 'success';

const CheckoutForm: React.FC<{
    product: Product;
    orderId: string;
    clientSecret: string;
    onSuccess: () => void;
    onCancel: () => void;
}> = ({ product, orderId, clientSecret, onSuccess, onCancel }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) return;

        setIsProcessing(true);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/payment-success`, // Ideally not used with redirect: if_required
            },
            redirect: "if_required",
        });

        if (error) {
            setErrorMessage(error.message || 'Payment failed');
            setIsProcessing(false);
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            // Confirm with backend
            try {
                const { data: { session } } = await supabase.auth.getSession();
                await fetch(`${API_BASE_URL}/api/stripe/confirm-payment`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: JSON.stringify({ orderId, paymentIntentId: paymentIntent.id })
                });
                onSuccess();
            } catch (e) {
                console.error("Backend confirmation failed", e);
                setErrorMessage("Payment successful but verification failed. Please contact support.");
                setIsProcessing(false);
            }
        } else {
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement />
            {errorMessage && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg flex items-center gap-2">
                    <X size={14} /> {errorMessage}
                </div>
            )}
            <button
                disabled={!stripe || isProcessing}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
                {isProcessing ? (
                    <span className="animate-pulse">Processing...</span>
                ) : (
                    <>
                        <Lock size={18} />
                        Pay Now
                    </>
                )}
            </button>
            <button type="button" onClick={onCancel} className="w-full text-center text-gray-500 text-sm hover:text-gray-700">Cancel</button>
        </form>
    );
};

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, product, user }) => {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('type-selection');
    const [orderType, setOrderType] = useState<OrderType>('meetup');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');
    const [shippingAddress, setShippingAddress] = useState<any>(null); // Changed to hold full address object
    const [isLoading, setIsLoading] = useState(false);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [createdOrder, setCreatedOrder] = useState<any>(null);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setStep('type-selection');
            setOrderType('meetup');
            setPaymentMethod('online');
            setClientSecret(null);
            setCreatedOrder(null);
            setIsLoading(false);
        }
    }, [isOpen]);

    const handleCreateOrder = async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Auth required");

            const payload: any = {
                productId: product.id,
                orderType,
                paymentMethod: orderType === 'shipping' ? 'online' : paymentMethod,
            };

            if (orderType === 'shipping') {
                payload.shippingAddress = shippingAddress;
            }

            const res = await fetch(`${API_BASE_URL}/api/orders/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create order');
            }

            const data = await res.json();
            setCreatedOrder(data.order);

            if (data.requiresPayment && payload.paymentMethod === 'online') {
                // Now create Payment Intent
                const piRes = await fetch(`${API_BASE_URL}/api/stripe/create-payment-intent`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ orderId: data.order.id })
                });

                if (!piRes.ok) throw new Error("Failed to init payment");
                const piData = await piRes.json();
                setClientSecret(piData.clientSecret);
                setStep('payment');
            } else {
                // Cash order or no payment required immediatley
                setStep('success');
                toast.success('Order created successfully!');
            }

        } catch (error: any) {
            console.error(error);
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const renderStepContent = () => {
        switch (step) {
            case 'type-selection':
                // Filter options based on product.deliveryType
                const showMeetup = product.deliveryType === 'meetup' || product.deliveryType === 'both';
                const showShipping = product.deliveryType === 'shipping' || product.deliveryType === 'both';

                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">How do you want to verify this deal?</h3>

                        {showMeetup && (
                            <button
                                onClick={() => { setOrderType('meetup'); setStep('details'); }}
                                className="w-full flex items-center p-4 border-2 border-gray-100 rounded-xl hover:border-brand-500 hover:bg-brand-50 transition-all group text-left"
                            >
                                <div className="bg-gray-100 p-3 rounded-full group-hover:bg-brand-200 transition-colors mr-4">
                                    <MapPin className="text-gray-600 group-hover:text-brand-700" size={24} />
                                </div>
                                <div>
                                    <div className="font-bold text-gray-800">In-Person Meetup</div>
                                    <div className="text-sm text-gray-500">Meet locally. Pay Cash or Online.</div>
                                </div>
                            </button>
                        )}

                        {showShipping && (
                            <button
                                onClick={() => { setOrderType('shipping'); setPaymentMethod('online'); setStep('details'); }}
                                className="w-full flex items-center p-4 border-2 border-gray-100 rounded-xl hover:border-brand-500 hover:bg-brand-50 transition-all group text-left"
                            >
                                <div className="bg-gray-100 p-3 rounded-full group-hover:bg-brand-200 transition-colors mr-4">
                                    <Truck className="text-gray-600 group-hover:text-brand-700" size={24} />
                                </div>
                                <div>
                                    <div className="font-bold text-gray-800">Shipping</div>
                                    <div className="text-sm text-gray-500">Delivered to you. Secure Online Payment.</div>
                                </div>
                            </button>
                        )}

                        {!showMeetup && !showShipping && (
                            <div className="text-red-500 text-center">No delivery methods available for this product.</div>
                        )}
                    </div>
                );

            case 'details':
                const shippingFee = orderType === 'shipping' ? 50 : 0;
                const platformFee = paymentMethod === 'online' ? (product.price * 0.03) : 0;
                const total = product.price + shippingFee + platformFee;

                const isButtonDisabled = isLoading || (orderType === 'shipping' && !shippingAddress?.id);

                return (
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <button onClick={() => setStep('type-selection')} className="p-1 hover:bg-gray-100 rounded-full">
                                <ArrowLeft size={20} />
                            </button>
                            <h3 className="text-lg font-bold">Review Order</h3>
                        </div>

                        {/* Order Type Badge */}
                        <div className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded-lg w-fit">
                            {orderType === 'meetup' ? <MapPin size={16} /> : <Truck size={16} />}
                            <span className="capitalize font-medium">{orderType}</span>
                        </div>

                        {/* Payment Method Selection (Only for Meetup) */}
                        {orderType === 'meetup' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setPaymentMethod('online')}
                                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'online' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 hover:border-brand-200'}`}
                                    >
                                        <Lock size={20} />
                                        <span className="text-sm font-bold">Secure Online</span>
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'cash' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 hover:border-green-200'}`}
                                    >
                                        <Wallet size={20} />
                                        <span className="text-sm font-bold">Cash</span>
                                    </button>
                                </div>
                                {paymentMethod === 'online' && <p className="text-xs text-gray-500 mt-1">Funds held in escrow until you verify item.</p>}
                            </div>
                        )}

                        {/* Shipping Address Selection */}
                        {orderType === 'shipping' && (
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-700">Shipping Address</label>
                                <div className="max-h-[200px] overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50/50">
                                    <AddressList
                                        selectable
                                        selectedId={shippingAddress?.id}
                                        onSelect={(addr: any) => setShippingAddress(addr)} // any cast for simplicity as Address type is local to List or we export it
                                    />
                                </div>
                                {!shippingAddress?.id && (
                                    <p className="text-xs text-red-500 font-bold bg-red-50 p-2 rounded">
                                        Please select or add a shipping address to proceed.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Summary */}
                        <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Product</span>
                                <span>${product.price.toFixed(2)}</span>
                            </div>
                            {shippingFee > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Shipping</span>
                                    <span>${shippingFee.toFixed(2)}</span>
                                </div>
                            )}
                            {platformFee > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Protection Verify Fee (3%)</span>
                                    <span>${platformFee.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
                                <span>Total</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <button
                                onClick={handleCreateOrder}
                                disabled={isButtonDisabled}
                                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading ? <span className="animate-spin">⌛</span> : (
                                    paymentMethod === 'online' ? 'Proceed to Pay' : 'Confirm Order'
                                )}
                            </button>
                            {orderType === 'shipping' && !shippingAddress?.id && (
                                <p className="text-center text-xs text-red-500">Address selection required</p>
                            )}
                        </div>
                    </div>
                );

            case 'payment':
                return (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <button onClick={() => setStep('details')} className="p-1 hover:bg-gray-100 rounded-full">
                                <ArrowLeft size={20} />
                            </button>
                            <h3 className="text-lg font-bold">Secure Payment</h3>
                        </div>
                        {clientSecret && createdOrder && (
                            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                                <CheckoutForm
                                    product={product}
                                    orderId={createdOrder.id}
                                    clientSecret={clientSecret}
                                    onSuccess={() => setStep('success')}
                                    onCancel={() => setStep('details')}
                                />
                            </Elements>
                        )}
                    </div>
                );

            case 'success':
                return (
                    <div className="text-center py-8 space-y-4">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle size={48} />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800">Order Placed!</h3>
                        <p className="text-gray-600">
                            {orderType === 'meetup'
                                ? "You can now arrange the meetup details with the seller."
                                : "The seller has been notified to ship your item."}
                        </p>
                        <button onClick={() => { onClose(); navigate('/profile?tab=buying'); }} className="bg-brand-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-brand-200">
                            Go to Orders
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="absolute top-4 right-4 z-10">
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                        <X size={20} />
                    </button>
                </div>
                {renderStepContent()}
            </div>
        </div>
    );
}
