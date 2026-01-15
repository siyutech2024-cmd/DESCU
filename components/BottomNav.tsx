
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
    <div className="md:hidden fixed bottom-6 left-4 right-4 z-50 animate-fade-in-up">
      <div className="glass-panel flex items-center justify-around h-16 rounded-[2rem] shadow-2xl border border-white/50 backdrop-blur-xl bg-white/70">

        {/* Home */}
        <button
          onClick={() => onChangeView('home')}
          className={`flex flex-col items-center justify-center w-12 h-full gap-1 transition-all duration-300 ${currentView === 'home' ? 'text-brand-600 scale-110' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Home size={22} strokeWidth={currentView === 'home' ? 3 : 2} />
        </button>

        {/* Chat */}
        <button
          onClick={() => onChangeView('chat-list')}
          className={`flex flex-col items-center justify-center w-12 h-full gap-1 relative transition-all duration-300 ${currentView === 'chat-list' ? 'text-brand-600 scale-110' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <div className="relative">
            <MessageCircle size={22} strokeWidth={currentView === 'chat-list' ? 3 : 2} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-brand-600 text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full ring-2 ring-white animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
        </button>

        {/* Sell Button - Floating Main Action */}
        <div className="relative -top-6">
          <button
            onClick={onSellClick}
            className="w-14 h-14 bg-gradient-to-br from-brand-600 to-brand-500 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/40 text-white transform transition-transform active:scale-90 hover:scale-105 hover:-rotate-3"
          >
            <PlusCircle size={28} />
          </button>
        </div>

        {/* Cart */}
        <button
          onClick={onCartClick}
          className="flex flex-col items-center justify-center w-12 h-full gap-1 text-gray-400 hover:text-gray-600 transition-all active:scale-95"
        >
          <div className="relative">
            <ShoppingBag size={22} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full ring-2 ring-white">
                {cartCount}
              </span>
            )}
          </div>
        </button>

        {/* Profile */}
        <button
          onClick={() => onChangeView('profile')}
          className={`flex flex-col items-center justify-center w-12 h-full gap-1 transition-all duration-300 ${currentView === 'profile' ? 'text-brand-600 scale-110' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <UserIcon size={22} strokeWidth={currentView === 'profile' ? 3 : 2} />
        </button>
      </div>
    </div>
  );
};
