
import React, { useState } from 'react';
import { ArrowLeft, MapPin, ShoppingBag, Check, ShieldCheck, Clock, Truck, Handshake, MessageCircle, Zap, Flag } from 'lucide-react';
import { Product, DeliveryType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { ReportModal } from './ReportModal';

interface ProductDetailsProps {
  product: Product;
  onBack: () => void;
  onAddToCart: (product: Product) => void;
  onContactSeller: (product: Product) => void;
  isInCart: boolean;
}

export const ProductDetails: React.FC<ProductDetailsProps> = ({ product, onBack, onAddToCart, onContactSeller, isInCart }) => {
  const { t } = useLanguage();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const getRelativeTime = (timestamp: number) => {
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (days === 0) return t('time.today');
    return t('time.days_ago').replace('{0}', days.toString());
  };

  const getDeliveryLabel = (type: DeliveryType) => {
    return t(`delivery.${type}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 pt-4">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
            <button 
                onClick={onBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
                <ArrowLeft size={20} />
                {t('detail.back')}
            </button>
            <button 
                onClick={() => setIsReportModalOpen(true)}
                className="flex items-center gap-1.5 text-gray-400 hover:text-red-500 transition-colors text-xs font-bold uppercase tracking-wider bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm"
            >
                <Flag size={14} />
                {t('detail.report')}
            </button>
        </div>

        <div className={`bg-white rounded-2xl shadow-sm overflow-hidden ${product.isPromoted ? 'border-2 border-yellow-400 shadow-yellow-100' : 'border border-gray-100'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8">
            {/* Image Section */}
            <div className="aspect-square bg-gray-100 relative">
              <img 
                src={product.images[0]} 
                alt={product.title} 
                className="w-full h-full object-cover"
              />
              {product.distance !== undefined && product.distance <= 5 && (
                <div className="absolute top-4 left-4 bg-brand-500 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                  <MapPin size={14} />
                  {t('card.nearby')} {product.distance}km
                </div>
              )}
              {product.isPromoted && (
                <div className="absolute top-4 right-4 bg-yellow-400 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                   <Zap size={14} fill="currentColor" />
                   {t('card.promoted')}
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="p-6 md:p-8 flex flex-col">
              <div className="mb-auto">
                <div className="flex items-start justify-between mb-2">
                    <span className="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wide">
                        {t(`cat.${product.category}`)}
                    </span>
                    <span className="flex items-center gap-1 text-gray-400 text-xs">
                        <Clock size={12} />
                        {getRelativeTime(product.createdAt)}
                    </span>
                </div>
                
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 leading-tight">
                  {product.title}
                </h1>
                
                <div className="text-3xl font-bold text-red-500 mb-4">
                  ¥{product.price.toLocaleString()}
                </div>

                {/* Delivery Method Info */}
                <div className="bg-blue-50/50 rounded-lg p-3 mb-6 flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-full text-blue-600 mt-0.5">
                    {product.deliveryType === DeliveryType.Shipping ? <Truck size={18} /> : <Handshake size={18} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 mb-0.5">{t('detail.delivery')}</h4>
                    <p className="text-sm text-gray-600">{getDeliveryLabel(product.deliveryType)}</p>
                  </div>
                </div>

                <div className="prose prose-sm text-gray-600 mb-8">
                  <h3 className="text-gray-900 font-semibold mb-2">{t('detail.desc_title')}</h3>
                  <p className="whitespace-pre-wrap leading-relaxed">{product.description}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 gap-3">
                <button
                    onClick={() => onContactSeller(product)}
                    className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-lg bg-white border-2 border-brand-100 text-brand-600 hover:bg-brand-50 transition-all"
                >
                    <MessageCircle size={20} />
                    {t('detail.contact')}
                </button>

                <button
                  onClick={() => onAddToCart(product)}
                  disabled={isInCart}
                  className={`flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-lg transition-all ${
                    isInCart 
                      ? 'bg-gray-100 text-gray-400 cursor-default' 
                      : 'bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 hover:shadow-brand-300 active:scale-[0.98]'
                  }`}
                >
                  {isInCart ? (
                    <>
                      <Check size={20} />
                      {t('card.in_cart')}
                    </>
                  ) : (
                    <>
                      <ShoppingBag size={20} />
                      {t('card.add_cart')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Seller & Location Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Seller Card */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
             <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                 {t('detail.seller')}
             </h3>
             <div className="flex items-center gap-4">
                <img src={product.seller.avatar} alt={product.seller.name} className="w-14 h-14 rounded-full border border-gray-100" />
                <div>
                    <div className="font-bold text-lg text-gray-800 flex items-center gap-1">
                        {product.seller.name}
                        {product.seller.isVerified && (
                             <ShieldCheck size={18} className="text-blue-500 fill-blue-50" />
                        )}
                    </div>
                    {product.seller.isVerified && (
                        <div className="text-xs text-blue-500 font-medium">{t('detail.verified')}</div>
                    )}
                    <div className="text-sm text-gray-500">{product.seller.email}</div>
                </div>
             </div>
          </div>

          {/* Location Card */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                 <MapPin size={18} className="text-gray-400" />
                 {t('detail.location')}
             </h3>
             <div className="bg-gray-50 rounded-lg h-24 flex items-center justify-center text-gray-400 text-sm">
                 <span>Map View Placeholder</span>
             </div>
             <p className="mt-3 text-sm text-gray-600">
                 {t('list.loc_success')} ({product.distance}km away)
             </p>
          </div>
        </div>
      </div>
      <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} targetId={product.id} />
    </div>
  );
};
