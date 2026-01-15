
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
    <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-glass-sm transition-all duration-300">
      <div className="max-w-5xl mx-auto px-4 h-18 flex items-center gap-4">

        {/* Brand Logo - Added for brand consistency */}
        <div
          onClick={onLogoClick}
          className="flex items-center gap-2 cursor-pointer group flex-shrink-0"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-brand-600 to-brand-500 text-white flex items-center justify-center rounded-xl shadow-lg shadow-brand-500/20 transform group-hover:rotate-6 transition-transform">
            <svg viewBox="0 0 100 100" className="w-6 h-6 fill-none stroke-white" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
              <path d="M30 20 H50 C70 20 85 35 85 50 C85 65 70 80 50 80 H30 Z" />
            </svg>
          </div>
          <span className="hidden lg:block text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-700 tracking-tighter">DESCU</span>
        </div>

        {/* Location Indicator - Pill */}
        <div className="hidden sm:flex items-center gap-1.5 text-gray-600 text-xs font-bold bg-white/50 border border-white/40 px-3 py-1.5 rounded-full cursor-pointer hover:bg-white hover:shadow-sm transition-all whitespace-nowrap">
          <MapPin size={12} className="text-brand-600" />
          <span>CDMX</span>
        </div>

        {/* Search Bar - Modern Glass Input */}
        <div className="flex-1 relative max-w-lg ml-auto mr-auto md:mr-0">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('nav.search')}
            className="w-full bg-white/50 backdrop-blur-md border border-gray-200/50 focus:bg-white focus:border-brand-300/50 focus:ring-4 focus:ring-brand-500/10 rounded-full py-2.5 pl-11 pr-4 text-sm font-medium outline-none transition-all placeholder:text-gray-400 shadow-inner"
          />
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-5">
          {/* Language */}
          <div className="flex items-center text-gray-500/80 hover:text-gray-800 transition-colors">
            <Globe size={18} className="mr-1.5" />
            <select
              value={language}
              onChange={handleLanguageChange}
              className="bg-transparent text-xs font-bold outline-none cursor-pointer uppercase tracking-wider"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </div>

          <div className="h-6 w-px bg-gray-200/60"></div>

          <button onClick={onLogoClick} className="text-gray-500 hover:text-brand-600 hover:bg-brand-50 p-2 rounded-full transition-all" title={t('nav.home')}>
            <Home size={22} strokeWidth={2} />
          </button>

          {user && (
            <button onClick={onChatClick} className="text-gray-500 hover:text-brand-600 hover:bg-brand-50 p-2 rounded-full transition-all relative" title={t('nav.chat')}>
              <MessageCircle size={22} strokeWidth={2} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-brand-600 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white shadow-sm animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          <button onClick={onCartClick} className="text-gray-500 hover:text-brand-600 hover:bg-brand-50 p-2 rounded-full transition-all relative" title={t('nav.cart')}>
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white shadow-sm">
                  {cartCount}
                </span>
              )}
            </div>
          </button>

          {user ? (
            <div className="flex items-center gap-4 pl-2">
              <div className="flex items-center gap-3">
                <div className="relative group/profile">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-10 h-10 rounded-full cursor-pointer border-2 border-white shadow-md hover:scale-105 transition-transform object-cover"
                    onClick={onProfileClick}
                    title={t('nav.profile')}
                  />
                  <div className="absolute top-full right-0 mt-2 py-1 px-2 bg-black/80 backdrop-blur-md text-white text-xs rounded-lg opacity-0 group-hover/profile:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    {user.name}
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full text-gray-400 transition-colors"
                  title="退出登录"
                >
                  <LogOut size={20} />
                </button>
              </div>
              <button
                onClick={onSellClick}
                className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-brand-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
              >
                <span>{t('nav.sell')}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 px-6 py-2.5 rounded-full transition-colors"
            >
              {t('nav.login')}
            </button>
          )}
        </div>

        {/* Mobile Language Switcher */}
        <div className="md:hidden">
          <select
            value={language}
            onChange={handleLanguageChange}
            className="bg-white/50 backdrop-blur-md rounded-lg text-xs font-bold text-gray-500 outline-none py-1.5 px-1 border border-white/40"
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
