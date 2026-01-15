
import React from 'react';
import { Product, DeliveryType } from '../types';
import { MapPin, ShoppingBag, Truck, Handshake, Zap } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  isInCart: boolean;
  onClick: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, isInCart, onClick }) => {
  const { t, formatPrice } = useLanguage();
  const isNearby = product.distance !== undefined && product.distance <= 5.0;

  const handleCardClick = (e: React.MouseEvent) => {
    // Stop propagation if the click originated from the button
    // Note: The button's onClick handler stops propagation, but this is a safety check
    if ((e.target as HTMLElement).closest('button')) return;
    onClick(product);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`glass-card rounded-2xl overflow-hidden group cursor-pointer relative flex flex-col h-full ${product.isPromoted ? 'ring-2 ring-yellow-400 shadow-yellow-200/50' : 'hover:border-white/80'}`}
    >
      {/* Promoted Badge */}
      {product.isPromoted && (
        <div className="absolute top-0 right-0 z-10 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl uppercase tracking-wider shadow-md flex items-center gap-1">
          <Zap size={10} fill="currentColor" />
          {t('card.promoted')}
        </div>
      )}

      {/* Image Container - Aspect Square (1:1) with subtle overlay */}
      <div className="relative aspect-square w-full overflow-hidden bg-white/20">
        <img
          src={product.images[0]}
          alt={product.title}
          className="object-cover w-full h-full transform group-hover:scale-110 transition-transform duration-700 ease-in-out"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />

        {/* Location Badge - Floating Glass Pill */}
        {isNearby && (
          <div className="absolute bottom-2 left-2 bg-white/70 backdrop-blur-md text-gray-800 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm border border-white/50">
            <MapPin size={10} className="text-brand-600" />
            {product.distance}km
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-grow relative bg-white/30 backdrop-blur-sm group-hover:bg-white/40 transition-colors">
        {/* Title */}
        <h4 className="text-sm font-bold text-gray-800 line-clamp-2 leading-snug mb-2 min-h-[2.5em] group-hover:text-brand-700 transition-colors">
          {product.title}
        </h4>

        {/* Price & Category */}
        <div className="mt-auto">
          <div className="flex items-center justify-between mb-2.5">
            <span className={`text-xl font-black tracking-tight ${product.isPromoted ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-orange-600' : 'text-gray-900'}`}>
              {formatPrice(product.price)}
            </span>

            {/* Delivery Icons */}
            <div className="flex gap-1.5 opacity-60">
              {(product.deliveryType === DeliveryType.Shipping || product.deliveryType === DeliveryType.Both) && (
                <div className="bg-blue-100 p-1 rounded-full"><Truck size={12} className="text-blue-600" /></div>
              )}
              {(product.deliveryType === DeliveryType.Meetup || product.deliveryType === DeliveryType.Both) && (
                <div className="bg-orange-100 p-1 rounded-full"><Handshake size={12} className="text-orange-600" /></div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100/50">
            <span className="text-[10px] font-semibold text-gray-500 bg-white/50 px-2 py-1 rounded-md border border-white/30">
              {t(`cat.${product.category}`)}
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation(); // Critical: prevent card navigation
                onAddToCart(product);
              }}
              disabled={isInCart}
              className={`p-2 rounded-full transition-all duration-300 z-10 relative ${isInCart
                  ? 'bg-gray-100 text-gray-300 shadow-inner'
                  : 'bg-white text-brand-600 shadow-md hover:bg-brand-600 hover:text-white hover:scale-110'
                }`}
            >
              <ShoppingBag size={16} fill={isInCart ? "currentColor" : "none"} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
