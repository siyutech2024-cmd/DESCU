
import React from 'react';
import { Search, Globe, MapPin, Home, MessageCircle, LogOut } from 'lucide-react';
import { User as UserType, Language } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

interface NavbarProps {
  user: UserType | null;
  onLogin: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  cartCount: number;
  onCartClick: () => void;
  onProfileClick: () => void;
  onSellClick: () => void;
  onLogoClick: () => void;
  onChatClick: () => void;
  unreadCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogin,
  searchQuery,
  onSearchChange,
  cartCount,
  onCartClick,
  onProfileClick,
  onSellClick,
  onLogoClick,
  onChatClick,
  unreadCount
}) => {
  const { t, language, setLanguage } = useLanguage();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as Language);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('退出失败:', error);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">

        {/* Brand Logo - Added for brand consistency */}
        <div
          onClick={onLogoClick}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-9 h-9 bg-brand-600 text-white flex items-center justify-center rounded-lg shadow-md transform group-hover:rotate-6 transition-transform">
            <svg viewBox="0 0 100 100" className="w-6 h-6 fill-none stroke-white" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
              <path d="M30 20 H50 C70 20 85 35 85 50 C85 65 70 80 50 80 H30 Z" />
            </svg>
          </div>
          <span className="hidden lg:block text-xl font-black text-gray-900 tracking-tighter">DESCU</span>
        </div>

        {/* Location Indicator */}
        <div className="flex items-center gap-1 text-gray-500 text-sm font-medium bg-gray-50 px-3 py-2 rounded-full cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap ml-1">
          <MapPin size={14} className="text-brand-600" />
          <span className="hidden sm:inline">CDMX</span>
        </div>

        {/* Search Bar - Expanded */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('nav.search')}
            className="w-full bg-gray-100/80 border-transparent focus:bg-white focus:border-brand-300 border focus:ring-4 focus:ring-brand-50 rounded-full py-2.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-gray-400"
          />
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-4">
          {/* Language */}
          <div className="flex items-center text-gray-500">
            <Globe size={18} className="mr-1" />
            <select
              value={language}
              onChange={handleLanguageChange}
              className="bg-transparent text-sm font-medium outline-none cursor-pointer hover:text-brand-600 transition-colors"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </div>

          <div className="h-6 w-px bg-gray-200"></div>

          <button onClick={onLogoClick} className="font-medium text-gray-600 hover:text-brand-600" title={t('nav.home')}>
            <Home size={20} />
          </button>

          {user && (
            <button onClick={onChatClick} className="font-medium text-gray-600 hover:text-brand-600 relative" title={t('nav.chat')}>
              <MessageCircle size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-brand-600 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          <button onClick={onCartClick} className="font-medium text-gray-600 hover:text-brand-600">
            {t('nav.cart')} {cartCount > 0 && `(${cartCount})`}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-8 h-8 rounded-full cursor-pointer hover:ring-2 hover:ring-brand-300 transition-all"
                  onClick={onProfileClick}
                  title={t('nav.profile')}
                />
                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
                  title="退出登录"
                >
                  <LogOut size={18} />
                </button>
              </div>
              <button
                onClick={onSellClick}
                className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-full font-bold shadow-md shadow-brand-200 transition-all active:scale-95"
              >
                {t('nav.sell')}
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="font-bold text-brand-600 hover:bg-brand-50 px-4 py-2 rounded-full transition-colors"
            >
              {t('nav.login')}
            </button>
          )}
        </div>

        {/* Mobile Language Switcher (Icon only) */}
        <div className="md:hidden">
          <select
            value={language}
            onChange={handleLanguageChange}
            className="bg-transparent text-xs font-bold text-gray-500 outline-none p-1"
          >
            <option value="es">ES</option>
            <option value="en">EN</option>
            <option value="zh">CN</option>
          </select>
        </div>

      </div>
    </nav>
  );
};
