import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    CardElement,
    Elements,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js';
import { X, CreditCard, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../services/apiConfig';
import { supabase } from '../services/supabase';

// Initialize Stripe (Replace with your Publishable Key)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

interface PayoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    email: string;
    onSuccess: () => void;
}

const PayoutForm = ({ userId, email, onSuccess, onClose }: { userId: string, email: string, onSuccess: () => void, onClose: () => void }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'create_account' | 'add_card' | 'success'>('create_account');

    // 1. Create Connect Account (if needed)
    const handleCreateAccount = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch(`${API_BASE_URL}/api/payment/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userId, email }),
            });

            const data = await response.json();

            if (data.error) throw new Error(data.error);

            // Successfully created or retrieved account
            // Now move to add card step
            setStep('add_card');
        } catch (err: any) {
            setError(err.message || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    // 2. Add Card (Tokenize & Attach)
    const handleAddCard = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!stripe || !elements) return;

        setLoading(true);
        setError(null);

        try {
            // A. Create Token from Element
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) return;

            const { token, error: stripeError } = await stripe.createToken(cardElement, {
                currency: 'mxn',
                name: email
            });

            if (stripeError) {
                throw stripeError;
            }

            // B. Send Token to Backend
            const { data: { session } } = await supabase.auth.getSession();
            const authToken = session?.access_token;

            const response = await fetch(`${API_BASE_URL}/api/payment/payout-method`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ token: token.id }),
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setStep('success');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);

        } catch (err: any) {
            setError(err.message || 'Failed to add card');
        } finally {
            setLoading(false);
        }
    };

    if (step === 'success') {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center text-green-600">
                <CheckCircle size={48} className="mb-4" />
                <h3 className="text-xl font-bold">Card Added Successfully!</h3>
                <p className="text-sm text-gray-500 mt-2">You can now receive payouts.</p>
            </div>
        );
    }

    if (step === 'create_account') {
        return (
            <div className="text-center py-6">
                <div className="bg-brand-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CreditCard size={32} className="text-brand-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Setup Payouts</h3>
                <p className="text-gray-500 mb-6 text-sm px-4">
                    To receive payments, we need to set up a secure seller account for you.
                </p>
                <button
                    onClick={handleCreateAccount}
                    disabled={loading}
                    className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin" /> : 'Get Started'}
                </button>
                {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2 justify-center">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}
            </div>
        );
    }

    // Add Card Step
    return (
        <form onSubmit={handleAddCard} className="py-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Debit Card</h3>
            <p className="text-sm text-gray-500 mb-6">
                Enter your debit card details. Verify this is a valid card for receiving funds (MXN).
            </p>

            <div className="p-4 border border-gray-200 rounded-xl mb-6 focus-within:ring-2 focus-within:ring-brand-500 transition-all">
                <CardElement options={{
                    style: {
                        base: {
                            fontSize: '16px',
                            color: '#424770',
                            '::placeholder': {
                                color: '#aab7c4',
                            },
                        },
                        invalid: {
                            color: '#9e2146',
                        },
                    },
                }} />
            </div>

            <button
                type="submit"
                disabled={loading || !stripe}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
                {loading ? <Loader2 className="animate-spin" /> : 'Save Card'}
            </button>

            {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}
        </form>
    );
};

export const PayoutModal: React.FC<PayoutModalProps> = ({ isOpen, onClose, userId, email, onSuccess }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 relative shadow-2xl animate-scale-in">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={20} />
                </button>

                <Elements stripe={stripePromise}>
                    <PayoutForm userId={userId} email={email} onSuccess={onSuccess} onClose={onClose} />
                </Elements>
            </div>
        </div>
    );
};
