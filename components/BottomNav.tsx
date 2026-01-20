
import React from 'react';
import { Home, PlusCircle, User as UserIcon, MessageCircle, MapPin, Bell } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { DetailedLocationInfo } from '../services/locationService';

interface BottomNavProps {
  currentView: string;
  onChangeView: (view: 'home' | 'profile' | 'chat-list') => void;
  onSellClick: () => void;
  // cart removed - direct purchase model
  unreadCount: number;
  orderCount: number;
  locationInfo?: DetailedLocationInfo | null;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onChangeView,
  onSellClick,
  unreadCount,
  orderCount,
  locationInfo
}) => {
  const { t } = useLanguage();

  const totalNotifications = unreadCount + orderCount;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe">
      {/* Single Navigation Bar with 4 buttons */}
      <div className="bg-white/95 backdrop-blur-xl border-t border-gray-200/50 shadow-glass-lg px-4 pb-3 pt-3">
        <div className="flex items-center justify-around relative">
          {/* 1. Home Button */}
          <button
            onClick={() => onChangeView('home')}
            className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 active:scale-95 min-w-[60px] ${currentView === 'home' ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Home size={22} strokeWidth={currentView === 'home' ? 2.5 : 2} fill={currentView === 'home' ? "currentColor" : "none"} />
            <span className="text-[10px] font-bold">Home</span>
          </button>

          {/* 2. Location Button */}
          <button
            className="flex flex-col items-center justify-center gap-1 transition-all duration-300 active:scale-95 min-w-[60px] text-gray-500 hover:text-gray-700"
          >
            <MapPin size={22} strokeWidth={2} className="text-brand-600" />
            <span className="text-[9px] font-medium truncate max-w-[70px]">
              {locationInfo?.displayName || '位置'}
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
            className="flex flex-col items-center justify-center gap-1 relative transition-all duration-300 active:scale-95 min-w-[60px] text-gray-500 hover:text-gray-700"
          >
            <div className="relative">
              <Bell size={22} strokeWidth={2} className={totalNotifications > 0 ? "text-orange-600" : ""} />
              {totalNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full ring-2 ring-white animate-pulse">
                  {totalNotifications}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold">提醒</span>
          </button>

          {/* 5. Profile Button */}
          <button
            onClick={() => onChangeView('profile')}
            className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 active:scale-95 min-w-[60px] ${currentView === 'profile' ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <UserIcon size={22} strokeWidth={currentView === 'profile' ? 2.5 : 2} fill={currentView === 'profile' ? "currentColor" : "none"} />
            <span className="text-[10px] font-bold">Me</span>
          </button>
        </div>
      </div>
    </div>
  );
};

