
import React, { useState } from 'react';
import { X, Trash2, ShoppingBag, CreditCard, CheckCircle2, Truck, Handshake } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Product, DeliveryType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useRegion } from '../contexts/RegionContext';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: Product[];
  onRemoveItem: (id: string) => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onRemoveItem,
  onCheckout
}) => {
  const { t } = useLanguage();
  const { region, currency: userCurrency, convertPrice, formatCurrency } = useRegion();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Normalize Total Price to User's Currency
  const totalPrice = cartItems.reduce((sum, item) => {
    const itemCurrency = item.currency || 'MXN';
    const { price: converted } = convertPrice(item.price, itemCurrency);
    return sum + converted;
  }, 0);

  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-md w-full flex">
        <div className="h-full w-full bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out">
          {/* Header */}
          <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <ShoppingBag className="text-brand-600" size={20} />
              {t('nav.favorites') || 'Saved Items'} ({cartItems.length})
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                <ShoppingBag size={64} className="opacity-20" />
                <p>{t('cart.empty')}</p>
                <button onClick={onClose} className="text-brand-600 font-medium hover:underline">
                  {t('cart.go_shop')}
                </button>
              </div>
            ) : (
              cartItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => { onClose(); navigate(`/product/${item.id}`); }}
                  className="flex gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:border-brand-300 transition-all"
                >
                  <div className="w-20 h-20 flex-shrink-0 bg-white rounded-lg overflow-hidden border border-gray-200">
                    <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 line-clamp-1">{item.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-500">{t(`cat.${item.category}`)}</p>
                        <span className="text-gray-300">|</span>
                        <div className="flex items-center gap-1 text-xs text-brand-600">
                          {item.deliveryType === DeliveryType.Shipping ? (
                            <><Truck size={10} /> {t('delivery.shipping')}</>
                          ) : item.deliveryType === DeliveryType.Meetup ? (
                            <><Handshake size={10} /> {t('delivery.meetup')}</>
                          ) : (
                            <><Truck size={10} /> {t('delivery.both')}</>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-red-500">
                        {formatCurrency(item.price, item.currency || 'MXN')}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); }}
                        className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Removed - P2P items are bought correctly on Product Page */}
        </div>
      </div>
    </div>
  );
};
