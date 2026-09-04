import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Check, ShoppingBag, ShieldCheck, Zap, Upload, Loader2, Star, Heart, Lock, ChevronRight, Package, Tag } from 'lucide-react';
import { SellerPayoutCard } from '@/features/orders/components/SellerPayoutCard';
import { CreditBadge } from './CreditBadge';
import { User, Product } from '@/types';
import { useLanguage } from '@/i18n';
import { useRegion } from '@/contexts/RegionContext';
import { compressImage } from '@/services/utils';
import { notify } from '@/lib/toast';
import { api } from '@/lib/api/client';
import { markProductAsSold, relistProduct, uploadAvatarImage } from '@/services/supabase';
import { getUserRatingStats, EMPTY_RATING_STATS } from '@/services/ratingService';
import { Button, Card, Chip, EmptyState, Eyebrow, Field, IconButton, inputClass, type ChipTone } from '@/components/ui/primitives';
import { ConfirmSheet } from '@/components/ui/Sheet';

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

const PAGE = 6;

export const UserProfile: React.FC<UserProfileProps> = ({ user, userProducts, onUpdateUser, onBack, onProductClick, onBoostProduct, favorites = new Set(), allProducts = [] }) => {
  const { t } = useLanguage();
  const { formatCurrency } = useRegion();
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar);
  const [isSaved, setIsSaved] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<'listings' | 'favorites'>('listings');
  const [listingsLimit, setListingsLimit] = useState(PAGE);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Optimistic status overrides after "mark sold" / "relist"
  const [soldProducts, setSoldProducts] = useState<Set<string>>(new Set());
  const [relistedProducts, setRelistedProducts] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [relistTarget, setRelistTarget] = useState<Product | null>(null);

  const [ratingStats, setRatingStats] = useState(EMPTY_RATING_STATS);
  const [creditScore, setCreditScore] = useState(0);

  useEffect(() => {
    getUserRatingStats(user.id).then(setRatingStats).catch(() => undefined);
    api.get<{ score?: number }>(`/api/users/${user.id}/credit`).then(d => setCreditScore(d?.score || 0)).catch(console.error);
  }, [user.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('onboarding_success')) {
      notify.success(t('payout.connected'));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [t]);

  const favoriteProducts = allProducts.filter(p => favorites.has(p.id));

  const handleMarkAsSold = async (productId: string) => {
    setBusyId(productId);
    const ok = await markProductAsSold(productId);
    if (ok) {
      setSoldProducts(prev => new Set(prev).add(productId));
      setRelistedProducts(prev => { const n = new Set(prev); n.delete(productId); return n; });
      notify.success(t('product.marked_sold'));
    } else {
      notify.error(t('toast.action_failed'));
    }
    setBusyId(null);
  };

  const handleRelist = async () => {
    if (!relistTarget) return;
    const productId = relistTarget.id;
    setRelistTarget(null);
    setBusyId(productId);
    const ok = await relistProduct(productId);
    if (ok) {
      setRelistedProducts(prev => new Set(prev).add(productId));
      setSoldProducts(prev => { const n = new Set(prev); n.delete(productId); return n; });
      notify.success(t('product.relisted'));
    } else {
      notify.error(t('toast.action_failed'));
    }
    setBusyId(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      // Compress and upload to Storage — never a data URL (it would end up inside every JWT).
      const compressed = await compressImage(file, 512, 0.8, 120);
      const url = await uploadAvatarImage(compressed, user.id);
      if (!url) throw new Error('upload failed');
      setAvatar(url);
      onUpdateUser({ ...user, avatar: url });
    } catch (err) {
      console.error('Failed to upload avatar', err);
      notify.error(t('toast.upload_failed'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onUpdateUser({ ...user, name: trimmed, avatar });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  /** Effective status after optimistic overrides. */
  const statusOf = (p: Product): Product['status'] | 'relisted' => {
    if (relistedProducts.has(p.id)) return 'relisted';
    if (soldProducts.has(p.id)) return 'sold';
    return p.status ?? 'active';
  };
  const statusChip = (status: ReturnType<typeof statusOf>): { text: string; tone: ChipTone } | null => {
    switch (status) {
      case 'active': return null;
      case 'sold': return { text: t('product.sold'), tone: 'success' };
      case 'pending_review':
      case 'relisted': return { text: t('product.pending_review'), tone: 'warning' };
      case 'rejected': return { text: t('product.rejected'), tone: 'danger' };
      case 'inactive': return { text: t('product.inactive'), tone: 'neutral' };
      default: return { text: t('product.unavailable'), tone: 'neutral' };
    }
  };

  const tabs = [
    { key: 'listings' as const, label: t('profile.listings'), icon: <Tag size={14} />, count: userProducts.length },
    { key: 'favorites' as const, label: t('nav.favorites'), icon: <Heart size={14} />, count: favorites.size },
  ];

  const renderTile = (product: Product, mine: boolean) => {
    const status = statusOf(product);
    const chip = statusChip(status);
    const busy = busyId === product.id;
    return (
      <Card key={product.id} padding={false} className="overflow-hidden flex flex-col">
        <button type="button" onClick={() => onProductClick(product)} className="relative aspect-square bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200">
          <img src={product.images[0]} alt="" className={`w-full h-full object-cover ${status === 'sold' ? 'grayscale opacity-70' : ''}`} loading="lazy" />
          {chip && <Chip tone={chip.tone} className="absolute left-2 top-2 shadow-sm">{chip.text}</Chip>}
          {product.isPromoted && <Chip tone="warning" icon={<Zap size={10} className="fill-current" />} className="absolute right-2 top-2 shadow-sm">{t('card.promoted')}</Chip>}
        </button>
        <div className="p-3 flex flex-col gap-2 flex-1">
          <p className="text-sm font-bold text-gray-900 line-clamp-1">{product.title}</p>
          <p className="font-black text-gray-900 tabular-nums">{formatCurrency(product.price, product.currency || 'MXN')}</p>
          {mine && (
            <div className="mt-auto flex flex-wrap gap-1.5">
              {status === 'active' && (
                <Button size="sm" variant="subtle" loading={busy} icon={<Check size={14} />} onClick={() => handleMarkAsSold(product.id)}>{t('product.mark_sold')}</Button>
              )}
              {status === 'active' && !product.isPromoted && onBoostProduct && (
                <Button size="sm" variant="secondary" icon={<Zap size={14} />} onClick={() => onBoostProduct(product.id)}>{t('profile.boost')}</Button>
              )}
              {status === 'sold' && (
                <Button size="sm" variant="secondary" loading={busy} icon={<Upload size={14} />} onClick={() => setRelistTarget(product)}>{t('product.relist')}</Button>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="max-w-3xl mx-auto w-full px-4 pt-4 pb-10 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <IconButton onClick={onBack} aria-label={t('detail.back')} className="-ml-2"><ArrowLeft size={22} /></IconButton>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('profile.title')}</h1>
      </div>

      {/* Identity */}
      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="relative group flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200" aria-label={t('profile.change_avatar')}>
            <img src={avatar} alt="" className="w-20 h-20 rounded-full object-cover bg-gray-100 ring-4 ring-white shadow-md" />
            <span className={`absolute inset-0 rounded-full bg-black/35 flex items-center justify-center text-white transition-opacity ${isUploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              {isUploadingAvatar ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
            </span>
            {user.isVerified && <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center ring-2 ring-white"><ShieldCheck size={13} /></span>}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-black text-gray-900 truncate">{user.name}</p>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-sm font-bold text-gray-700">
                <Star size={14} className="fill-yellow-400 text-yellow-400" />
                {ratingStats.total_reviews > 0 ? `${Number(ratingStats.average_rating).toFixed(1)} · ${ratingStats.total_reviews} ${t('profile.reviews')}` : t('rating.no_reviews')}
              </span>
              <CreditBadge score={creditScore} size="md" showLabel showScore />
            </div>
          </div>
        </div>
      </Card>

      {/* Orders shortcuts */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {(['buyer', 'seller'] as const).map(role => (
          <button key={role} type="button" onClick={() => navigate(`/orders?role=${role}`)} className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 shadow-sm p-3.5 text-left hover:border-brand-200 hover:shadow-md transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200">
            <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">{role === 'buyer' ? <ShoppingBag size={18} /> : <Package size={18} />}</span>
            <span className="flex-1 min-w-0 text-sm font-bold text-gray-900 truncate">{role === 'buyer' ? t('profile.buying') : t('profile.selling')}</span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        ))}
      </div>

      {/* Listings / favourites */}
      <div className="flex gap-2 mb-4" role="tablist">
        {tabs.map(tab => {
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} role="tab" aria-selected={active} onClick={() => setActiveTab(tab.key)} className={`h-10 px-4 rounded-full text-sm font-bold inline-flex items-center gap-1.5 border transition-colors ${active ? 'bg-brand-600 text-white border-brand-600 shadow-sm shadow-brand-500/25' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-200 hover:text-brand-700'}`}>
              {tab.icon}{tab.label}
              <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${active ? 'bg-white/25' : 'bg-gray-100 text-gray-500'}`}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'listings' && (
        userProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{userProducts.slice(0, listingsLimit).map(p => renderTile(p, true))}</div>
            {userProducts.length > listingsLimit && (
              <Button variant="secondary" block className="mt-4" onClick={() => setListingsLimit(n => n + PAGE)}>{t('list.load_more')} ({userProducts.length - listingsLimit})</Button>
            )}
            {listingsLimit > PAGE && userProducts.length <= listingsLimit && (
              <Button variant="ghost" block className="mt-2 text-gray-500" onClick={() => setListingsLimit(PAGE)}>{t('profile.collapse')}</Button>
            )}
          </>
        ) : (
          <EmptyState icon={<Tag size={26} />} title={t('profile.no_listings')} className="bg-white rounded-2xl border border-gray-100" />
        )
      )}

      {activeTab === 'favorites' && (
        favoriteProducts.length > 0
          ? <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{favoriteProducts.map(p => renderTile(p, false))}</div>
          : <EmptyState icon={<Heart size={26} />} title={t('profile.no_favorites')} hint={t('profile.no_favorites_hint')} className="bg-white rounded-2xl border border-gray-100" />
      )}

      {/* Settings */}
      <section className="mt-10 space-y-4">
        <Eyebrow>{t('profile.settings')}</Eyebrow>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={t('profile.name')} htmlFor="profile-name">
              <input id="profile-name" type="text" value={name} onChange={e => setName(e.target.value)} maxLength={60} className={inputClass} />
            </Field>
            <Field label={t('profile.email')} htmlFor="profile-email">
              <input id="profile-email" type="email" value={user.email} disabled className={inputClass} />
            </Field>
            <Button type="submit" block disabled={!name.trim() || name.trim() === user.name} icon={isSaved ? <Check size={18} /> : undefined} className={isSaved ? '!bg-green-600' : ''}>
              {isSaved ? t('profile.saved') : t('profile.save')}
            </Button>
          </form>
        </Card>

        <SellerPayoutCard userId={user.id} />

        <Card className="flex items-start gap-3">
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${user.isVerified ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}><ShieldCheck size={20} /></span>
          <div className="min-w-0">
            <p className="font-bold text-gray-900">{user.isVerified ? t('profile.is_verified') : t('profile.verify_title')}</p>
            <p className="text-sm text-gray-500 mt-0.5">{t('profile.verify_desc')}</p>
          </div>
        </Card>

        <Card padding={false}>
          <button type="button" onClick={() => navigate('/privacy-policy')} className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 rounded-2xl transition-colors">
            <span className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0"><Lock size={18} /></span>
            <span className="flex-1 text-sm font-bold text-gray-900">{t('profile.privacy_policy')}</span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        </Card>
      </section>

      <ConfirmSheet
        open={!!relistTarget}
        onClose={() => setRelistTarget(null)}
        onConfirm={handleRelist}
        title={t('product.relist')}
        description={t('product.relist_confirm')}
        confirmLabel={t('product.relist')}
        cancelLabel={t('chat.cancel')}
        icon={<Upload size={20} />}
      />
    </div>
  );
};
