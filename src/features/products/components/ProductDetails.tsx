import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, ShoppingBag, Check, ShieldCheck, Clock, Truck, Handshake, MessageCircle, Zap, Flag, Facebook, Link as LinkIcon, AlertCircle, Star, ChevronRight } from 'lucide-react';
import { formatDistance, isMeaningfulDistance } from '../distance';
import { useUrlModal } from '@/lib/useUrlModal';
import { Product, DeliveryType, User } from '@/types';
import { useLanguage } from '@/i18n';
import { getOptimizedImageUrl } from '@/services/imageOptimizer';
import { useRegion } from '@/contexts/RegionContext';
import { ReportModal } from '@/features/users/components/ReportModal';
import { CheckoutModal } from './CheckoutModal';
import { RatingModal } from '@/features/users/components/RatingModal';
import { CreditBadge } from '@/features/users/components/CreditBadge';
import { canPurchaseProduct } from '@/services/locationService';
import { api } from '@/lib/api/client';
import { notify } from '@/lib/toast';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/features/auth';
import { categoryLabelKey } from '@/features/products/categories';
import { submitRating, getUserRatingStats, EMPTY_RATING_STATS } from '@/services/ratingService';
import { Button, Card, Chip, Eyebrow, IconButton } from '@/components/ui/primitives';

interface ProductDetailsProps {
  product: Product;
  onBack: () => void;
  onContactSeller: (product: Product) => void;
  onRequireLogin: () => void;
  /** @deprecated cart was removed; kept so existing call sites type-check */
  isInCart?: boolean;
  user: User | null;
}

const WHATSAPP_GREEN = '#25D366';
const FACEBOOK_BLUE = '#1877F2';

export const ProductDetails: React.FC<ProductDetailsProps> = ({ product, onBack, onContactSeller, onRequireLogin, user }) => {
  const { t, language } = useLanguage();
  const { convertPrice, formatCurrency, currency: userCurrency } = useRegion();
  const { openLoginModal } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Checkout lives in the URL (`?checkout=1`) so the back button closes it and deep links open it.
  const { isOpen: isCheckoutOpen, open: openCheckout, close: closeCheckout } = useUrlModal('checkout');

  const sellerId = product.seller?.id ?? '';
  const isOwnListing = !!user && user.id === sellerId;
  const goToSeller = () => { if (sellerId) navigate(`/user/${sellerId}`); };

  const { data: sellerRatingStats = EMPTY_RATING_STATS } = useQuery({
    queryKey: queryKeys.ratings(sellerId),
    queryFn: () => getUserRatingStats(sellerId),
    enabled: !!sellerId,
  });

  const localizedTitle = (product as any)[`title_${language}`] || product.title;
  const localizedDescription = (product as any)[`description_${language}`] || product.description;

  const productCurrency = product.currency || 'MXN';
  const { price: convertedPrice, currency: targetCurrency } = convertPrice(product.price, productCurrency);
  const showDual = productCurrency !== userCurrency;

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [purchaseEligibility, setPurchaseEligibility] = useState<{ canPurchase: boolean; reason?: string; warning?: string }>({ canPurchase: true });
  const [sellerScore, setSellerScore] = useState(0);

  useEffect(() => {
    if (user && user.country && product.country) {
      setPurchaseEligibility(canPurchaseProduct(user.country, user.city || '', product.country, product.city || '', product.deliveryType, language));
    }
    if (sellerId) {
      api.get<{ score?: number }>(`/api/users/${sellerId}/credit`)
        .then(data => setSellerScore(data.score || 0))
        .catch(err => console.error('Failed to fetch seller credit', err));
    }
  }, [user, product, language, sellerId]);

  const handleOpenRating = () => {
    if (!user) { openLoginModal(); return; }
    if (isOwnListing) { notify.warning(t('rating.cannot_rate_self')); return; }
    setIsRatingOpen(true);
  };

  /** Submits the rating; throws on failure so the modal stays open for retry. */
  const handleSubmitRating = async (score: number, comment: string) => {
    if (!user) { openLoginModal(); throw new Error('login required'); }
    if (isOwnListing || !sellerId) { notify.warning(t('rating.cannot_rate_self')); throw new Error('cannot rate self'); }
    try {
      await submitRating(user.id, sellerId, score, comment);
    } catch (err) {
      notify.fromError(err, t('rating.submit_failed'));
      throw err;
    }
    notify.success(t('profile.rated_success'));
    await queryClient.invalidateQueries({ queryKey: queryKeys.ratings(sellerId) });
  };

  const relativeTime = (timestamp: number) => {
    const days = Math.floor((Date.now() - timestamp) / 86400000);
    return days === 0 ? t('time.today') : t('time.days_ago').replace('{0}', String(days));
  };

  // Share links use the production host (never capacitor://localhost inside the app).
  const shareUrl = `https://descu.ai/product/${product.id}`;
  const shareText = `${localizedTitle} · ${formatCurrency(product.price, productCurrency)} — DESCU`;
  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`, '_blank', 'noopener');
  const shareFacebook = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener');
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      notify.success(t('product.link_copied'));
      setTimeout(() => setLinkCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  const isSold = product.status === 'sold';
  const cannotBuy = isSold || (!!user && !purchaseEligibility.canPurchase);
  const buyLabel = isSold ? t('product.sold')
    : (!!user && !purchaseEligibility.canPurchase) ? t('product.not_available')
    : product.deliveryType === 'meetup' ? t('product.arrange_meetup') : t('product.want_it');
  const buyTitle = (!user || purchaseEligibility.canPurchase) ? (purchaseEligibility.warning || '') : purchaseEligibility.reason;

  // Rendered twice: inline on desktop, in the fixed bottom bar on mobile (shorter labels there).
  const renderActions = (compact: boolean) => (
    <>
      <Button variant="secondary" size="lg" icon={<MessageCircle size={18} />} disabled={isSold} onClick={() => onContactSeller(product)}>
        {isSold ? t('product.sold') : compact ? t('detail.contact_short') : t('detail.contact')}
      </Button>
      <Button size="lg" icon={<ShoppingBag size={18} />} disabled={cannotBuy} title={buyTitle} onClick={() => (user ? openCheckout() : onRequireLogin())}>
        {compact && !isSold && (!user || purchaseEligibility.canPurchase)
          ? (product.deliveryType === 'meetup' ? t('product.arrange_meetup_short') : t('product.want_it_short'))
          : buyLabel}
      </Button>
    </>
  );

  const subcategoryLabel = product.subcategory ? t(`subcat.${product.subcategory}`) : '';
  const hasSubcategory = !!subcategoryLabel && !subcategoryLabel.startsWith('subcat.') && !subcategoryLabel.startsWith('[');
  const placeName = product.location_display_name || product.town || product.district || product.city || product.locationName || '';
  const deliveryIcon = product.deliveryType === DeliveryType.Shipping ? <Truck size={18} /> : product.deliveryType === 'both' ? <Truck size={18} /> : <Handshake size={18} />;
  const distance = product.distance ?? Infinity;
  const distanceTone = distance <= 5 ? 'success' : distance <= 50 ? 'brand' : 'warning';
  const images = product.images.length > 0 ? product.images : [];

  return (
    <div className="pt-3 md:pt-5 pb-28 md:pb-12 animate-fade-in">
      <div className="max-w-5xl mx-auto px-3 sm:px-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3 md:mb-5">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={18} />} onClick={onBack} className="-ml-2 text-gray-600">{t('detail.back')}</Button>
          <Button variant="ghost" size="sm" icon={<Flag size={14} />} onClick={() => setIsReportModalOpen(true)} className="text-gray-400 hover:text-red-600">{t('detail.report')}</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-5 md:gap-8 items-start">
          {/* Gallery — sticks while the info column scrolls */}
          <div className="md:sticky md:top-24">
            <div className={`relative aspect-square rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm ${!imageLoaded ? 'animate-pulse' : ''}`}>
              <img
                src={getOptimizedImageUrl(images[selectedImageIndex] || images[0], 'medium')}
                alt={localizedTitle}
                onLoad={() => setImageLoaded(true)}
                className={`w-full h-full object-cover transition-opacity duration-500 ${isSold ? 'grayscale' : ''} ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
              {isSold && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="rounded-xl bg-white px-6 py-3 text-2xl font-black text-gray-900 -rotate-6 shadow-xl">{t('product.sold')}</span>
                </div>
              )}
              <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
                {isMeaningfulDistance(product.distance) ? (
                  <Chip tone={distanceTone} icon={<MapPin size={12} />} className="shadow-sm bg-white/95">{distance <= 5 ? `${t('card.nearby')} · ` : ''}{formatDistance(distance)}</Chip>
                ) : <span />}
                {product.isPromoted && <Chip tone="warning" icon={<Zap size={12} className="fill-current" />} className="shadow-sm bg-white/95">{t('card.promoted')}</Chip>}
              </div>
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setSelectedImageIndex(idx); setImageLoaded(false); }}
                    aria-label={`${idx + 1}/${images.length}`}
                    aria-current={selectedImageIndex === idx}
                    className={`w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-colors ${selectedImageIndex === idx ? 'border-brand-500' : 'border-transparent hover:border-brand-200'}`}
                  >
                    <img src={getOptimizedImageUrl(img, 'thumbnail')} alt="" loading="lazy" className={`w-full h-full object-cover ${isSold ? 'grayscale' : ''}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-4 md:space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Chip tone="brand">{hasSubcategory ? subcategoryLabel : t(categoryLabelKey(product.category))}</Chip>
                <Chip tone="neutral">{product.condition === 'new' ? t('condition.new') : t('condition.used')}</Chip>
                <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Clock size={12} />{relativeTime(product.createdAt)}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight tracking-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>{localizedTitle}</h1>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
                <span className="text-3xl md:text-4xl font-black text-brand-600 tabular-nums">{formatCurrency(product.price, productCurrency)}</span>
                {showDual && <span className="text-base font-bold text-gray-400 tabular-nums">≈ {formatCurrency(convertedPrice, targetCurrency)}</span>}
              </div>
            </div>

            {/* Delivery + location, one card */}
            <Card padding={false} className="divide-y divide-gray-100">
              <div className="flex items-center gap-3 p-4">
                <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">{deliveryIcon}</span>
                <div className="min-w-0 flex-1">
                  <Eyebrow>{t('detail.delivery')}</Eyebrow>
                  <p className="font-bold text-gray-900">{t(`delivery.${product.deliveryType}`)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4">
                <span className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0"><MapPin size={18} /></span>
                <div className="min-w-0 flex-1">
                  <Eyebrow>{t('detail.location')}</Eyebrow>
                  <p className="font-bold text-gray-900 truncate">{placeName || t('list.loc_success')}{product.country && !product.location_display_name ? `, ${product.country}` : ''}</p>
                  {isMeaningfulDistance(product.distance) && <p className="text-sm text-gray-500 mt-0.5">{t('detail.distance_away', { km: formatDistance(distance) })}</p>}
                  {!purchaseEligibility.canPurchase && purchaseEligibility.reason && (
                    <p className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700"><AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{purchaseEligibility.reason}</p>
                  )}
                  {purchaseEligibility.canPurchase && purchaseEligibility.warning && (
                    <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"><MapPin size={14} className="mt-0.5 flex-shrink-0" />{purchaseEligibility.warning}</p>
                  )}
                </div>
              </div>
            </Card>

            {/* Description */}
            <Card>
              <h2 className="font-bold text-gray-900 mb-2">{t('detail.desc_title')}</h2>
              <p className="text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{localizedDescription}</p>
            </Card>

            {/* Actions (desktop inline; mobile uses the fixed bar) */}
            {isOwnListing ? (
              <p className="text-center text-sm font-bold text-gray-400 uppercase tracking-widest py-1">{t('detail.own_listing')}</p>
            ) : (
              <div className="hidden md:grid grid-cols-2 gap-3">{renderActions(false)}</div>
            )}

            {/* Seller */}
            <Card
              padding={false}
              interactive={!!sellerId}
              {...(sellerId ? {
                role: 'link', tabIndex: 0, 'aria-label': `${t('detail.seller')}: ${product.seller.name || 'User'}`, onClick: goToSeller,
                onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToSeller(); } },
              } : {})}
              className="p-4 flex items-center gap-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
            >
              <div className="relative flex-shrink-0">
                <img src={product.seller.avatar} alt="" className="w-14 h-14 rounded-full object-cover bg-gray-100 ring-2 ring-white shadow-sm" />
                {product.seller.isVerified && <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center ring-2 ring-white"><ShieldCheck size={11} /></span>}
              </div>
              <div className="min-w-0 flex-1">
                <Eyebrow>{t('detail.seller')}</Eyebrow>
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{product.seller.name}</p>
                  <CreditBadge score={sellerScore} size="sm" />
                </div>
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-gray-600">
                  <Star size={13} className="fill-yellow-400 text-yellow-400" />
                  {sellerRatingStats.total_reviews > 0 ? `${Number(sellerRatingStats.average_rating).toFixed(1)} (${sellerRatingStats.total_reviews})` : t('rating.no_reviews')}
                </p>
              </div>
              {!isOwnListing ? (
                <Button size="sm" variant="secondary" onClick={e => { e.stopPropagation(); handleOpenRating(); }} onKeyDown={e => e.stopPropagation()}>{t('product.rate_seller')}</Button>
              ) : sellerId ? <ChevronRight size={18} className="text-gray-300" /> : null}
            </Card>

            {/* Share */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <Eyebrow>{t('product.share')}</Eyebrow>
              <div className="flex items-center gap-2">
                <IconButton onClick={shareWhatsApp} title="WhatsApp" aria-label="WhatsApp" className="bg-white border border-gray-100 shadow-sm hover:bg-gray-50" style={{ color: WHATSAPP_GREEN }}><MessageCircle size={18} className="fill-current" /></IconButton>
                <IconButton onClick={shareFacebook} title="Facebook" aria-label="Facebook" className="bg-white border border-gray-100 shadow-sm hover:bg-gray-50" style={{ color: FACEBOOK_BLUE }}><Facebook size={18} className="fill-current" /></IconButton>
                <IconButton onClick={copyLink} title={t('product.copy_link')} aria-label={t('product.copy_link')} className="bg-white border border-gray-100 shadow-sm hover:bg-gray-50 text-gray-700">{linkCopied ? <Check size={18} className="text-green-600" /> : <LinkIcon size={18} />}</IconButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: the two actions stay reachable without scrolling past the description */}
      {!isOwnListing && (
        <div className="md:hidden fixed inset-x-0 bottom-nav-offset z-sticky px-3 pt-2 pb-3 bg-white/95 backdrop-blur-md border-t border-gray-100 grid grid-cols-2 gap-3">
          {renderActions(true)}
        </div>
      )}

      <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} targetType="product" targetId={product.id} />
      {user && <CheckoutModal isOpen={isCheckoutOpen} onClose={closeCheckout} product={product} user={user} />}
      {user && !isOwnListing && <RatingModal isOpen={isRatingOpen} onClose={() => setIsRatingOpen(false)} targetUser={product.seller} onSubmit={handleSubmitRating} />}
    </div>
  );
};
