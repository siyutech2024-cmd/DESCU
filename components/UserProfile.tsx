import React, { useState, useRef } from 'react';
import OrderList from './OrderList';
import { ArrowLeft, Camera, Save, Check, Grid, ShoppingBag, ShieldCheck, Zap, Upload, Loader2, FileText, Scale, ExternalLink, CreditCard } from 'lucide-react';
import { User, Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { getFullDataUrl } from '../services/utils';
import { API_BASE_URL } from '../services/apiConfig';

interface UserProfileProps {
  user: User;
  userProducts: Product[];
  onUpdateUser: (updatedUser: User) => void;
  onBack: () => void;
  onProductClick: (product: Product) => void;
  onVerifyUser?: () => void;
  onBoostProduct?: (productId: string) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  user,
  userProducts,
  onUpdateUser,
  onBack,
  onProductClick,
  onVerifyUser,
  onBoostProduct
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar);
  const [isSaved, setIsSaved] = useState(false);
  const [isUploadingID, setIsUploadingID] = useState(false);
  const [activeTab, setActiveTab] = useState<'listings' | 'buying' | 'selling'>('listings');
  const [orders, setOrders] = useState<any[]>([]);
  // orders would be fetched based on tab. Simplification: fetching in useEffect when tab changes.

  const fileInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const url = await getFullDataUrl(e.target.files[0]);
        setAvatar(url);
      } catch (err) {
        console.error("Failed to load image", err);
      }
    }
  };

  const [isPayoutLoading, setIsPayoutLoading] = useState(false);

  const handleSetupPayouts = async () => {
    setIsPayoutLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/payment/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No onboarding url returned', data);
        alert('Failed to start onboarding');
        setIsPayoutLoading(false);
      }
    } catch (error) {
      console.error('Error starting payouts setup:', error);
      setIsPayoutLoading(false);
    }
  };

  const handleDashboard = async () => {
    // For verified sellers to see their dashboard
    try {
      const response = await fetch(`${API_BASE_URL}/api/payment/dashboard/${user.id}`);
      const data = await response.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error("Error fetching dashboard link", error);
    }
  };

  const handleIDUpload = () => {
    setIsUploadingID(true);
    setTimeout(() => {
      setIsUploadingID(false);
      if (onVerifyUser) onVerifyUser();
    }, 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({ ...user, name, avatar });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 pt-4">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{t('profile.title')}</h1>
        </div>

        {/* Profile Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center">
              <div
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-50 shadow-md">
                  <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                </div>
                <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="text-white" size={24} />
                </div>
                {user.isVerified && (
                  <div className="absolute bottom-0 right-0 bg-blue-500 text-white p-1 rounded-full border-2 border-white">
                    <ShieldCheck size={16} />
                  </div>
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              </div>
              <p className="text-xs text-gray-400 mt-2">{t('profile.change_avatar')}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.name')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.email')}</label>
                <input type="text" value={user.email} disabled className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed" />
              </div>
            </div>

            <button
              type="submit"
              className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${isSaved ? 'bg-green-500 text-white shadow-green-200' : 'bg-brand-600 text-white hover:bg-brand-700 shadow-brand-200 shadow-lg'
                }`}
            >
              {isSaved ? <><Check size={20} /> {t('profile.saved')}</> : <><Save size={20} /> {t('profile.save')}</>}
            </button>
          </form>
        </div>

        {/* Tabs (Moved Up) */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('listings')}
            className={`flex-1 pb-3 text-sm font-bold transition-colors ${activeTab === 'listings' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('profile.listings')}
          </button>
          <button
            onClick={() => setActiveTab('buying')}
            className={`flex-1 pb-3 text-sm font-bold transition-colors ${activeTab === 'buying' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('profile.buying') || 'My Orders'}
          </button>
          <button
            onClick={() => setActiveTab('selling')}
            className={`flex-1 pb-3 text-sm font-bold transition-colors ${activeTab === 'selling' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('profile.selling') || 'Sales'}
          </button>
        </div>





        {/* Content Area */}
        {activeTab === 'listings' && (
          userProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {userProducts.map(product => (
                <div
                  key={product.id}
                  className={`bg-white rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-all relative ${product.isPromoted ? 'border-yellow-400' : 'border-gray-100'}`}
                >
                  <div onClick={() => onProductClick(product)} className="aspect-square bg-gray-100 cursor-pointer">
                    <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-gray-900 line-clamp-1">{product.title}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <p className="font-bold text-red-500">¥{product.price}</p>
                      {!product.isPromoted && onBoostProduct && (
                        <button
                          onClick={() => onBoostProduct(product.id)}
                          className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200 transition-colors flex items-center gap-1"
                        >
                          <Zap size={10} />
                          {t('profile.boost')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
              <ShoppingBag size={48} className="mx-auto mb-3 opacity-20" />
              <p>{t('profile.no_listings')}</p>
            </div>
          )
        )}

        {/* New Order Lists */}
        {activeTab === 'buying' && <div className="min-h-[200px]"><OrderList role="buyer" /></div>}
        {activeTab === 'selling' && <div className="min-h-[200px]"><OrderList role="seller" /></div>}

        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Settings & Account</h3>

          {/* Payouts / Seller Dashboard Section */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard size={20} className="text-green-600" />
              {t('profile.payouts') || 'Payouts & Earnings'}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {t('profile.payouts_desc') || 'Connect your bank account to receive payments directly just like a professional store.'}
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleSetupPayouts}
                disabled={isPayoutLoading}
                className="flex-1 bg-gray-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-black transition-colors"
              >
                {isPayoutLoading ? <Loader2 size={18} className="animate-spin" /> : <ExternalLink size={18} />}
                {t('profile.setup_payouts') || 'Setup Payouts'}
              </button>
            </div>
          </div>

          {/* Verification Banner */}
          <div className={`rounded-xl p-5 mb-8 border transition-all ${user.isVerified ? 'bg-blue-50 border-blue-100' : 'bg-gray-100 border-gray-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${user.isVerified ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-400'}`}>
                <ShieldCheck size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{user.isVerified ? t('profile.is_verified') : t('profile.verify_title')}</h3>
                <p className="text-sm text-gray-500 mt-1 mb-3">{t('profile.verify_desc')}</p>

                {!user.isVerified && onVerifyUser && (
                  <div>
                    <input type="file" ref={idInputRef} className="hidden" accept="image/*,.pdf" onChange={handleIDUpload} />
                    <button
                      onClick={() => idInputRef.current?.click()}
                      disabled={isUploadingID}
                      className="bg-white border border-gray-300 hover:border-blue-500 hover:text-blue-600 text-gray-700 text-sm font-bold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                    >
                      {isUploadingID ? <><Loader2 size={16} className="animate-spin" /> {t('profile.verifying')}</> : <><FileText size={16} /> {t('profile.get_verified')}</>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Safety & Policies - Google Play Compliance */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Scale size={20} className="text-brand-600" />
              {t('profile.safety_policies')}
            </h2>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <span className="text-sm font-semibold text-gray-700">{t('profile.content_policy')}</span>
                <ExternalLink size={16} className="text-gray-400" />
              </button>
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                <p className="text-[11px] text-blue-800 leading-relaxed italic">
                  DESCU adheres to strict safety guidelines regarding political misinformation and hate speech to ensure a healthy neighborhood marketplace.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
