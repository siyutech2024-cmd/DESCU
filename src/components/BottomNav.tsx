
import React, { useState } from 'react';
import { Home, PlusCircle, User as UserIcon, MapPin, Bell, Globe, Check } from 'lucide-react';
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
          <div className="-mx-5 mb-3 px-4 py-3 bg-blue-50 border-y border-blue-100">
            <div className="flex items-center gap-2 text-blue-700">
              <MapPin size={16} />
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
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${region === r.code
                ? 'bg-brand-50 border-2 border-brand-500'
                : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
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
        <div className="bg-white/95 backdrop-blur-xl border-t border-gray-200/50 shadow-glass-lg px-4 pb-3 pt-3">
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
                <MapPin size={22} strokeWidth={2} className="text-brand-600" />
                <span className="absolute -top-1 -right-2 text-[10px]">{currentRegion.flag}</span>
              </div>
              <span className="text-[9px] font-medium truncate max-w-[70px]">
                {locationInfo?.displayName || currentRegion.name}
              </span>
            </button>

            {/* 3. Floating Action Button (FAB) - Centered */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-8">
              <button
                onClick={onSellClick}
                className="w-16 h-16 bg-gradient-to-tr from-brand-600 to-brand-400 rounded-full flex items-center justify-center shadow-xl shadow-brand-500/40 text-white transform transition-all active:scale-90 hover:scale-110 border-4 border-white ring-1 ring-black/5"
              >
                <PlusCircle size={32} strokeWidth={2} />
              </button>
            </div>

            {/* 4. Notifications/Reminders Button */}
            <button
              onClick={() => onChangeView('chat-list')}
              className={`flex flex-col items-center justify-center gap-1 relative transition-all duration-300 active:scale-95 min-w-[60px] ${currentView === 'chat-list' ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <div className="relative">
                <Bell size={22} strokeWidth={2} className={unreadCount > 0 ? "text-orange-600" : ""} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold">{t('nav.notifications')}</span>
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
                    className={`w-6 h-6 rounded-full object-cover border-2 ${currentView === 'profile' ? 'border-brand-500' : 'border-gray-300'
                      }`}
                  />
                ) : (
                  <UserIcon size={22} strokeWidth={currentView === 'profile' ? 2.5 : 2} fill={currentView === 'profile' ? "currentColor" : "none"} />
                )}
                {/* Orders waiting on the user (ship / confirm receipt / confirm meetup) */}
                {orderCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full ring-2 ring-white">
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
