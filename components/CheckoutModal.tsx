import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    PaymentElement,
    Elements,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js';
import { X, Lock, CreditCard } from 'lucide-react';
import { Product, User } from '../types';
import { API_BASE_URL } from '../services/apiConfig';
import { GlassToast } from './GlassToast';

// Replace with your publishable key
const stripePromise = loadStripe('pk_test_placeholder_key_replace_me');

interface CheckoutFormProps {
    product: Product;
    clientSecret: string;
    onSuccess: () => void;
    onCancel: () => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ product, onSuccess, onCancel }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsProcessing(true);

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Return URL where the user is redirected after the payment
                return_url: `${window.location.origin}/payment-success`,
            },
            redirect: "if_required", // Prevent redirect if not 3DS
        });

        if (error) {
            setErrorMessage(error.message || 'Payment failed');
            setIsProcessing(false);
        } else {
            // Payment succeeded
            onSuccess();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-xl mb-4">
                <h3 className="font-bold text-gray-800 mb-2">Order Summary</h3>
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{product.title}</span>
                    <span className="font-medium">${product.price} {product.currency}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Platform Fee</span>
                    <span className="font-medium">$0.00</span>
                </div>
                <div className="border-t border-gray-200 my-2"></div>
                <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>${product.price} {product.currency}</span>
                </div>
            </div>

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
                        Pay Now ${product.price}
                    </>
                )}
            </button>

            <div className="text-center">
                <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-sm">Cancel Payment</button>
            </div>
        </form>
    );
};

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    user: User;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, product, user }) => {
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);

    // Initial load to get clientSecret
    React.useEffect(() => {
        if (isOpen && product && user) {
            setIsLoading(true);
            setInitError(null);

            fetch(`${API_BASE_URL}/api/payment/create-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: product.id, buyerId: user.id }),
            })
                .then(async (res) => {
                    if (!res.ok) throw new Error(await res.text());
                    return res.json();
                })
                .then((data) => {
                    setClientSecret(data.clientSecret);
                    setIsLoading(false);
                })
                .catch((err) => {
                    console.error("Payment init error", err);
                    setInitError("Failed to initialize payment. Please try again.");
                    setIsLoading(false);
                });
        }
    }, [isOpen, product, user]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2 text-brand-600">
                        <div className="bg-brand-50 p-2 rounded-full">
                            <CreditCard size={20} />
                        </div>
                        <h2 className="text-xl font-black">Secure Checkout</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4 text-gray-400">
                        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                        <p className="text-sm font-medium">Preparing secure payment...</p>
                    </div>
                ) : initError ? (
                    <div className="text-center py-8">
                        <div className="text-red-500 mb-2 font-bold">Error</div>
                        <p className="text-gray-600 text-sm mb-4">{initError}</p>
                        <button onClick={onClose} className="text-brand-600 font-bold hover:underline">Close</button>
                    </div>
                ) : clientSecret ? (
                    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                        <CheckoutForm
                            product={product}
                            clientSecret={clientSecret}
                            onSuccess={() => {
                                alert('Payment Successful! (Using mock success handling for now)');
                                onClose();
                            }}
                            onCancel={onClose}
                        />
                    </Elements>
                ) : null}
            </div>
        </div>
    );
};
