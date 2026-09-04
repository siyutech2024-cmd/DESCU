import React from 'react';
import { LogIn } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { useAuth } from '@/features/auth';

interface SignedOutPlaceholderProps {
  /** i18n key for the one-line hint under the title (e.g. `auth.signed_out_hint_profile`). */
  hintKey: string;
  /** Icon shown above the title; defaults to a login icon. */
  icon?: LucideIcon;
}

/**
 * Empty state shown on auth-gated pages when nobody is signed in.
 * The button opens the shared login modal from `AuthProvider`.
 */
export const SignedOutPlaceholder: React.FC<SignedOutPlaceholderProps> = ({ hintKey, icon: Icon = LogIn }) => {
  const { t } = useLanguage();
  const { openLoginModal } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mb-4 shadow-sm">
        <Icon size={28} aria-hidden="true" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">{t('auth.signed_out_title')}</h2>
      <p className="text-sm text-gray-500 max-w-xs mb-6">{t(hintKey)}</p>
      <button
        type="button"
        onClick={openLoginModal}
        className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-3 rounded-full font-bold shadow-lg transition-colors"
      >
        {t('nav.login')}
      </button>
    </div>
  );
};
