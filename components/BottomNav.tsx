
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
    <div className="md:hidden fixed bottom-4 left-3 right-3 z-50 animate-fade-in-up">
      {/* Glass Dock Container */}
      <div className="relative h-16 w-full bg-white/80 backdrop-blur-2xl border border-white/60 shadow-glass-lg rounded-[2.5rem] flex items-center justify-between px-2">

        {/* Left Group */}
        <div className="flex items-center justify-around w-2/5 h-full">
          <button
            onClick={() => onChangeView('home')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 active:scale-95 ${currentView === 'home' ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Home size={24} strokeWidth={currentView === 'home' ? 2.5 : 2} fill={currentView === 'home' ? "currentColor" : "none"} className={currentView === 'home' ? "opacity-100" : "opacity-70"} />
            <span className={`text-[9px] font-bold ${currentView === 'home' ? 'opacity-100' : 'opacity-0 scale-0'} transition-all`}>Home</span>
          </button>

          <button
            onClick={() => onChangeView('chat-list')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 relative transition-all duration-300 active:scale-95 ${currentView === 'chat-list' ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <div className="relative">
              <MessageCircle size={24} strokeWidth={currentView === 'chat-list' ? 2.5 : 2} fill={currentView === 'chat-list' ? "currentColor" : "none"} className={currentView === 'chat-list' ? "opacity-100" : "opacity-70"} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full ring-2 ring-white animate-bounce">
                  {unreadCount}
                </span>
              )}
            </div>
            <span className={`text-[9px] font-bold ${currentView === 'chat-list' ? 'opacity-100' : 'opacity-0 scale-0'} transition-all`}>Chat</span>
          </button>
        </div>

        {/* Center Floating Action Button (FAB) */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-6">
          <button
            onClick={onSellClick}
            className="w-16 h-16 bg-gradient-to-tr from-brand-600 to-brand-400 rounded-full flex items-center justify-center shadow-xl shadow-brand-500/40 text-white transform transition-all active:scale-90 hover:scale-110 border-4 border-[#f8f9fa] ring-1 ring-black/5"
          >
            <PlusCircle size={32} strokeWidth={2} />
          </button>
        </div>

        {/* Right Group */}
        <div className="flex items-center justify-around w-2/5 h-full">
          <button
            onClick={onCartClick}
            className="flex flex-col items-center justify-center w-full h-full gap-1 text-gray-400 hover:text-gray-600 transition-all active:scale-95"
          >
            <div className="relative">
              <ShoppingBag size={24} strokeWidth={2} className="opacity-70" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-600 text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </div>
            <span className="text-[9px] font-bold opacity-0 transition-all">Cart</span>
          </button>

          <button
            onClick={() => onChangeView('profile')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 active:scale-95 ${currentView === 'profile' ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <UserIcon size={24} strokeWidth={currentView === 'profile' ? 2.5 : 2} fill={currentView === 'profile' ? "currentColor" : "none"} className={currentView === 'profile' ? "opacity-100" : "opacity-70"} />
            <span className={`text-[9px] font-bold ${currentView === 'profile' ? 'opacity-100' : 'opacity-0 scale-0'} transition-all`}>Me</span>
          </button>
        </div>

      </div>
    </div>
  );
};
