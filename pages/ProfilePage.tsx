
import React from 'react';
import { User, Product } from '../types';
import { UserProfile } from '../components/UserProfile';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

interface ProfilePageProps {
    user: User | null;
    products: Product[];
    onLogin: () => void;
    onUpdateUser: (user: User) => void;
    onVerifyUser: () => void;
    onBoostProduct: (productId: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
    user,
    products,
    onLogin,
    onUpdateUser,
    onVerifyUser,
    onBoostProduct
}) => {
    const { t } = useLanguage();
    const navigate = useNavigate();

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
                <h2 className="text-xl font-bold mb-4">{t('nav.login')}</h2>
                <button
                    onClick={onLogin}
                    className="bg-brand-600 text-white px-8 py-3 rounded-full font-bold shadow-lg"
                >
                    Google Login
                </button>
            </div>
        );
    }

    const userProducts = products.filter(p => p.seller.id === user.id);

    return (
        <UserProfile
            user={user}
            userProducts={userProducts}
            onUpdateUser={onUpdateUser}
            onBack={() => navigate('/')}
            onProductClick={(p) => navigate(`/product/${p.id}`)}
            onVerifyUser={onVerifyUser}
            onBoostProduct={onBoostProduct}
        />
    );
};
