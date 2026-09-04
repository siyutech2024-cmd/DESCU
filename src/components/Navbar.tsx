
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Globe, MapPin, Home, MessageCircle, LogOut, X, ChevronDown } from 'lucide-react';
import { User as UserType, Language, Region } from '../types';
import { useLanguage } from '@/i18n';
import { useRegion } from '../contexts/RegionContext';
import { supabase } from '../services/supabase';
import { api, ApiError } from '@/lib/api/client';
import { DetailedLocationInfo } from '../services/locationService';

interface NavbarProps {
  user: UserType | null;
  onLogin: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // cartCount and onCartClick removed - direct purchase model
  onProfileClick: () => void;
  onSellClick: () => void;
  onLogoClick: () => void;
  onChatClick: () => void;
  unreadCount: number;
  locationInfo?: DetailedLocationInfo | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogin,
  searchQuery,
  onSearchChange,
  onProfileClick,
  onSellClick,
  onLogoClick,
  onChatClick,
  unreadCount,
  locationInfo
}) => {
  const { t, language, setLanguage } = useLanguage();
  const { region, setRegion } = useRegion();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  /** The search box only filters the home feed: typing anywhere else jumps home, keeping the text. */
  const handleSearchChange = (value: string) => {
    onSearchChange(value);
    if (pathname !== '/' && value.trim()) navigate('/');
  };

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

  const REGION_FLAG: Record<string, string> = { MX: '🇲🇽', US: '🇺🇸', CN: '🇨🇳', EU: '🇪🇺', JP: '🇯🇵', Global: '🌍' };
  const pill = 'inline-flex items-center gap-1.5 h-9 rounded-full border border-gray-200 bg-white/80 px-3 text-xs font-bold text-gray-700 transition-colors hover:border-brand-200 hover:bg-white';
  const iconBtn = 'relative w-10 h-10 inline-flex items-center justify-center rounded-full text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors';

  return (
    <nav className="sticky top-0 z-nav pt-safe bg-white/80 backdrop-blur-xl border-b border-gray-100/80 shadow-glass-sm">
      <div className="max-w-6xl mx-auto px-3 md:px-4 h-16 flex items-center gap-2 md:gap-3">

        {/* Brand */}
        <button type="button" onClick={onLogoClick} className="flex items-center gap-2 flex-shrink-0 group" aria-label="DESCU">
          <span className="w-9 h-9 md:w-10 md:h-10 bg-brand-600 text-white flex items-center justify-center rounded-xl shadow-md shadow-brand-500/25 group-hover:rotate-6 transition-transform">
            <svg viewBox="0 0 100 100" className="w-5 h-5 md:w-6 md:h-6 fill-none stroke-white" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
              <path d="M30 20 H50 C70 20 85 35 85 50 C85 65 70 80 50 80 H30 Z" />
            </svg>
          </span>
          <span className="hidden lg:block text-2xl font-black text-gray-900 tracking-tighter">DESCU</span>
        </button>

        {/* Location (desktop) */}
        {locationInfo?.displayName && (
          <span className={`hidden md:inline-flex ${pill} max-w-[220px]`} title={locationInfo.displayName}>
            <MapPin size={12} className="text-brand-600 flex-shrink-0" />
            <span className="truncate">{locationInfo.displayName}</span>
          </span>
        )}

        {/* Search */}
        <div className="flex-1 min-w-0 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('nav.search')}
            aria-label={t('nav.search')}
            className="w-full h-10 rounded-full border border-gray-200 bg-gray-50 pl-10 pr-9 text-sm font-medium text-gray-900 placeholder:text-gray-400 outline-none transition focus:bg-white focus:border-brand-400 focus:ring-4 focus:ring-brand-100 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <button type="button" onClick={() => onSearchChange('')} aria-label={t('modal.close')} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-700">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Mobile: relocate + language */}
        <button
          type="button"
          onClick={async () => {
            try {
              const res = await fetch('https://ipapi.co/json/');
              const data = await res.json();
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                try {
                  await api.post('/api/users/update-location', { country: data.country_code, city: data.city, lat: data.latitude, lng: data.longitude }, { auth: 'required' });
                } catch (err) {
                  if (!(err instanceof ApiError)) throw err;
                }
                window.location.reload();
              }
            } catch (err) {
              console.error('relocate failed:', err);
            }
          }}
          className="md:hidden w-10 h-10 flex-shrink-0 inline-flex items-center justify-center rounded-full bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
          title={t('nav.relocate')}
          aria-label={t('nav.relocate')}
        >
          <MapPin size={18} />
        </button>
        <label className={`md:hidden ${pill} pl-2.5 pr-2 relative`}>
          <Globe size={14} className="text-gray-500" />
          <select value={language} onChange={handleLanguageChange} aria-label="Idioma" className="bg-transparent text-xs font-bold text-gray-700 outline-none appearance-none pr-3 uppercase">
            <option value="es">ES</option>
            <option value="en">EN</option>
            <option value="zh">中文</option>
          </select>
          <ChevronDown size={12} className="absolute right-2 text-gray-400 pointer-events-none" />
        </label>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
          <label className={`${pill} pl-2.5 pr-7 relative cursor-pointer`} title="Región">
            <span className="text-base leading-none">{REGION_FLAG[region] ?? '🌍'}</span>
            <select value={region} onChange={(e) => setRegion(e.target.value as Region)} aria-label="Región" className="bg-transparent text-xs font-bold text-gray-700 outline-none appearance-none cursor-pointer uppercase tracking-wide">
              <option value="MX">MEX</option>
              <option value="US">USA</option>
              <option value="CN">CHN</option>
              <option value="EU">EUR</option>
              <option value="JP">JPN</option>
              <option value="Global">ALL</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 text-gray-400 pointer-events-none" />
          </label>
          <label className={`${pill} pl-2.5 pr-7 relative cursor-pointer`} title="Idioma">
            <Globe size={14} className="text-gray-500" />
            <select value={language} onChange={handleLanguageChange} aria-label="Idioma" className="bg-transparent text-xs font-bold text-gray-700 outline-none appearance-none cursor-pointer">
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 text-gray-400 pointer-events-none" />
          </label>

          <span className="h-6 w-px bg-gray-200 mx-1" />

          <button type="button" onClick={onLogoClick} className={iconBtn} title={t('nav.home')} aria-label={t('nav.home')}>
            <Home size={21} />
          </button>
          {user && (
            <button type="button" onClick={onChatClick} className={iconBtn} title={t('nav.chat')} aria-label={t('nav.chat')}>
              <MessageCircle size={21} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full ring-2 ring-white">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
          )}

          {user ? (
            <>
              <button type="button" onClick={onProfileClick} className="ml-1 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200" title={user.name} aria-label={t('nav.profile')}>
                <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover bg-gray-100 ring-2 ring-white shadow-sm hover:ring-brand-200 transition" />
              </button>
              <button type="button" onClick={handleLogout} className={`${iconBtn} hover:text-red-600 hover:bg-red-50`} title={t('nav.logout')} aria-label={t('nav.logout')}>
                <LogOut size={19} />
              </button>
              <button type="button" onClick={onSellClick} className="ml-1 h-10 px-5 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold shadow-md shadow-brand-500/25 transition-colors">
                {t('nav.sell')}
              </button>
            </>
          ) : (
            <button type="button" onClick={onLogin} className="ml-1 h-10 px-5 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold shadow-md shadow-brand-500/25 transition-colors">
              {t('nav.login')}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
