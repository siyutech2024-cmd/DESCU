
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
    const [myProducts, setMyProducts] = React.useState<Product[]>([]);

    React.useEffect(() => {
        if (user) {
            // Fetch my products including all statuses
            // We need to fetch from API directly to bypass the frontend 'active' filters and pagination limits
            import('../services/apiConfig').then(({ API_BASE_URL }) => {
                fetch(`${API_BASE_URL}/api/products?seller_id=${user.id}&status=all&limit=100`)
                    .then(res => res.json())
                    .then(data => {
                        if (Array.isArray(data)) {
                            // Simple mapping
                            const mapped: Product[] = data.map((p: any) => ({
                                id: p.id,
                                seller: user, // user is self
                                title: p.title,
                                description: p.description,
                                price: p.price,
                                currency: p.currency,
                                images: p.images || [],
                                category: p.category,
                                deliveryType: p.delivery_type,
                                location: { latitude: p.latitude || 0, longitude: p.longitude || 0 },
                                locationName: p.location_name,
                                createdAt: new Date(p.created_at).getTime(),
                                isPromoted: p.is_promoted,
                                status: p.status
                            }));
                            setMyProducts(mapped);
                        }
                    })
                    .catch(err => console.error("Failed to fetch my products", err));
            });
        }
    }, [user]);

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

    // fallback to props if API fail or loading, but prefer myProducts if available
    const displayProducts = myProducts.length > 0 ? myProducts : products.filter(p => p.seller.id === user.id);

    return (
        <UserProfile
            user={user}
            userProducts={displayProducts}
            onUpdateUser={onUpdateUser}
            onBack={() => navigate('/')}
            onProductClick={(p) => navigate(`/product/${p.id}`)}
            onVerifyUser={onVerifyUser}
            onBoostProduct={onBoostProduct}
        />
    );
};
