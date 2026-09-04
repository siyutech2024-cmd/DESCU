import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SellerPayoutCard } from '@/features/orders/components/SellerPayoutCard';
import { CreditBadge } from './CreditBadge';
import { ArrowLeft, Camera, Save, Check, ShoppingBag, ShieldCheck, Zap, Upload, Loader2, Scale, ExternalLink, Star, Heart, Lock } from 'lucide-react';
import { User, Product } from '@/types';
import { useLanguage } from '@/i18n';
import { compressImage } from '@/services/utils';
import { notify } from '@/lib/toast';
import { api } from '@/lib/api/client';
import { markProductAsSold, relistProduct, uploadAvatarImage } from '@/services/supabase';

interface UserProfileProps {
  user: User;
  userProducts: Product[];
  onUpdateUser: (updatedUser: User) => void;
  onBack: () => void;
  onProductClick: (product: Product) => void;
  onVerifyUser?: () => void;
  onBoostProduct?: (productId: string) => void;
  favorites?: Set<string>;
  allProducts?: Product[];
}

export const UserProfile: React.FC<UserProfileProps> = ({
  user,
  userProducts,
  onUpdateUser,
  onBack,
  onProductClick,
  onVerifyUser,
  onBoostProduct,
  favorites = new Set(),
  allProducts = []
}) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar);
  const [isSaved, setIsSaved] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<'listings' | 'favorites'>('listings');
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [listingsLimit, setListingsLimit] = useState(6); // 商品列表分页限制

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [soldProducts, setSoldProducts] = useState<Set<string>>(new Set());
  const [markingSoldId, setMarkingSoldId] = useState<string | null>(null);

  const handleMarkAsSold = async (productId: string) => {
    setMarkingSoldId(productId);
    const success = await markProductAsSold(productId);
    if (success) {
      setSoldProducts(prev => new Set(prev).add(productId));
      setRelistedProducts(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    } else {
      alert('Failed to mark as sold');
    }
    setMarkingSoldId(null);
  };

  // 重新上架状态
  const [relistedProducts, setRelistedProducts] = useState<Set<string>>(new Set());
  const [relistingId, setRelistingId] = useState<string | null>(null);

  const handleRelist = async (productId: string) => {
    const confirmed = window.confirm(t('product.relist_confirm'));
    if (!confirmed) return;

    setRelistingId(productId);
    const success = await relistProduct(productId);
    if (success) {
      setRelistedProducts(prev => new Set(prev).add(productId));
      setSoldProducts(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    } else {
      alert('Failed to relist product');
    }
    setRelistingId(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      // Compress and upload to Storage. Never store a data-URL: the avatar ends up in
      // auth user_metadata (i.e. inside every JWT), and a base64 image there breaks all
      // authenticated requests with oversized headers.
      const compressed = await compressImage(file, 512, 0.8, 120);
      const url = await uploadAvatarImage(compressed, user.id);
      if (!url) throw new Error('upload failed');
      setAvatar(url);
    } catch (err) {
      console.error('Failed to upload avatar', err);
      notify.error(t('toast.upload_failed'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const [ratingStats, setRatingStats] = useState({ total_reviews: 0, average_rating: 0 });
  const [creditScore, setCreditScore] = useState<number>(0);

  // Load Rating Stats & Credit Score
  useEffect(() => {
    // Ratings
    import('@/services/ratingService').then(({ getUserRatingStats }) => {
      getUserRatingStats(user.id).then(setRatingStats);
    });

    // Credit Score
    api.get<{ score?: number }>(`/api/users/${user.id}/credit`)
      .then(data => setCreditScore(data?.score || 0))
      .catch(console.error);
  }, [user.id]);

  // Load Favorite Products
  useEffect(() => {
    const favProds = allProducts.filter(p => favorites.has(p.id));
    setFavoriteProducts(favProds);
  }, [favorites, allProducts]);

  // Check for onboarding params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('onboarding_success')) {
      alert('Stripe account connected successfully!');
      // Clear params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({ ...user, name, avatar });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-4">
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
                <div className={`absolute inset-0 bg-black/30 rounded-full flex items-center justify-center transition-opacity ${isUploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {isUploadingAvatar ? <Loader2 className="text-white animate-spin" size={24} /> : <Camera className="text-white" size={24} />}
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

            {/* Reputation / Rating Card */}
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex text-yellow-500">
                  <Star size={16} fill="currentColor" />
                </div>
                <span className="font-bold text-gray-900">{ratingStats.average_rating ? Number(ratingStats.average_rating).toFixed(1) : 'New'}</span>
                <span className="text-gray-300">|</span>
                <CreditBadge score={creditScore} showLabel />
              </div>
              <span className="text-xs font-bold text-orange-600 bg-white px-2 py-1 rounded-full shadow-sm">
                {ratingStats.total_reviews} {t('profile.reviews')}
              </span>
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
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 pb-3 text-sm font-bold transition-colors flex items-center justify-center gap-1 ${activeTab === 'favorites' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Heart size={14} />
            {t('nav.favorites') || 'Favorites'} ({favorites.size})
          </button>
          <button
            onClick={() => navigate('/orders?role=buyer')}
            className="flex-1 pb-3 text-sm font-bold transition-colors text-gray-500 hover:text-gray-700"
          >
            {t('profile.buying')}
          </button>
          <button
            onClick={() => navigate('/orders?role=seller')}
            className="flex-1 pb-3 text-sm font-bold transition-colors text-gray-500 hover:text-gray-700"
          >
            {t('profile.selling')}
          </button>
        </div>





        {/* Content Area */}
        {activeTab === 'listings' && (
          userProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                {userProducts.slice(0, listingsLimit).map(product => (
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
                        <p className="font-bold text-red-500">${product.price}</p>
                        {/* 标记已售出按钮 */}
                        {(product.status === 'active' && !soldProducts.has(product.id)) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsSold(product.id);
                            }}
                            disabled={markingSoldId === product.id}
                            className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200 transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            {markingSoldId === product.id ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <Check size={10} />
                            )}
                            {t('product.mark_sold')}
                          </button>
                        )}
                        {!product.isPromoted && onBoostProduct && product.status === 'active' && !soldProducts.has(product.id) && (
                          <button
                            onClick={() => onBoostProduct(product.id)}
                            className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200 transition-colors flex items-center gap-1"
                          >
                            <Zap size={10} />
                            {t('profile.boost')}
                          </button>
                        )}
                        {/* 状态标签 */}
                        {((product.status && product.status !== 'active') || soldProducts.has(product.id) || relistedProducts.has(product.id)) && (
                          <div className="flex flex-col gap-1">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1
                            ${(product.status === 'pending_review' || relistedProducts.has(product.id)) ? 'bg-orange-100 text-orange-700' :
                                product.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                  (product.status === 'sold' || soldProducts.has(product.id)) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                              <Check size={10} />
                              {(product.status === 'pending_review' || relistedProducts.has(product.id)) ? t('product.pending_review') :
                                product.status === 'rejected' ? t('product.rejected') :
                                  (product.status === 'sold' || soldProducts.has(product.id)) ? t('product.sold') : product.status}
                            </span>
                            {/* 重新上架按钮 - 仅已售出产品可见 */}
                            {((product.status === 'sold' || soldProducts.has(product.id)) && !relistedProducts.has(product.id)) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRelist(product.id);
                                }}
                                disabled={relistingId === product.id}
                                className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors flex items-center gap-1 disabled:opacity-50"
                              >
                                {relistingId === product.id ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <Upload size={10} />
                                )}
                                {t('product.relist')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* 显示更多按钮 */}
              {userProducts.length > listingsLimit && (
                <button
                  onClick={() => setListingsLimit(prev => prev + 6)}
                  className="w-full mt-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {t('list.load_more') || '加载更多'} ({userProducts.length - listingsLimit} {t('list.items_count') || '件'})
                </button>
              )}
              {/* 收起按钮 */}
              {listingsLimit > 6 && userProducts.length <= listingsLimit && (
                <button
                  onClick={() => setListingsLimit(6)}
                  className="w-full mt-4 py-2 text-gray-400 hover:text-gray-600 font-medium text-sm transition-colors"
                >
                  {t('profile.collapse')}
                </button>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
              <ShoppingBag size={48} className="mx-auto mb-3 opacity-20" />
              <p>{t('profile.no_listings')}</p>
            </div>
          )
        )}

        {/* Favorites Tab */}
        {activeTab === 'favorites' && (
          favoriteProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {favoriteProducts.map(product => (
                <div
                  key={product.id}
                  onClick={() => onProductClick(product)}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer relative"
                >
                  <div className="aspect-square bg-gray-100">
                    <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-gray-900 line-clamp-1">{product.title}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <p className="font-bold text-red-500">${product.price}</p>
                      <Heart size={16} className="text-red-500" fill="currentColor" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
              <Heart size={48} className="mx-auto mb-3 opacity-20" />
              <p>{t('profile.no_favorites') || 'No favorites yet'}</p>
              <p className="text-xs mt-2">Tap the heart icon on products to save them here</p>
            </div>
          )
        )}


        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{t('profile.settings')}</h3>

          {/* Stripe Express Payout Section */}
          <SellerPayoutCard userId={user.id} />

          {/* Verification Banner */}
          <div className={`rounded-xl p-5 mb-8 border transition-all ${user.isVerified ? 'bg-blue-50 border-blue-100' : 'bg-gray-100 border-gray-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${user.isVerified ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-400'}`}>
                <ShieldCheck size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{user.isVerified ? t('profile.is_verified') : t('profile.verify_title')}</h3>
                <p className="text-sm text-gray-500 mt-1 mb-3">{t('profile.verify_desc')}</p>

                {/* Verification is granted by the DESCU team after review; there is no self-service flow. */}
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
              <button
                onClick={() => navigate('/privacy-policy')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Lock size={16} className="text-gray-400" />
                  {t('profile.privacy_policy') || 'Privacy Policy / 隐私政策'}
                </span>
                <ExternalLink size={16} className="text-gray-400" />
              </button>
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

        {/* Bank info form is now inline above */}

      </div>
    </div >
  );
};
