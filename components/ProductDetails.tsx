
import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, ShoppingBag, Check, ShieldCheck, Clock, Truck, Handshake, MessageCircle, Zap, Flag, Share2, Facebook, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { Product, DeliveryType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useRegion } from '../contexts/RegionContext';
import { ReportModal } from './ReportModal';
import { CheckoutModal } from './CheckoutModal';
import { RatingModal } from './RatingModal';
import { CreditBadge } from './CreditBadge';
import { User } from '../types';
import { canPurchaseProduct } from '../services/locationService';

interface ProductDetailsProps {
  product: Product;
  onBack: () => void;
  // onAddToCart removed - direct purchase model
  onContactSeller: (product: Product) => void;
  isInCart: boolean;
  user: User | null;
}

export const ProductDetails: React.FC<ProductDetailsProps> = ({ product, onBack, onContactSeller, isInCart, user }) => {
  const { t, language } = useLanguage();
  const { convertPrice, formatCurrency, currency: userCurrency } = useRegion();

  // 根据用户语言读取翻译字段
  const localizedTitle = (product as any)[`title_${language}`] || product.title;
  const localizedDescription = (product as any)[`description_${language}`] || product.description;

  const productCurrency = product.currency || 'MXN';
  const { price: convertedPrice, currency: targetCurrency } = convertPrice(product.price, productCurrency);
  const showDual = productCurrency !== userCurrency;

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Check if user can purchase this product based on location
  const [purchaseEligibility, setPurchaseEligibility] = useState<{ canPurchase: boolean; reason?: string }>({ canPurchase: true });
  const [sellerScore, setSellerScore] = useState(0);

  useEffect(() => {
    if (user && user.country && product.country) {
      const eligibility = canPurchaseProduct(
        user.country,
        user.city || '',
        product.country,
        product.city || '',
        product.deliveryType
      );
      setPurchaseEligibility(eligibility);
    }

    // Fetch Seller Credit Score
    if (product.seller && product.seller.id) {
      import('../services/apiConfig').then(({ API_BASE_URL }) => {
        fetch(`${API_BASE_URL}/api/users/${product.seller.id}/credit`)
          .then(res => res.json())
          .then(data => setSellerScore(data.score || 0))
          .catch(err => console.error("Failed to fetch seller credit", err));
      });
    }
  }, [user, product]);

  const getRelativeTime = (timestamp: number) => {
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (days === 0) return t('time.today');
    return t('time.days_ago').replace('{0}', days.toString());
  };

  const getDeliveryLabel = (type: DeliveryType) => {
    return t(`delivery.${type}`);
  };

  // 生成正确的分享链接（避免在移动端使用 capacitor://localhost）
  const PRODUCTION_URL = 'https://descu.ai';
  const productPath = `/product/${product.id}`;
  const shareUrl = PRODUCTION_URL + productPath;
  const shareText = `Check out ${localizedTitle} on DESCU!`;

  const handleShareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_blank');
  };

  const handleShareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
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
              <div className="aspect-square rounded-[2rem] overflow-hidden bg-white/20 shadow-inner border border-white/30 relative z-10 mb-4">
                <img
                  src={product.images[0]} // TODO: Add state for selected image
                  alt={product.title}
                  className={`w-full h-full object-cover transform transition-transform duration-700 hover:scale-105 ${product.status === 'sold' ? 'grayscale' : ''}`}
                />
                {/* SOLD Overlay */}
                {product.status === 'sold' && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                    <div className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-3xl transform -rotate-12 shadow-2xl border-4 border-white">
                      已售出 / SOLD
                    </div>
                  </div>
                )}
              </div>

              {/* Thumbnails (Mock implementation as product might only have 1 image in mock) */}
              {product.images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {product.images.map((img, idx) => (
                    <button key={idx} className="w-16 h-16 rounded-xl overflow-hidden border-2 border-transparent hover:border-brand-500 focus:border-brand-500 transition-all flex-shrink-0">
                      <img src={img} className={`w-full h-full object-cover ${product.status === 'sold' ? 'grayscale' : ''}`} alt="" />
                    </button>
                  ))}
                  {/* Mock extra images if only 1 exists, just to show UI? No, stick to real data */}
                </div>
              )}

              {/* Decorative Blur blob behind image */}
              <div className="absolute -inset-4 bg-brand-500/20 blur-3xl rounded-full opacity-50 z-0 pointer-events-none"></div>

              {product.distance !== undefined && (
                <div className={`absolute top-6 left-6 z-20 backdrop-blur-md text-sm font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 border ${product.distance <= 5
                  ? 'bg-green-100/90 text-green-800 border-green-200'
                  : product.distance <= 50
                    ? 'bg-white/80 text-gray-800 border-white/50'
                    : 'bg-orange-100/90 text-orange-800 border-orange-200'
                  }`}>
                  <MapPin size={14} className={product.distance <= 5 ? 'text-green-600' : product.distance <= 50 ? 'text-brand-600' : 'text-orange-600'} />
                  {product.distance <= 5 ? t('card.nearby') : ''} {product.distance.toFixed(1)}km
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
                    {product.subcategory ? t(`subcat.${product.subcategory}`) : t(`cat.${product.category?.toLowerCase()}`)}
                  </span>
                  <span className="flex items-center gap-1.5 text-gray-500 text-xs font-medium bg-white/30 px-2 py-1 rounded-full">
                    <Clock size={12} />
                    {getRelativeTime(product.createdAt)}
                  </span>
                </div>

                <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3 leading-tight tracking-tight">
                  {localizedTitle}
                </h1>

                <div className="flex flex-col">
                  <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400 mb-1 drop-shadow-sm">
                    {formatCurrency(product.price, productCurrency)}
                  </div>
                  {showDual && (
                    <div className="text-lg md:text-xl font-bold text-gray-400 mb-6">
                      ≈ {formatCurrency(convertedPrice, targetCurrency)}
                    </div>
                  )}
                </div>

                {/* Delivery Method Info */}
                <div className="glass-card rounded-2xl p-4 mb-4 flex items-center gap-4 bg-white/40">
                  <div className={`p-3 rounded-full ${product.deliveryType === DeliveryType.Shipping ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                    {product.deliveryType === DeliveryType.Shipping ? <Truck size={24} /> : <Handshake size={24} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 mb-0.5 uppercase tracking-wide opacity-70">{t('detail.delivery')}</h4>
                    <p className="text-lg font-bold text-gray-900">{getDeliveryLabel(product.deliveryType)}</p>
                  </div>
                </div>

                {/* Region Restriction Badge with Distance */}
                <div className={`glass-card rounded-2xl p-4 mb-8 flex items-start gap-3 border ${!purchaseEligibility.canPurchase
                  ? 'bg-orange-50/50 border-orange-200'
                  : 'bg-blue-50/50 border-blue-100'
                  }`}>
                  <MapPin size={20} className={!purchaseEligibility.canPurchase ? 'text-orange-600' : 'text-blue-600'} />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-gray-900 mb-1">商品位置 / Ubicación</h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-gray-700 font-medium">
                        {product.location_display_name || product.town || product.district || product.city || '未知城市'}, {product.country || 'MX'}
                      </p>
                      {product.distance !== undefined && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${product.distance <= 5
                          ? 'bg-green-100 text-green-700'
                          : product.distance <= 50
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-orange-100 text-orange-700'
                          }`}>
                          📍 {product.distance.toFixed(1)}km
                        </span>
                      )}
                    </div>

                    {/* 配送方式说明 */}
                    <div className="mt-2 text-xs text-gray-500">
                      {product.deliveryType === 'meetup' && (
                        <span className="flex items-center gap-1">
                          <Handshake size={12} />
                          仅限同城自提 / Solo recoger en persona
                        </span>
                      )}
                      {product.deliveryType === 'shipping' && (
                        <span className="flex items-center gap-1">
                          <Truck size={12} />
                          支持快递配送 / Envío disponible
                        </span>
                      )}
                      {product.deliveryType === 'both' && (
                        <span className="flex items-center gap-1">
                          <Truck size={12} />
                          支持自提和快递 / Recoger o envío
                        </span>
                      )}
                    </div>

                    {/* 不可购买提示 */}
                    {!purchaseEligibility.canPurchase && (
                      <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2">
                        <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-800 font-bold">{purchaseEligibility.reason}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="prose prose-sm text-gray-600 mb-8 bg-white/30 p-6 rounded-2xl border border-white/40 backdrop-blur-sm">
                  <h3 className="text-gray-900 font-bold mb-2 text-lg">{t('detail.desc_title')}</h3>
                  <p className="whitespace-pre-wrap leading-relaxed font-medium">{localizedDescription}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 grid grid-cols-2 gap-4 mb-8">
                <button
                  onClick={() => onContactSeller(product)}
                  disabled={product.status === 'sold'}
                  className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-lg transition-all ${product.status === 'sold'
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-white/80 backdrop-blur-md text-brand-600 border border-brand-100 hover:bg-white hover:scale-[1.02] shadow-sm'
                    }`}
                >
                  <MessageCircle size={22} />
                  {product.status === 'sold' ? '已售出 / Vendido' : t('detail.contact')}
                </button>

                <button
                  onClick={() => setIsCheckoutOpen(true)}
                  disabled={!user || !purchaseEligibility.canPurchase || product.status === 'sold'}
                  className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg ${!user || !purchaseEligibility.canPurchase || product.status === 'sold'
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:shadow-brand-500/40 hover:scale-[1.02] active:scale-95'
                    }`}
                  title={!purchaseEligibility.canPurchase ? purchaseEligibility.reason : ''}
                >
                  <ShoppingBag size={22} />
                  {product.status === 'sold' ? '已售出 / Vendido' : (!purchaseEligibility.canPurchase ? 'No disponible' : 'Lo quiero')}
                </button>
              </div>

              {/* Share Buttons */}
              <div className="flex gap-4 items-center justify-center border-t border-gray-200/50 pt-6">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-widest mr-2">{t('product.share')}</span>
                <button onClick={handleShareWhatsApp} className="p-3 bg-[#25D366] text-white rounded-full hover:scale-110 transition-all shadow-md hover:shadow-lg" title="Share on WhatsApp">
                  <MessageCircle size={20} fill="currentColor" />
                </button>
                <button onClick={handleShareFacebook} className="p-3 bg-[#1877F2] text-white rounded-full hover:scale-110 transition-all shadow-md hover:shadow-lg" title="Share on Facebook">
                  <Facebook size={20} fill="currentColor" />
                </button>
                <button onClick={handleCopyLink} className="p-3 bg-gray-800 text-white rounded-full hover:scale-110 transition-all shadow-md hover:shadow-lg relative" title="Copy Link">
                  {linkCopied ? <Check size={20} /> : <LinkIcon size={20} />}
                  {linkCopied && <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl">Link Copied!</span>}
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
                <CreditBadge score={sellerScore} size="sm" />
              </div>
              <div className="text-sm text-gray-500 font-medium">{product.seller.email}</div>
              <button onClick={() => setIsRatingOpen(true)} className="mt-2 text-xs font-bold text-brand-600 border border-brand-200 px-3 py-1 rounded-full hover:bg-brand-50 transition-colors">
                {t('product.rate_seller')}
              </button>
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
      <RatingModal
        isOpen={isRatingOpen}
        onClose={() => setIsRatingOpen(false)}
        targetUser={product.seller}
        onSubmit={(score, comment) => {
          console.log('Rating submitted:', score, comment);
          setIsRatingOpen(false);
          // showToast('Thanks for your feedback!', 'success'); // If showToast was available
        }}
      />
    </div>
  );
};
