
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Sparkles, MapPin, Loader2, Camera, DollarSign, Truck, Handshake, Info, AlertCircle } from 'lucide-react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { AISuggestion, Category, Coordinates, Product, User, DeliveryType } from '../types';
import { analyzeImageWithGemini } from '../services/geminiService';
import { fileToBase64, getFullDataUrl, compressImage } from '../services/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { useRegion } from '../contexts/RegionContext';
import { GlassToast, ToastType } from './GlassToast';
import { uploadProductImage } from '../services/supabase';

// Smart category mapping from AI response to Category enum
const mapCategoryFromAI = (aiCategory: string): Category => {
  const normalized = aiCategory.toLowerCase().trim();
  const mapping: Record<string, Category> = {
    'electronics': Category.Electronics,
    'electronic': Category.Electronics,
    'tech': Category.Electronics,
    'furniture': Category.Furniture,
    'home': Category.Furniture,
    'clothing': Category.Clothing,
    'clothes': Category.Clothing,
    'fashion': Category.Clothing,
    'apparel': Category.Clothing,
    'books': Category.Books,
    'book': Category.Books,
    'sports': Category.Sports,
    'sport': Category.Sports,
    'fitness': Category.Sports,
    'vehicles': Category.Vehicles,
    'vehicle': Category.Vehicles,
    'car': Category.Vehicles,
    'auto': Category.Vehicles,
    'realestate': Category.RealEstate,
    'real estate': Category.RealEstate,
    'property': Category.RealEstate,
    'house': Category.RealEstate,
    'services': Category.Services,
    'service': Category.Services,
  };
  return mapping[normalized] || Category.Other;
};

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

  const [formData, setFormData] = useState<Partial<AISuggestion> & { price: string; currency: string; deliveryType: DeliveryType | null; subcategory?: string }>({
    title: '',
    description: '',
    category: Category.Other,
    subcategory: undefined,
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
        subcategory: undefined,
        price: '',
        currency: regionCurrency,
        deliveryType: null
      });
      setAiStatus('idle'); // Reset AI status
      setIsUploading(false);
      setToast(prev => ({ ...prev, show: false }));
    }
  }, [isOpen]);

  const processFile = async (file: File) => {
    try {
      // 1. Compress immediately for preview & AI
      const compressedFile = await compressImage(file, 1024, 0.8);
      setImage(compressedFile);

      const previewUrl = await getFullDataUrl(compressedFile);
      setImagePreview(previewUrl);

      setAiStatus('analyzing');
      const base64 = await fileToBase64(compressedFile);
      const result = await analyzeImageWithGemini(base64);

      if (result) {
        setFormData(prev => ({
          ...prev,
          title: result.title,
          description: result.description,
          category: mapCategoryFromAI(result.category),
          subcategory: result.subcategory || undefined,
          price: result.price.toString(),
          deliveryType: (result.deliveryType === 'Meetup' ? DeliveryType.Meetup : result.deliveryType === 'Shipping' ? DeliveryType.Shipping : DeliveryType.Both),
        }));
        setAiStatus('success');
      } else {
        throw new Error("No result from AI");
      }
    } catch (error: any) {
      console.error("AI Analysis failed", error);
      setAiStatus('error');
      showToast(t('modal.ai_error') || `Error: ${error.message}`, 'error');
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const triggerImageSelection = async () => {
    // 更严格的Capacitor检测：只依赖protocol，不依赖User-Agent
    // 避免移动端Web浏览器被错误识别为Capacitor环境
    const isCapacitor = window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:';

    if (isCapacitor) {
      try {
        const image = await CapacitorCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Prompt, // Prompts user: Photo or Gallery
          width: 1200
        });

        if (image.webPath) {
          const response = await fetch(image.webPath);
          const blob = await response.blob();
          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
          await processFile(file);
        }
      } catch (e) {
        console.log('Camera API failed, falling back to file input', e);
        // 回退到file input（可能是权限被拒绝或API不可用）
        fileInputRef.current?.click();
      }
    } else {
      // Web环境：直接使用file input
      fileInputRef.current?.click();
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
        subcategory: formData.subcategory || undefined,
        deliveryType: formData.deliveryType!,
        location: userLocation,
        locationName: language === 'es' ? 'CDMX' : 'Nearby',
      });
      onClose();
    } catch (error: any) {
      console.error("Submission failed", error);
      showToast(t('toast.upload_failed'), 'error');
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
              onClick={triggerImageSelection}
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

          {/* Policy Hint - Google Play Requirement */}
          <div className="bg-brand-50/50 p-4 rounded-xl border border-brand-100 flex gap-3">
            <Info size={18} className="text-brand-600 shrink-0" />
            <p className="text-[11px] font-medium text-brand-800 leading-normal">
              {t('modal.policy_hint')}
            </p>
          </div>

          {/* Form Inputs */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('modal.label.title')}</label>
              <input
                required
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder={t('modal.ph.title')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-gray-900 placeholder:text-gray-400 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('modal.label.price')}</label>
                <div className="flex gap-2">
                  <select
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    className="w-24 px-2 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none bg-gray-50 font-bold text-gray-700"
                  >
                    <option value="MXN">MX$</option>
                    <option value="USD">US$</option>
                    <option value="CNY">¥</option>
                    <option value="EUR">€</option>
                    <option value="JPY">¥JP</option>
                  </select>
                  <input
                    required
                    type="number"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0"
                    className="flex-1 pl-4 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-lg font-bold text-gray-900 placeholder:text-gray-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('modal.label.category')}</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value as Category })}
                  className="w-full px-3 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none bg-white font-medium text-gray-700"
                >
                  {Object.values(Category).map(c => (
                    <option key={c} value={c}>{t(`cat.${c}`)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('modal.label.desc')}</label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('modal.ph.desc')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all resize-none text-gray-600 leading-relaxed"
              />
            </div>

            {/* Delivery Type Selection */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('modal.label.delivery')}</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, deliveryType: DeliveryType.Meetup })}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${formData.deliveryType === DeliveryType.Meetup
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-100 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                >
                  <Handshake size={24} className="mb-1" />
                  <span className="text-[10px] md:text-xs font-bold">{t('del.meetup')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, deliveryType: DeliveryType.Shipping })}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${formData.deliveryType === DeliveryType.Shipping
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-100 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                >
                  <Truck size={24} className="mb-1" />
                  <span className="text-[10px] md:text-xs font-bold">{t('del.shipping')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, deliveryType: DeliveryType.Both })}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${formData.deliveryType === DeliveryType.Both
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-100 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                >
                  <div className="flex gap-1 mb-1">
                    <Handshake size={14} />
                    <Truck size={14} />
                  </div>
                  <span className="text-[10px] md:text-xs font-bold">{t('del.both')}</span>
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
              <div className={`p-2 rounded-full ${userLocation ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                <MapPin size={18} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {userLocation ? t('modal.loc.success') : t('modal.loc.loading')}
                </p>
              </div>
            </div>
          </div>
        </form>

        <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-white">
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
    </div>
  );
};
