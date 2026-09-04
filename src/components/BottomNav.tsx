
import React, { useState } from 'react';
import { Home, Plus, User as UserIcon, MapPin, MessageCircle, Globe, Check } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { useRegion, REGIONS } from '../contexts/RegionContext';
import { DetailedLocationInfo } from '../services/locationService';
import { Sheet } from './ui/Sheet';

interface BottomNavProps {
  currentView: string;
  onChangeView: (view: 'home' | 'profile' | 'chat-list') => void;
  onSellClick: () => void;
  // cart removed - direct purchase model
  unreadCount: number;
  orderCount: number;
  locationInfo?: DetailedLocationInfo | null;
  user?: { avatar: string; name: string } | null;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onChangeView,
  onSellClick,
  unreadCount,
  orderCount,
  locationInfo,
  user
}) => {
  const { t } = useLanguage();
  const { region, setRegion } = useRegion();
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);


  const currentRegion = REGIONS.find(r => r.code === region) || REGIONS[0];

  return (
    <>
      {/* Region Selection Modal */}
      <Sheet
        open={isRegionModalOpen}
        onClose={() => setIsRegionModalOpen(false)}
        variant="bottom"
        size="md"
        title={
          <span className="flex items-center gap-2">
            <Globe size={20} className="text-brand-600" />
            {t('region.select')}
          </span>
        }
      >
        {/* Current Location */}
        {locationInfo && (
          <div className="mb-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin size={16} className="text-brand-600" />
              <span className="text-sm font-medium">
                {t('region.current_location')}: {locationInfo.displayName}
              </span>
            </div>
          </div>
        )}

        {/* Region List */}
        <div className="space-y-2">
          {REGIONS.map((r) => (
            <button
              key={r.code}
              onClick={() => {
                setRegion(r.code);
                setIsRegionModalOpen(false);
              }}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-colors ${region === r.code
                ? 'bg-brand-50 border-brand-300'
                : 'bg-white border-gray-100 hover:border-brand-100 hover:bg-brand-50/40'
                }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{r.flag}</span>
                <div className="text-left">
                  <div className="font-bold text-gray-900">{r.name}</div>
                  <div className="text-xs text-gray-500">{t('region.currency')}: {r.currency}</div>
                </div>
              </div>
              {region === r.code && (
                <div className="w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center">
                  <Check size={14} className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-nav pb-safe">
        {/* Single Navigation Bar with 4 buttons */}
        <div className="bg-white/95 backdrop-blur-xl border-t border-gray-100 px-2 pb-2 pt-2">
          <div className="flex items-center justify-around relative">
            {/* 1. Home Button */}
            <button
              onClick={() => onChangeView('home')}
              className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 active:scale-95 min-w-[60px] ${currentView === 'home' ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Home size={22} strokeWidth={currentView === 'home' ? 2.5 : 2} fill={currentView === 'home' ? "currentColor" : "none"} />
              <span className="text-[10px] font-bold">{t('nav.home')}</span>
            </button>

            {/* 2. Location Button - Now opens modal */}
            <button
              onClick={() => setIsRegionModalOpen(true)}
              className="flex flex-col items-center justify-center gap-1 transition-all duration-300 active:scale-95 min-w-[60px] text-gray-500 hover:text-gray-700"
            >
              <div className="relative">
                <MapPin size={22} strokeWidth={2} />
                <span className="absolute -top-1.5 -right-2.5 text-[11px] leading-none">{currentRegion.flag}</span>
              </div>
              <span className="text-[10px] font-bold truncate max-w-[72px]">
                {locationInfo?.city || currentRegion.name}
              </span>
            </button>

            {/* 3. Floating Action Button (FAB) - Centered. Hidden on the product page, whose own CTA bar sits right above the nav. */}
            <div className={`absolute left-1/2 -translate-x-1/2 -top-7 ${currentView === 'product' ? 'hidden' : ''}`}>
              <button
                onClick={onSellClick}
                aria-label={t('nav.sell')}
                className="w-14 h-14 bg-brand-600 hover:bg-brand-700 rounded-full flex items-center justify-center shadow-lg shadow-brand-500/40 text-white transition-all active:scale-90 border-4 border-white"
              >
                <Plus size={28} strokeWidth={2.5} />
              </button>
            </div>

            {/* 4. Notifications/Reminders Button */}
            <button
              onClick={() => onChangeView('chat-list')}
              className={`flex flex-col items-center justify-center gap-1 relative transition-all duration-300 active:scale-95 min-w-[60px] ${currentView === 'chat-list' ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <div className="relative">
                <MessageCircle size={22} strokeWidth={currentView === 'chat-list' ? 2.5 : 2} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-brand-600 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full ring-2 ring-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold">{t('nav.chat')}</span>
            </button>

            {/* 5. Profile Button */}
            <button
              onClick={() => onChangeView('profile')}
              className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 active:scale-95 min-w-[60px] ${currentView === 'profile' ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <div className="relative">
                {user ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className={`w-6 h-6 rounded-full object-cover ring-2 ${currentView === 'profile' ? 'ring-brand-500' : 'ring-gray-200'
                      }`}
                  />
                ) : (
                  <UserIcon size={22} strokeWidth={currentView === 'profile' ? 2.5 : 2} fill={currentView === 'profile' ? "currentColor" : "none"} />
                )}
                {/* Orders waiting on the user (ship / confirm receipt / confirm meetup) */}
                {orderCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-brand-600 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full ring-2 ring-white">
                    {orderCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold">{t('nav.profile')}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
