
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Sparkles, MapPin, Loader2, Camera, DollarSign, Truck, Handshake, Info } from 'lucide-react';
import { AISuggestion, Category, Coordinates, Product, User, DeliveryType } from '../types';
import { analyzeProductImage } from '../services/geminiService';
import { fileToBase64, getFullDataUrl } from '../services/utils';
import { useLanguage } from '../contexts/LanguageContext';

interface SellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (product: Omit<Product, 'id' | 'createdAt' | 'distance'>) => void;
  user: User;
  userLocation: Coordinates | null;
}

export const SellModal: React.FC<SellModalProps> = ({ isOpen, onClose, onSubmit, user, userLocation }) => {
  const { t, language } = useLanguage();
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [formData, setFormData] = useState<Partial<AISuggestion> & { price: string; deliveryType: DeliveryType }>({
    title: '',
    description: '',
    category: Category.Other,
    price: '',
    deliveryType: DeliveryType.Both,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setImage(null);
      setImagePreview(null);
      setFormData({ title: '', description: '', category: Category.Other, price: '', deliveryType: DeliveryType.Both });
      setIsAnalyzing(false);
    }
  }, [isOpen]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      
      try {
        const previewUrl = await getFullDataUrl(file);
        setImagePreview(previewUrl);
        
        setIsAnalyzing(true);
        const base64 = await fileToBase64(file);
        const result = await analyzeProductImage(base64, language);
        
        setFormData(prev => ({
          ...prev,
          title: result.title,
          description: result.description,
          category: result.category,
          price: result.suggestedPrice ? result.suggestedPrice.toString() : prev.price,
          deliveryType: result.suggestedDeliveryType || DeliveryType.Both,
        }));
      } catch (error) {
        console.error("AI Analysis failed", error);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreview || !userLocation) return;

    onSubmit({
      seller: user,
      title: formData.title || 'Untitled',
      description: formData.description || '',
      price: Number(formData.price) || 0,
      currency: language === 'zh' ? 'CNY' : 'MXN',
      images: [imagePreview],
      category: formData.category as Category,
      deliveryType: formData.deliveryType,
      location: userLocation,
      locationName: language === 'es' ? 'CDMX' : 'Nearby',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
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
                {isAnalyzing && (
                <div className="flex items-center gap-2 text-brand-600 bg-brand-50/80 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-medium w-fit animate-pulse">
                    <Loader2 size={12} className="animate-spin" />
                    <span>{t('modal.analyzing')}</span>
                </div>
                )}
                {!isAnalyzing && imagePreview && (
                <div className="flex items-center gap-2 text-brand-700 bg-brand-50 px-3 py-1.5 rounded-lg text-xs font-medium w-fit">
                    <Sparkles size={12} />
                    <span>{t('modal.analyzed')}</span>
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
                onChange={e => setFormData({...formData, title: e.target.value})}
                placeholder={t('modal.ph.title')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-gray-900 placeholder:text-gray-400 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('modal.label.price')}</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-400 font-bold text-lg">{language === 'zh' ? '¥' : '$'}</span>
                        </div>
                        <input 
                            required
                            type="number" 
                            value={formData.price}
                            onChange={e => setFormData({...formData, price: e.target.value})}
                            placeholder="0"
                            className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-lg font-bold text-gray-900 placeholder:text-gray-300"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('modal.label.category')}</label>
                    <select 
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value as Category})}
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
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder={t('modal.ph.desc')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all resize-none text-gray-600 leading-relaxed"
              />
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
              disabled={!imagePreview || !userLocation || isAnalyzing}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-brand-200 hover:shadow-brand-300 transition-all active:scale-[0.98] text-lg flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    {t('modal.submit.analyzing')}
                  </>
              ) : t('modal.submit')}
            </button>
        </div>
      </div>
    </div>
  );
};
