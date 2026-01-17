
import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, RefreshCw, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { Product, Category, DeliveryType } from '../types';
import { analyzeImageWithGemini } from '../services/geminiService';

interface CameraSellFlowProps {
    isOpen: boolean;
    onClose: () => void;
    onPostProduct: (product: Omit<Product, 'id' | 'createdAt' | 'distance'>) => void;
    userLocation: { latitude: number; longitude: number } | null;
}

export const CameraSellFlow: React.FC<CameraSellFlowProps> = ({ isOpen, onClose, onPostProduct, userLocation }) => {
    const [step, setStep] = useState<'camera' | 'analyzing' | 'confirm'>('camera');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);

    // AI Result State
    const [aiResult, setAiResult] = useState({
        title: '',
        price: 0,
        currency: 'MXN',
        description: '',
        category: Category.Other,
        deliveryType: DeliveryType.Both
    });

    // Start Camera Stream (Mock or Real)
    useEffect(() => {
        if (isOpen && step === 'camera') {
            startCamera();
        }
        return () => stopCamera();
    }, [isOpen, step]);

    const startCamera = async () => {
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();
                }
            }
        } catch (err) {
            console.log("Camear permission denied or not available, using mock preview");
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    };

    const handleCapture = async () => {
        if (!videoRef.current) return;

        // 1. Capture Image from Video Stream
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoRef.current, 0, 0);
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

        setCapturedImage(imageBase64);
        setStep('analyzing');
        stopCamera();

        // 2. Call Gemini API
        try {
            const analysis = await analyzeImageWithGemini(imageBase64);

            if (analysis) {
                setAiResult({
                    title: analysis.title,
                    price: analysis.price,
                    currency: analysis.currency,
                    description: analysis.description,
                    category: analysis.category as Category, // Assume AI returns valid category string, fallback if not
                    deliveryType: analysis.deliveryType === 'Meetup' ? DeliveryType.Meetup : analysis.deliveryType === 'Shipping' ? DeliveryType.Shipping : DeliveryType.Both
                });
                setStep('confirm');
            } else {
                throw new Error("AI could not identify the item.");
            }
        } catch (err) {
            console.error(err);
            setError("AI Analysis failed. Please try again.");
            setStep('camera'); // Go back
        }
    };

    const handlePost = () => {
        if (!userLocation) return;
        onPostProduct({
            seller: {} as any, // App.tsx will fill this
            title: aiResult.title,
            description: aiResult.description,
            price: aiResult.price,
            currency: aiResult.currency,
            images: [capturedImage!],
            category: aiResult.category,
            deliveryType: aiResult.deliveryType,
            location: userLocation,
            locationName: 'Mexico City', // Simplified for demo
            isPromoted: false
        });
        // Reset
        setTimeout(() => {
            setStep('camera');
            setCapturedImage(null);
        }, 500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-black text-white animate-fade-in flex flex-col">

            {/* Step 1: Camera Viewfinder */}
            {step === 'camera' && (
                <div className="relative flex-1 flex flex-col">
                    {/* Header */}
                    <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
                        <button onClick={onClose} className="p-2 bg-white/20 backdrop-blur-md rounded-full">
                            <X size={24} />
                        </button>
                        <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/20">
                            AI SCANNER ACTIVE
                        </div>
                        <div className="w-10" />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="absolute top-20 left-4 right-4 z-20 bg-red-500/90 backdrop-blur text-white px-4 py-3 rounded-xl flex items-center justify-between animate-fade-in-down shadow-lg">
                            <span className="text-sm font-medium flex items-center gap-2">
                                <AlertCircle size={18} /> {error}
                            </span>
                            <button onClick={() => setError(null)} className="opacity-80 hover:opacity-100">
                                <X size={18} />
                            </button>
                        </div>
                    )}

                    {/* Viewport */}
                    <div className="flex-1 relative overflow-hidden bg-gray-900">
                        <video
                            ref={videoRef}
                            className="absolute inset-0 w-full h-full object-cover opacity-80"
                            playsInline
                            muted
                        />
                        {/* Fallback/Overlay if no camera */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-64 h-64 border-2 border-white/50 rounded-3xl relative">
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-brand-500 -mt-1 -ml-1 rounded-tl-lg"></div>
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-brand-500 -mt-1 -mr-1 rounded-tr-lg"></div>
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-brand-500 -mb-1 -ml-1 rounded-bl-lg"></div>
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-brand-500 -mb-1 -mr-1 rounded-br-lg"></div>

                                <div className="absolute inset-0 bg-brand-500/10 animate-pulse"></div>
                            </div>
                            <p className="absolute mt-80 text-white/80 font-medium text-sm animate-bounce">
                                Point at item to sell
                            </p>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="h-48 bg-black flex items-center justify-center relative">
                        <button
                            onClick={handleCapture}
                            className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center group"
                        >
                            <div className="w-16 h-16 bg-white rounded-full border-2 border-black group-hover:bg-brand-50 transition-colors"></div>
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Analysis Animation */}
            {step === 'analyzing' && (
                <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-gray-900">
                    {/* Background Image Blurred */}
                    <div
                        className="absolute inset-0 bg-cover bg-center blur-xl opacity-50 scale-110"
                        style={{ backgroundImage: `url(${capturedImage})` }}
                    />

                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-24 h-24 relative mb-6">
                            <div className="absolute inset-0 bg-brand-500/20 rounded-full animate-ping"></div>
                            <div className="absolute inset-0 border-4 border-brand-500 rounded-full animate-spin border-t-transparent"></div>
                            <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
                                <Zap className="text-brand-600 fill-current" size={32} />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Analyzing Item...</h2>
                        <p className="text-gray-400">Identifying category & pricing</p>
                    </div>
                </div>
            )}

            {/* Step 3: Confirmation Card */}
            {step === 'confirm' && (
                <div className="flex-1 flex flex-col bg-gray-50 relative">
                    <div className="relative h-1/2 w-full">
                        <img src={capturedImage!} className="w-full h-full object-cover" alt="Captured" />
                        <button
                            onClick={() => setStep('camera')}
                            className="absolute top-4 left-4 p-2 bg-black/50 text-white rounded-full backdrop-blur-md"
                        >
                            <RefreshCw size={20} />
                        </button>
                    </div>

                    <div className="flex-1 bg-white -mt-6 rounded-t-3xl relative p-6 flex flex-col shadow-2xl">
                        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

                        <div className="flex items-start justify-between mb-2">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2 py-0.5 bg-brand-100 text-brand-700 text-[10px] font-bold uppercase tracking-wider rounded">
                                        AI Suggested
                                    </span>
                                    <span className="text-xs text-gray-400 font-medium">high confidence</span>
                                </div>
                                <h2 className="text-2xl font-black text-gray-900 leading-tight">
                                    {aiResult.title}
                                </h2>
                            </div>
                        </div>

                        <p className="text-3xl font-bold text-brand-600 mb-6 font-mono">
                            ${aiResult.price.toLocaleString()} <span className="text-base text-gray-400 font-normal">{aiResult.currency}</span>
                        </p>

                        <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100 mb-auto">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Category</span>
                                <span className="font-semibold text-gray-900">{aiResult.category}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Delivery</span>
                                <span className="font-semibold text-gray-900">
                                    {aiResult.deliveryType === DeliveryType.Both ? 'Meetup & Shipping' : aiResult.deliveryType}
                                </span>
                            </div>
                            <div className="text-sm border-t border-gray-200 mt-2 pt-2">
                                <span className="text-gray-500 block mb-1">Details</span>
                                <p className="font-medium text-gray-900 line-clamp-2 leading-relaxed">
                                    {aiResult.description}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handlePost}
                            className="w-full py-4 bg-brand-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-500/30 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all mt-4"
                        >
                            <CheckCircle size={24} />
                            Confirm & Post
                        </button>
                        <div className="text-center mt-3">
                            <button onClick={onClose} className="text-sm text-gray-400 font-medium hover:text-gray-600">
                                Edit details manually
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
