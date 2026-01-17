import React from 'react';
import { Product, DeliveryType } from '../types';
import { MapPin, ShoppingBag, Truck, Zap } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useRegion } from '../contexts/RegionContext';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  isInCart: boolean;
  onClick: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, isInCart, onClick }) => {
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
            <span className="text-[9px] md:text-[10px] font-medium text-gray-500 bg-white/60 px-1.5 py-0.5 rounded border border-white/40 truncate max-w-[60%]">
              {t(`cat.${product.category}`)}
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(product);
              }}
              disabled={isInCart}
              className={`p-1.5 md:p-2 rounded-full transition-all duration-300 z-10 ${isInCart
                ? 'bg-gray-100 text-gray-300'
                : 'bg-white text-brand-600 shadow-sm border border-gray-100 hover:bg-brand-600 hover:text-white active:scale-90'
                }`}
            >
              <ShoppingBag size={14} fill={isInCart ? "currentColor" : "none"} className="md:w-4 md:h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
