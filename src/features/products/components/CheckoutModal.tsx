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
import { X, Lock, MapPin, Truck, ArrowLeft, CheckCircle, Banknote } from 'lucide-react';
import { Product, User } from '@/types';
import { api, ApiError } from '@/lib/api/client';
import { supabase } from '@/services/supabase';
import { createOrGetConversation } from '@/services/chatService';
import { useLanguage } from '@/i18n';
import { useRegion } from '@/contexts/RegionContext';
import { AddressList } from './AddressList';
import { previewOrderAmounts } from '@/lib/pricing';
import { Sheet } from '@/components/ui/Sheet';

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
                try {
                    await api.post('/api/stripe/confirm-payment', { orderId, paymentIntentId: paymentIntent.id }, { auth: 'optional' });
                } catch (e) {
                    // Old code never checked response.ok, so a non-2xx still counted as success
                    if (!(e instanceof ApiError)) throw e;
                    console.error("Backend confirmation returned an error", e);
                }
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
    const { t } = useLanguage();
    const { formatCurrency } = useRegion();
    const [step, setStep] = useState<Step>('type-selection');
    const [orderType, setOrderType] = useState<OrderType>('meetup');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [shippingAddress, setShippingAddress] = useState<any>(null); // Changed to hold full address object
    const [isLoading, setIsLoading] = useState(false);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [createdOrder, setCreatedOrder] = useState<any>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setStep('type-selection');
            setOrderType('meetup');
            setPaymentMethod('cash');
            setClientSecret(null);
            setCreatedOrder(null);
            setConversationId(null);
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

            let data: { order: any; requiresPayment?: boolean; conversationId?: string | null };
            try {
                data = await api.post<{ order: any; requiresPayment?: boolean; conversationId?: string | null }>('/api/orders/create', payload, { auth: 'required' });
            } catch (apiErr) {
                if (!(apiErr instanceof ApiError)) throw apiErr;
                const err: any = apiErr.body ?? {};
                console.error("Order creation failed:", err);
                // Throw the detailed message from backend if available
                throw new Error(err.message || err.error || 'Failed to create order');
            }

            setCreatedOrder(data.order);

            // The server creates (or reuses) the buyer↔seller conversation and posts the
            // "order created" card itself; we only need the id to open the chat afterwards.
            if (data.conversationId) {
                setConversationId(data.conversationId);
            } else {
                try {
                    const conversation = await createOrGetConversation(product.id, session.user.id, product.seller.id);
                    const convId = conversation.id || conversation.conversation?.id;
                    if (convId) setConversationId(convId);
                } catch (convErr) {
                    console.error('[Checkout] Failed to open conversation:', convErr);
                }
            }

            if (data.requiresPayment && payload.paymentMethod === 'online') {
                // Now create Payment Intent
                let piData: { clientSecret: string };
                try {
                    piData = await api.post<{ clientSecret: string }>('/api/stripe/create-payment-intent', { orderId: data.order.id }, { auth: 'required' });
                } catch (piErr) {
                    if (!(piErr instanceof ApiError)) throw piErr;
                    throw new Error("Failed to init payment");
                }
                setClientSecret(piData.clientSecret);
                setStep('payment');
            } else {
                // Cash order or no payment required
                setStep('success');
                toast.success(t('checkout.success'));
            }

        } catch (error: any) {
            console.error(error);
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const productCurrency = product.currency || 'MXN';

    const renderStepContent = () => {
        switch (step) {
            case 'type-selection':
                // Filter options based on product.deliveryType
                const showMeetup = product.deliveryType === 'meetup' || product.deliveryType === 'both';
                const showShipping = product.deliveryType === 'shipping' || product.deliveryType === 'both';

                return (
                    <div className="space-y-4">
                        <h3 id="checkout-modal-title" className="text-lg font-bold text-gray-800 mb-4">{t('checkout.select_method')}</h3>

                        {showMeetup && (
                            <button
                                onClick={() => { setOrderType('meetup'); setPaymentMethod('cash'); setStep('details'); }}
                                className="w-full flex items-center p-4 border-2 border-gray-100 rounded-xl hover:border-brand-500 hover:bg-brand-50 transition-all group text-left"
                            >
                                <div className="bg-gray-100 p-3 rounded-full group-hover:bg-brand-200 transition-colors mr-4">
                                    <MapPin className="text-gray-600 group-hover:text-brand-700" size={24} />
                                </div>
                                <div>
                                    <div className="font-bold text-gray-800">{t('checkout.meetup_title')}</div>
                                    <div className="text-sm text-gray-500">{t('checkout.meetup_desc')}</div>
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
                                    <div className="font-bold text-gray-800">{t('checkout.shipping_title')}</div>
                                    <div className="text-sm text-gray-500">{t('checkout.shipping_desc')}</div>
                                </div>
                            </button>
                        )}

                        {!showMeetup && !showShipping && (
                            <div className="text-red-500 text-center">{t('checkout.no_methods')}</div>
                        )}
                    </div>
                );

            case 'details':
                // Shipping orders are always paid online (same rule as handleCreateOrder)
                const { shippingFee, platformFee, total } = previewOrderAmounts(product.price, orderType, orderType === 'shipping' ? 'online' : paymentMethod);

                const isButtonDisabled = isLoading || (orderType === 'shipping' && !shippingAddress?.id);

                return (
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <button onClick={() => setStep('type-selection')} className="p-1 hover:bg-gray-100 rounded-full">
                                <ArrowLeft size={20} />
                            </button>
                            <h3 id="checkout-modal-title" className="text-lg font-bold">{t('checkout.review')}</h3>
                        </div>

                        {/* Order Type Badge */}
                        <div className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded-lg w-fit">
                            {orderType === 'meetup' ? <MapPin size={16} /> : <Truck size={16} />}
                            <span className="font-medium">{orderType === 'meetup' ? t('checkout.meetup_title') : t('checkout.shipping_title')}</span>
                        </div>

                        {/* Payment Method Badge for Meetup (read-only, cash only) */}
                        {orderType === 'meetup' && (
                            <div className="flex items-center gap-2 text-sm bg-green-50 border border-green-200 p-3 rounded-xl">
                                <Banknote size={18} className="text-green-600" />
                                <span className="font-bold text-green-700">{t('checkout.payment_cash')}</span>
                            </div>
                        )}

                        {/* Shipping Address Selection */}
                        {orderType === 'shipping' && (
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-700">{t('checkout.address')}</label>
                                <div className="border border-gray-100 rounded-xl p-2 bg-gray-50/50">
                                    <AddressList
                                        selectable
                                        selectedId={shippingAddress?.id}
                                        onSelect={(addr: any) => setShippingAddress(addr)}
                                    />
                                </div>
                                {!shippingAddress?.id && (
                                    <p className="text-xs text-red-500 font-bold bg-red-50 p-2 rounded">
                                        {t('checkout.address_required')}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Summary */}
                        <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">{t('checkout.product')}</span>
                                <span>{formatCurrency(product.price, productCurrency)}</span>
                            </div>
                            {shippingFee > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">{t('checkout.shipping_fee')}</span>
                                    <span>{formatCurrency(shippingFee, productCurrency)}</span>
                                </div>
                            )}
                            {platformFee > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">{t('checkout.platform_fee')}</span>
                                    <span>{formatCurrency(platformFee, productCurrency)}</span>
                                </div>
                            )}
                            <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
                                <span>{t('checkout.total')}</span>
                                <span>{formatCurrency(total, productCurrency)}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <button
                                onClick={handleCreateOrder}
                                disabled={isButtonDisabled}
                                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading ? <span className="animate-spin">⌛</span> : (
                                    paymentMethod === 'online' ? t('checkout.pay_now') : t('checkout.confirm')
                                )}
                            </button>
                            {orderType === 'shipping' && !shippingAddress?.id && (
                                <p className="text-center text-xs text-red-500">{t('checkout.address_hint')}</p>
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
                            <h3 id="checkout-modal-title" className="text-lg font-bold">{t('checkout.secure_payment')}</h3>
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
                        <h3 id="checkout-modal-title" className="text-2xl font-bold text-gray-800">{t('checkout.success')}</h3>
                        <p className="text-gray-600">
                            {orderType === 'meetup'
                                ? t('checkout.meetup_success')
                                : t('checkout.shipping_success')}
                        </p>
                        <div className="space-y-3 pt-2">
                            {/* 主按钮：跳转到与卖家的聊天 */}
                            <button
                                onClick={() => {
                                    onClose();
                                    if (conversationId) {
                                        navigate(`/chat/${conversationId}`);
                                    } else {
                                        navigate('/chat');
                                    }
                                }}
                                className="w-full bg-brand-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all"
                            >
                                {t('checkout.chat_seller')}
                            </button>
                            {/* 次按钮：查看订单列表 */}
                            <button
                                onClick={() => { onClose(); navigate('/orders?role=buyer'); }}
                                className="w-full bg-gray-100 text-gray-700 px-8 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all"
                            >
                                {t('checkout.go_orders')}
                            </button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <Sheet
            open={isOpen}
            onClose={onClose}
            variant="bottom"
            size="md"
            dismissible={!isLoading}
            labelledBy="checkout-modal-title"
            bodyClassName="p-6"
        >
            <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                aria-label={t('modal.close')}
                className="absolute top-4 right-4 z-raised p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-40"
            >
                <X size={20} />
            </button>
            {renderStepContent()}
        </Sheet>
    );
}
