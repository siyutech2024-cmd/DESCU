import React from 'react';
import { Product, DeliveryType } from '../types';
import { MapPin, ShoppingBag, Truck, Zap } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useRegion } from '../contexts/RegionContext';

interface ProductCardProps {
  product: Product;
  // onAddToCart removed - direct purchase model
  isInCart: boolean;
  onClick: (product: Product) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, isInCart, onClick, isFavorite, onToggleFavorite }) => {
  const { t } = useLanguage();
  const { convertPrice, formatCurrency, currency: userCurrency } = useRegion();
  const isNearby = product.distance !== undefined && product.distance <= 5.0;

  const productCurrency = product.currency || 'MXN'; // Fallback
  const { price: convertedPrice, currency: targetCurrency } = convertPrice(product.price, productCurrency);
  const showDual = productCurrency !== userCurrency;

  const handleCardClick = (e: React.MouseEvent) => {
    // Stop propagation if the click originated from the button
    if ((e.target as HTMLElement).closest('button')) return;
    onClick(product);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`glass-card rounded-xl md:rounded-2xl overflow-hidden group cursor-pointer relative flex flex-col h-full active:scale-[0.98] transition-all duration-200 ${product.isPromoted ? 'ring-2 ring-yellow-400/50 shadow-brand-500/10' : 'border border-white/40'}`}
    >
      {/* Promoted Badge */}
      {product.isPromoted && (
        <div className="absolute top-0 right-0 z-10 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 md:px-2.5 md:py-1 rounded-bl-xl uppercase tracking-wider shadow-md flex items-center gap-1">
          <Zap size={8} fill="currentColor" className="md:w-[10px] md:h-[10px]" />
          {t('card.promoted')}
        </div>
      )}

      {/* Favorite Button */}
      {onToggleFavorite && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product);
          }}
          className="absolute top-2 right-2 z-10 p-2 rounded-full bg-white/50 backdrop-blur-md hover:bg-white text-gray-400 hover:text-red-500 transition-colors shadow-sm active:scale-90"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={isFavorite ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-5 h-5 ${isFavorite ? "text-red-500" : ""}`}
          >
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </button>
      )}

      {/* Image Container - Aspect Square (1:1) */}
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
        <img
          src={product.images[0]}
          alt={product.title}
          loading="lazy"
          className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-500 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Location Badge - Compact for Mobile */}
        {isNearby && (
          <div className="absolute bottom-1.5 left-1.5 md:bottom-2 md:left-2 bg-white/80 backdrop-blur-md text-gray-800 text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full flex items-center gap-0.5 shadow-sm border border-white/50">
            <MapPin size={8} className="text-brand-600 md:w-[10px] md:h-[10px]" />
            {product.distance}km
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-2.5 md:p-4 flex flex-col flex-grow relative bg-white/40 backdrop-blur-sm group-hover:bg-white/60 transition-colors">
        {/* Title - 2 lines max */}
        <h4 className="text-xs md:text-sm font-bold text-gray-800 line-clamp-2 leading-tight mb-2 min-h-[2.5em] group-hover:text-brand-700 transition-colors">
          {product.title}
        </h4>

        <div className="mt-auto">
          {/* Price */}
          <div className="flex flex-col mb-2">
            <div className="flex items-end justify-between">
              <span className={`text-base md:text-lg font-black tracking-tight ${product.isPromoted ? 'text-orange-600' : 'text-gray-900'}`}>
                {formatCurrency(product.price, productCurrency)}
              </span>

              {/* Delivery Icons */}
              <div className="flex gap-1 opacity-70">
                {(product.deliveryType === DeliveryType.Shipping || product.deliveryType === DeliveryType.Both) && (
                  <div className="bg-blue-100 p-0.5 md:p-1 rounded-full"><Truck size={10} className="text-blue-600 md:w-3 md:h-3" /></div>
                )}
              </div>
            </div>

            {showDual && (
              <span className="text-[10px] md:text-xs text-gray-400 font-bold -mt-0.5">
                ≈ {formatCurrency(convertedPrice, targetCurrency)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
            {/* Cart button removed - direct purchase model */}
          </div>
        </div>
      </div>
    </div>
  );
};
