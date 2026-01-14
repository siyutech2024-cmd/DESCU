
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
        className={`bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col h-full group cursor-pointer relative ${product.isPromoted ? 'border-2 border-yellow-400 shadow-yellow-100' : 'border border-gray-100'}`}
    >
      {/* Promoted Badge */}
      {product.isPromoted && (
          <div className="absolute top-0 right-0 z-10 bg-yellow-400 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider shadow-sm flex items-center gap-0.5">
              <Zap size={10} fill="currentColor" />
              {t('card.promoted')}
          </div>
      )}

      {/* Image Container - Aspect Square (1:1) for modern look */}
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
        <img 
          src={product.images[0]} 
          alt={product.title} 
          className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-500 ease-in-out"
        />
        
        {/* Location Badge - Bottom Left */}
        {isNearby && (
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-0.5 shadow-sm">
            <MapPin size={10} className="text-brand-400" />
            {product.distance}km
          </div>
        )}
      </div>
      
      <div className="p-3 flex flex-col flex-grow relative">
        {/* Title */}
        <h4 className="text-sm text-gray-700 line-clamp-2 leading-snug mb-1 min-h-[2.5em]">
            {product.title}
        </h4>

        {/* Price & Category */}
        <div className="mt-auto">
            <div className="flex items-center justify-between mb-2">
                <span className={`text-lg font-extrabold tracking-tight ${product.isPromoted ? 'text-yellow-600' : 'text-gray-900'}`}>
                    {formatPrice(product.price)}
                </span>
                
                {/* Delivery Icons */}
                <div className="flex gap-1 text-gray-400">
                  {(product.deliveryType === DeliveryType.Shipping || product.deliveryType === DeliveryType.Both) && (
                     <Truck size={14} className="text-blue-400" />
                  )}
                  {(product.deliveryType === DeliveryType.Meetup || product.deliveryType === DeliveryType.Both) && (
                     <Handshake size={14} className="text-orange-400" />
                  )}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                    {t(`cat.${product.category}`)}
                </span>
                
                <button 
                    onClick={(e) => {
                        e.stopPropagation(); // Critical: prevent card navigation
                        onAddToCart(product);
                    }}
                    disabled={isInCart}
                    className={`p-1.5 rounded-full transition-colors z-10 relative ${
                    isInCart 
                        ? 'bg-gray-100 text-gray-300' 
                        : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                    }`}
                >
                    <ShoppingBag size={16} fill={isInCart ? "currentColor" : "none"} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
