
import React from 'react';
import { UserCircle } from 'lucide-react';
import { User, Product } from '../types';
import { UserProfile } from '../components/UserProfile';
import { SignedOutPlaceholder } from '../components/SignedOutPlaceholder';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '@/lib/useBackNavigation';
import { api } from '@/lib/api/client';

interface ProfilePageProps {
    user: User | null;
    products: Product[];
    /** @deprecated The signed-out state opens the shared login modal via `useAuth()`. */
    onLogin?: () => void;
    onUpdateUser: (user: User) => void;
    onVerifyUser: () => void;
    onBoostProduct: (productId: string) => void;
    favorites?: Set<string>;
    allProducts?: Product[];
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
    user,
    products,
    onUpdateUser,
    onVerifyUser,
    onBoostProduct,
    favorites = new Set(),
    allProducts = []
}) => {
    const navigate = useNavigate();
    const goBack = useBackNavigation('/');
    const [myProducts, setMyProducts] = React.useState<Product[]>([]);

    React.useEffect(() => {
        if (user) {
            // Fetch my products including all statuses
            // We need to fetch from API directly to bypass the frontend 'active' filters and pagination limits
            api.get<any>('/api/products', { params: { seller_id: user.id, status: 'all', limit: 100 } })
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
        }
    }, [user]);

    if (!user) {
        return <SignedOutPlaceholder hintKey="auth.signed_out_hint_profile" icon={UserCircle} />;
    }

    // fallback to props if API fail or loading, but prefer myProducts if available
    const displayProducts = myProducts.length > 0 ? myProducts : products.filter(p => p.seller.id === user.id);

    return (
        <UserProfile
            user={user}
            userProducts={displayProducts}
            onUpdateUser={onUpdateUser}
            onBack={goBack}
            onProductClick={(p) => navigate(`/product/${p.id}`)}
            onVerifyUser={onVerifyUser}
            onBoostProduct={onBoostProduct}
            favorites={favorites}
            allProducts={allProducts}
        />
    );
};
