
import React from 'react';
import { Home, PlusCircle, ShoppingBag, User as UserIcon, MessageCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface BottomNavProps {
  currentView: string;
  onChangeView: (view: 'home' | 'profile' | 'chat-list') => void;
  onSellClick: () => void;
  onCartClick: () => void;
  cartCount: number;
  unreadCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ 
  currentView, 
  onChangeView, 
  onSellClick, 
  onCartClick,
  cartCount,
  unreadCount
}) => {
  const { t } = useLanguage();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe pt-2 px-6 flex justify-between items-end z-50 h-[80px] pb-5 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <button 
        onClick={() => onChangeView('home')}
        className={`flex flex-col items-center gap-1 ${currentView === 'home' ? 'text-brand-600' : 'text-gray-400'}`}
      >
        <Home size={24} strokeWidth={currentView === 'home' ? 2.5 : 2} />
        <span className="text-[10px] font-medium">{t('nav.home')}</span>
      </button>

      <button 
        onClick={() => onChangeView('chat-list')}
        className={`flex flex-col items-center gap-1 relative ${currentView === 'chat-list' ? 'text-brand-600' : 'text-gray-400'}`}
      >
        <div className="relative">
            <MessageCircle size={24} strokeWidth={currentView === 'chat-list' ? 2.5 : 2} />
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-600 text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full ring-2 ring-white">
                    {unreadCount}
                </span>
            )}
        </div>
        <span className="text-[10px] font-medium">{t('nav.chat')}</span>
      </button>

      <button 
        onClick={onSellClick}
        className="flex flex-col items-center -mt-6"
      >
        <div className="w-14 h-14 bg-brand-600 rounded-full flex items-center justify-center shadow-lg shadow-brand-200 text-white transform transition-transform active:scale-95">
             <PlusCircle size={28} />
        </div>
        <span className="text-[10px] font-medium text-gray-600 mt-1">{t('nav.sell')}</span>
      </button>

      <button 
        onClick={onCartClick}
        className="flex flex-col items-center gap-1 text-gray-400 relative"
      >
        <div className="relative">
            <ShoppingBag size={24} />
            {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full ring-2 ring-white">
                    {cartCount}
                </span>
            )}
        </div>
        <span className="text-[10px] font-medium">{t('nav.cart')}</span>
      </button>

      <button 
        onClick={() => onChangeView('profile')}
        className={`flex flex-col items-center gap-1 ${currentView === 'profile' ? 'text-brand-600' : 'text-gray-400'}`}
      >
        <UserIcon size={24} strokeWidth={currentView === 'profile' ? 2.5 : 2} />
        <span className="text-[10px] font-medium">{t('nav.profile')}</span>
      </button>
    </div>
  );
};
