
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Sparkles, MapPin, Loader2, Camera, DollarSign, Truck, Handshake, Info, AlertCircle } from 'lucide-react';
import { AISuggestion, Category, Coordinates, Product, User, DeliveryType } from '../types';
import { analyzeImageWithGemini } from '../services/geminiService';
import { fileToBase64, getFullDataUrl, compressImage } from '../services/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { useRegion } from '../contexts/RegionContext';
import { GlassToast, ToastType } from './GlassToast';
import { uploadProductImage } from '../services/supabase';

interface SellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (product: Omit<Product, 'id' | 'createdAt' | 'distance'>) => void;
  user: User;
  userLocation: Coordinates | null;
}

export const SellModal: React.FC<SellModalProps> = ({ isOpen, onClose, onSubmit, user, userLocation }) => {
  const { t, language } = useLanguage();
  const { currency: regionCurrency } = useRegion();
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // AI Status State: 'idle' | 'analyzing' | 'success' | 'error'
  const [aiStatus, setAiStatus] = useState<'idle' | 'analyzing' | 'success' | 'error'>('idle');
  const [isUploading, setIsUploading] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ show: boolean; message: string; type: ToastType }>({
    show: false,
    message: '',
    type: 'success'
  });

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ show: true, message, type });
  };

  const [formData, setFormData] = useState<Partial<AISuggestion> & { price: string; currency: string; deliveryType: DeliveryType | null }>({
    title: '',
    description: '',
    category: Category.Other,
    price: '',
    currency: 'MXN',
    deliveryType: null, // Force user selection
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setImage(null);
      setImagePreview(null);
      setFormData({
        title: '',
        description: '',
        category: Category.Other,
        price: '',
        currency: regionCurrency,
        deliveryType: null
      });
      setAiStatus('idle'); // Reset AI status
      setIsUploading(false);
      setToast(prev => ({ ...prev, show: false }));
    }
  }, [isOpen]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      let file = e.target.files[0];

      try {
        // 1. Compress immediately for preview & AI
        // Limit to 1024px for AI analysis to go faster
        const compressedFile = await compressImage(file, 1024, 0.8);
        file = compressedFile;
        setImage(file);

        const previewUrl = await getFullDataUrl(file);
        setImagePreview(previewUrl);

        setAiStatus('analyzing'); // Start analyzing
        const base64 = await fileToBase64(file);
        const result = await analyzeImageWithGemini(base64);

        if (result) {
          setFormData(prev => ({
            ...prev,
            title: result.title,
            description: result.description,
            category: result.category as Category,
            price: result.price.toString(),
            deliveryType: (result.deliveryType === 'Meetup' ? DeliveryType.Meetup : result.deliveryType === 'Shipping' ? DeliveryType.Shipping : DeliveryType.Both),
          }));
          setAiStatus('success'); // Success!
        } else {
          throw new Error("No result from AI");
        }
      } catch (error: any) {
        console.error("AI Analysis failed", error);
        setAiStatus('error'); // Failed
        showToast(t('modal.ai_error') || `Error: ${error.message}`, 'error');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !userLocation) return;

    try {
      setIsUploading(true);

      // 2. Upload to Supabase Storage
      const publicUrl = await uploadProductImage(image);

      if (!publicUrl) {
        throw new Error('Image upload failed');
      }

      onSubmit({
        seller: user,
        title: formData.title || 'Untitled',
        description: formData.description || '',
        price: Number(formData.price) || 0,
        currency: formData.currency || 'MXN',
        images: [publicUrl], // Send URL, not Base64!
        category: formData.category as Category,
        deliveryType: formData.deliveryType!,
        location: userLocation,
        locationName: language === 'es' ? 'CDMX' : 'Nearby',
      });
      onClose();
    } catch (error: any) {
      console.error("Submission failed", error);
      showToast('Failed to upload product. Please try again.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <GlassToast
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />

      <div className="relative bg-white w-full max-w-lg h-[92vh] md:h-auto md:max-h-[85vh] md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center z-10">
          <h2 className="text-lg font-bold text-gray-900">{t('modal.title')}</h2>
          <button onClick={onClose} className="p-2 -mr-2 hover:bg-gray-100 rounded-full text-gray-500">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Image Upload */}
          <div className="space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 hover:bg-brand-50/50 transition-all overflow-hidden ${imagePreview ? 'border-none ring-1 ring-gray-100' : ''}`}
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <div className="bg-white/90 backdrop-blur text-gray-900 px-4 py-2 rounded-full font-medium text-sm flex items-center gap-2">
                      <Camera size={16} /> {t('modal.change_img')}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center p-6 space-y-3">
                  <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <Upload size={28} />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-gray-900">{t('modal.upload_text')}</p>
                    <p className="text-sm text-gray-400 mt-1">{t('modal.upload_hint')}</p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>

            {/* AI Status Bar */}
            <div className="h-6">
              {aiStatus === 'analyzing' && (
                <div className="flex items-center gap-2 text-brand-600 bg-brand-50/80 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-medium w-fit animate-pulse">
                  <Loader2 size={12} className="animate-spin" />
                  <span>{t('modal.analyzing')}</span>
                </div>
              )}
              {aiStatus === 'success' && (
                <div className="flex items-center gap-2 text-brand-700 bg-brand-50 px-3 py-1.5 rounded-lg text-xs font-medium w-fit">
                  <Sparkles size={12} />
                  <span>{t('modal.analyzed') || 'AI Auto-filled'}</span>
                </div>
              )}
              {aiStatus === 'error' && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1.5 rounded-lg text-xs font-medium w-fit">
                  <AlertCircle size={12} />
                  <span>AI Failed (Manual Entry Required)</span>
                </div>
              )}
            </div>
          </div>

          {/* ... */}

          <button
            onClick={handleSubmit}
            disabled={!imagePreview || !userLocation || !formData.deliveryType || aiStatus === 'analyzing' || isUploading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-brand-200 hover:shadow-brand-300 transition-all active:scale-[0.98] text-lg flex items-center justify-center gap-2"
          >
            {aiStatus === 'analyzing' ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                {t('modal.submit.analyzing')}
              </>
            ) : isUploading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Processing...
              </>
            ) : t('modal.submit')}
          </button>
      </div>
    </div>
    </div >
  );
};
