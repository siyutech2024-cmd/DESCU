import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Truck, Zap, Heart } from 'lucide-react';
import { formatDistance, isMeaningfulDistance } from '../distance';
import { Product, DeliveryType } from '@/types';
import { useLanguage } from '@/i18n';
import { useRegion } from '@/contexts/RegionContext';
import { getOptimizedImageUrl } from '@/services/imageOptimizer';

interface ProductCardProps {
  product: Product;
  /** @deprecated cart was removed; kept so existing call sites type-check */
  isInCart?: boolean;
  /**
   * Optional click handler. The card is a real link to `/product/:id`, so callers no longer
   * need to navigate themselves. When provided, it is invoked for plain left clicks *instead of*
   * the default link navigation; modified clicks (middle / ctrl / cmd) always follow the href.
   */
  onClick?: (product: Product) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (product: Product) => void;
  priority?: boolean;
}

/** Feed tile: photo, title (2 lines), price, place. One accent (brand) plus the promoted badge. */
export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick, isFavorite, onToggleFavorite, priority = false }) => {
  const { t, language } = useLanguage();
  const { convertPrice, formatCurrency, currency: userCurrency } = useRegion();

  const localizedTitle = (product as any)[`title_${language}`] || product.title;
  const productCurrency = product.currency || 'MXN';
  const { price: convertedPrice, currency: targetCurrency } = convertPrice(product.price, productCurrency);
  const showDual = productCurrency !== userCurrency;
  const isSold = product.status === 'sold';
  const ships = product.deliveryType === DeliveryType.Shipping || product.deliveryType === DeliveryType.Both;
  const place = product.city || product.town || product.locationName || '';

  const handleCardClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onClick) return;
    const isPlainLeftClick = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
    if (!isPlainLeftClick) return;
    e.preventDefault();
    onClick(product);
  };

  return (
    <Link
      to={`/product/${product.id}`}
      onClick={handleCardClick}
      aria-label={localizedTitle}
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white border shadow-sm transition-[box-shadow,transform] duration-200 hover:shadow-md active:scale-[0.99] focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 ${product.isPromoted ? 'border-amber-200' : 'border-gray-100'}`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
        <img
          src={getOptimizedImageUrl(product.images[0], 'thumbnail')}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          width={300}
          height={300}
          className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 ${isSold ? 'grayscale opacity-70' : ''}`}
        />

        {product.isPromoted && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            <Zap size={10} className="fill-current" />{t('card.promoted')}
          </span>
        )}

        {onToggleFavorite && (
          <button
            type="button"
            aria-label={t('nav.favorites')}
            aria-pressed={!!isFavorite}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(product); }}
            className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-colors active:scale-90 ${isFavorite ? 'text-brand-600' : 'text-gray-400 hover:text-brand-600'}`}
          >
            <Heart size={16} className={isFavorite ? 'fill-current' : ''} />
          </button>
        )}

        {isSold && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="-rotate-6 rounded-lg bg-white px-3 py-1.5 text-sm font-black text-gray-900 shadow-lg">{t('product.sold')}</span>
          </div>
        )}

        {isMeaningfulDistance(product.distance) && !isSold && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-gray-700 shadow-sm backdrop-blur">
            <MapPin size={10} className="text-brand-600" />{formatDistance(product.distance!)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-2.5 md:p-3.5">
        <h4 className="mb-1.5 line-clamp-2 min-h-[2.5em] text-xs md:text-sm font-bold leading-tight text-gray-800 transition-colors group-hover:text-brand-700">
          {localizedTitle}
        </h4>
        <div className="mt-auto">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-base md:text-lg font-black tracking-tight text-gray-900 tabular-nums">{formatCurrency(product.price, productCurrency)}</span>
            {ships && <Truck size={14} className="text-gray-400 flex-shrink-0" aria-label={t('delivery.shipping')} />}
          </div>
          {showDual && <p className="text-[10px] md:text-xs font-bold text-gray-400 tabular-nums">≈ {formatCurrency(convertedPrice, targetCurrency)}</p>}
          {place && <p className="mt-1 truncate text-[11px] text-gray-500">{place}</p>}
        </div>
      </div>
    </Link>
  );
};
