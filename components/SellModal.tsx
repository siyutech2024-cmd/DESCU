
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Sparkles, MapPin, Loader2, Camera, DollarSign, Truck, Handshake, Info, AlertCircle, Plus, Star, Trash2, GripVertical } from 'lucide-react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { AISuggestion, Category, Coordinates, Product, User, DeliveryType } from '../types';
import { analyzeImageWithGemini } from '../services/geminiService';
import { fileToBase64, getFullDataUrl, compressImage } from '../services/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { useRegion } from '../contexts/RegionContext';
import { GlassToast, ToastType } from './GlassToast';
import { uploadProductImage } from '../services/supabase';

const MAX_IMAGES = 5;

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

interface ImageItem {
  file: File;
  preview: string;
  id: string; // unique key for React list
}

export const SellModal: React.FC<SellModalProps> = ({ isOpen, onClose, onSubmit, user, userLocation }) => {
  const { t, language } = useLanguage();
  const { currency: regionCurrency } = useRegion();
  const [images, setImages] = useState<ImageItem[]>([]);
  // AI Status State: 'idle' | 'analyzing' | 'success' | 'error'
  const [aiStatus, setAiStatus] = useState<'idle' | 'analyzing' | 'success' | 'error'>('idle');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Drag state for reordering
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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
    deliveryType: DeliveryType.Meetup, // Default to in-person meetup
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setImages([]);
      setFormData({
        title: '',
        description: '',
        category: Category.Other,
        subcategory: undefined,
        price: '',
        currency: regionCurrency,
        deliveryType: DeliveryType.Meetup
      });
      setAiStatus('idle');
      setIsUploading(false);
      setUploadProgress(0);
      setToast(prev => ({ ...prev, show: false }));
    }
  }, [isOpen]);

  const addImageFile = async (file: File, triggerAI: boolean) => {
    try {
      const compressedFile = await compressImage(file, 1024, 0.8);
      const previewUrl = await getFullDataUrl(compressedFile);
      const newItem: ImageItem = {
        file: compressedFile,
        preview: previewUrl,
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      };

      setImages(prev => [...prev, newItem]);

      // Only trigger AI analysis for the first image
      if (triggerAI) {
        setAiStatus('analyzing');
        try {
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
      }
    } catch (error) {
      console.error("Failed to process image", error);
      showToast(t('toast.upload_failed') || 'Failed to process image', 'error');
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const remaining = MAX_IMAGES - images.length;
      const files = Array.from(e.target.files).slice(0, remaining);
      for (let i = 0; i < files.length; i++) {
        const isFirstEver = images.length === 0 && i === 0;
        await addImageFile(files[i], isFirstEver);
      }
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerImageSelection = async () => {
    if (images.length >= MAX_IMAGES) {
      showToast(t('modal.max_images') || `Maximum ${MAX_IMAGES} images`, 'warning');
      return;
    }

    const isCapacitor = window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:';

    if (isCapacitor) {
      try {
        const photo = await CapacitorCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Prompt,
          width: 1200
        });

        if (photo.webPath) {
          const response = await fetch(photo.webPath);
          const blob = await response.blob();
          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
          const isFirstEver = images.length === 0;
          await addImageFile(file, isFirstEver);
        }
      } catch (e) {
        console.log('Camera API failed, falling back to file input', e);
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      // If we removed the first image and AI was done, keep form data
      // If we removed all images, reset AI status
      if (filtered.length === 0) {
        setAiStatus('idle');
      }
      return filtered;
    });
  };

  // Drag-and-drop reordering
  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    setImages(prev => {
      const items = [...prev];
      const [moved] = items.splice(dragIdx, 1);
      items.splice(idx, 0, moved);
      return items;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (images.length === 0 || !userLocation) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Upload all images in parallel
      const uploadPromises = images.map((img, idx) =>
        uploadProductImage(img.file).then(url => {
          setUploadProgress(prev => prev + 1);
          return url;
        })
      );
      const urls = await Promise.all(uploadPromises);
      const validUrls = urls.filter(Boolean) as string[];

      if (validUrls.length === 0) {
        throw new Error('All image uploads failed');
      }

      onSubmit({
        seller: user,
        title: formData.title || 'Untitled',
        description: formData.description || '',
        price: Number(formData.price) || 0,
        currency: formData.currency || 'MXN',
        images: validUrls,
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
      setUploadProgress(0);
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

          {/* Image Upload Area */}
          <div className="space-y-3">
            {images.length === 0 ? (
              /* Empty state — full upload zone */
              <div
                onClick={triggerImageSelection}
                className="relative w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 hover:bg-brand-50/50 transition-all overflow-hidden"
              >
                <div className="text-center p-6 space-y-3">
                  <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <Upload size={28} />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-gray-900">{t('modal.upload_text')}</p>
                    <p className="text-sm text-gray-400 mt-1">{t('modal.upload_hint')}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Image grid — thumbnails with add button */
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all group cursor-grab active:cursor-grabbing ${dragOverIdx === idx ? 'border-brand-500 scale-105' :
                      idx === 0 ? 'border-brand-400' : 'border-gray-100'
                      }`}
                  >
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />

                    {/* Cover badge for first image */}
                    {idx === 0 && (
                      <div className="absolute top-1.5 left-1.5 bg-brand-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                        <Star size={8} fill="currentColor" />
                        {t('modal.cover') || '封面'}
                      </div>
                    )}

                    {/* Delete button — visible on hover */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                      className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md"
                    >
                      <X size={12} />
                    </button>

                    {/* Drag handle */}
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/40 text-white px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-all">
                      <GripVertical size={10} />
                    </div>
                  </div>
                ))}

                {/* Add more button */}
                {images.length < MAX_IMAGES && (
                  <div
                    onClick={triggerImageSelection}
                    className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 hover:bg-brand-50/50 transition-all"
                  >
                    <Plus size={24} className="text-gray-400" />
                    <span className="text-[10px] font-bold text-gray-400 mt-1">{images.length}/{MAX_IMAGES}</span>
                  </div>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />

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
                    <option key={c} value={c}>{t(`cat.${c.toLowerCase()}`)}</option>
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
            disabled={images.length === 0 || !userLocation || !formData.deliveryType || aiStatus === 'analyzing' || isUploading}
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
                {t('modal.uploading') || `Uploading ${uploadProgress}/${images.length}...`}
              </>
            ) : (
              <>
                {t('modal.submit')}
                {images.length > 0 && (
                  <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">
                    {images.length} {images.length === 1 ? 'foto' : 'fotos'}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
