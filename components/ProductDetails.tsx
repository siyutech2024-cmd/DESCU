
import React, { useState } from 'react';
import { ArrowLeft, MapPin, ShoppingBag, Check, ShieldCheck, Clock, Truck, Handshake, MessageCircle, Zap, Flag } from 'lucide-react';
import { Product, DeliveryType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { ReportModal } from './ReportModal';
import { CheckoutModal } from './CheckoutModal';
import { User } from '../types';

interface ProductDetailsProps {
  product: Product;
  onBack: () => void;
  onAddToCart: (product: Product) => void;
  onContactSeller: (product: Product) => void;
  isInCart: boolean;
  user: User | null;
}

export const ProductDetails: React.FC<ProductDetailsProps> = ({ product, onBack, onAddToCart, onContactSeller, isInCart, user }) => {
  const { t, formatPrice } = useLanguage();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const getRelativeTime = (timestamp: number) => {
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (days === 0) return t('time.today');
    return t('time.days_ago').replace('{0}', days.toString());
  };

  const getDeliveryLabel = (type: DeliveryType) => {
    return t(`delivery.${type}`);
  };

  return (
    <div className="min-h-screen bg-transparent pb-32 pt-4 animate-fade-in">
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

        <div className="glass-panel rounded-[2.5rem] p-1 md:p-8 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-10">
            {/* Image Section - Framed Glass */}
            <div className="relative group">
              <div className="aspect-square rounded-[2rem] overflow-hidden bg-white/20 shadow-inner border border-white/30 relative z-10">
                <img
                  src={product.images[0]}
                  alt={product.title}
                  className="w-full h-full object-cover transform transition-transform duration-700 hover:scale-105"
                />
              </div>
              {/* Decorative Blur blob behind image */}
              <div className="absolute -inset-4 bg-brand-500/20 blur-3xl rounded-full opacity-50 z-0"></div>

              {product.distance !== undefined && product.distance <= 5 && (
                <div className="absolute top-6 left-6 z-20 bg-white/80 backdrop-blur-md text-gray-800 text-sm font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 border border-white/50">
                  <MapPin size={14} className="text-brand-600" />
                  {t('card.nearby')} {product.distance}km
                </div>
              )}
              {product.isPromoted && (
                <div className="absolute top-6 right-6 z-20 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5">
                  <Zap size={14} fill="currentColor" />
                  {t('card.promoted')}
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="p-6 md:p-2 flex flex-col justify-center">
              <div className="mb-auto">
                <div className="flex items-center gap-3 mb-4">
                  <span className="glass-pill px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider text-brand-700">
                    {t(`cat.${product.category}`)}
                  </span>
                  <span className="flex items-center gap-1.5 text-gray-500 text-xs font-medium bg-white/30 px-2 py-1 rounded-full">
                    <Clock size={12} />
                    {getRelativeTime(product.createdAt)}
                  </span>
                </div>

                <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3 leading-tight tracking-tight">
                  {product.title}
                </h1>

                <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400 mb-6 drop-shadow-sm">
                  {formatPrice(product.price)}
                </div>

                {/* Delivery Method Info */}
                <div className="glass-card rounded-2xl p-4 mb-8 flex items-center gap-4 bg-white/40">
                  <div className={`p-3 rounded-full ${product.deliveryType === DeliveryType.Shipping ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                    {product.deliveryType === DeliveryType.Shipping ? <Truck size={24} /> : <Handshake size={24} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 mb-0.5 uppercase tracking-wide opacity-70">{t('detail.delivery')}</h4>
                    <p className="text-lg font-bold text-gray-900">{getDeliveryLabel(product.deliveryType)}</p>
                  </div>
                </div>

                <div className="prose prose-sm text-gray-600 mb-8 bg-white/30 p-6 rounded-2xl border border-white/40 backdrop-blur-sm">
                  <h3 className="text-gray-900 font-bold mb-2 text-lg">{t('detail.desc_title')}</h3>
                  <p className="whitespace-pre-wrap leading-relaxed font-medium">{product.description}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 grid grid-cols-2 gap-4">
                <button
                  onClick={() => onContactSeller(product)}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-lg bg-white/80 backdrop-blur-md text-brand-600 border border-brand-100 hover:bg-white hover:scale-[1.02] shadow-sm transition-all"
                >
                  <MessageCircle size={22} />
                  {t('detail.contact')}
                </button>

                <button
                  onClick={() => setIsCheckoutOpen(true)}
                  disabled={!user}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:shadow-brand-500/40 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                >
                  <ShoppingBag size={22} />
                  Lo quiero
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Seller & Location Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pb-8">
          {/* Seller Card */}
          <div className="glass-card p-6 rounded-[2rem] flex items-center gap-5">
            <div className="relative">
              <img src={product.seller.avatar} alt={product.seller.name} className="w-16 h-16 rounded-full border-2 border-white shadow-md object-cover" />
              {product.seller.isVerified && (
                <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-1 rounded-full border-2 border-white">
                  <ShieldCheck size={12} />
                </div>
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('detail.seller')}</div>
              <div className="font-bold text-xl text-gray-900 flex items-center gap-1">
                {product.seller.name}
              </div>
              <div className="text-sm text-gray-500 font-medium">{product.seller.email}</div>
            </div>
          </div>

          {/* Location Card */}
          <div className="glass-card p-6 rounded-[2rem] flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-green-600 border-2 border-white shadow-sm">
              <MapPin size={28} />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('detail.location')}</div>
              <div className="font-bold text-xl text-gray-900">{product.locationName || 'Unknown'}</div>
              <p className="text-sm text-gray-500 font-medium">
                {product.distance !== undefined ? `${product.distance}km away` : t('list.loc_success')}
              </p>
            </div>
          </div>
        </div>
      </div>
      <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} targetId={product.id} />
      {user && (
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          product={product}
          user={user}
        />
      )}
    </div>
  );
};
