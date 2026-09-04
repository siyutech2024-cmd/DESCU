
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product, User } from '../types';
import { ProductDetails } from '@/features/products/components/ProductDetails';
import { useSEO } from '../hooks/useSEO';
import { useLanguage } from '@/i18n';
import { PackageSearch } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { useBackNavigation } from '@/lib/useBackNavigation';

interface ProductPageProps {
    products: Product[];
    // onAddToCart and cart removed - direct purchase model
    onContactSeller: (product: Product) => void;
    onRequireLogin: () => void;
    user: User | null;
}

export const ProductPage: React.FC<ProductPageProps> = ({
    products,
    onContactSeller,
    onRequireLogin,
    user
}) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const goBack = useBackNavigation('/');
    const { formatPrice, language, t } = useLanguage();
    const [fetchedProduct, setFetchedProduct] = React.useState<Product | null>(null);
    const [loading, setLoading] = React.useState(true);  // Start with loading true
    const [error, setError] = React.useState<string | null>(null);

    // Try to find in props first, then fall back to fetched state
    const product = products.find(p => p.id === id) || fetchedProduct;

    console.log('[ProductPage] Mounting with id:', id, 'found in props:', !!products.find(p => p.id === id));

    React.useEffect(() => {
        // 如果 props 中有产品，直接使用并停止
        const foundInProps = products.find(p => p.id === id);
        if (foundInProps) {
            console.log('[ProductPage] Product found in props:', foundInProps.title);
            setLoading(false);
            return; // 直接使用 props 数据，不再调用 API
        }

        // 无 props 数据时从 API 获取
        if (!id) {
            console.error('[ProductPage] No product ID provided');
            setError('No product ID provided');
            setLoading(false);
            return;
        }

        const fetchProduct = async () => {
            console.log('[ProductPage] Fetching product from API:', `/api/products/${id}`);

            try {
                const dbProduct = await api.get<any>(`/api/products/${id}`, { params: { lang: language } });

                // Non-JSON body (client falls back to raw text) — previously rejected via content-type check
                if (!dbProduct || typeof dbProduct !== 'object') {
                    setError('Unexpected server response');
                    return;
                }

                console.log('[ProductPage] Product fetched:', dbProduct.title);

                const transformed: Product = {
                    id: dbProduct.id,
                    seller: {
                        id: dbProduct.seller_id,
                        name: dbProduct.seller_name,
                        email: dbProduct.seller_email,
                        avatar: dbProduct.seller_avatar,
                        isVerified: dbProduct.seller_verified
                    },
                    title: dbProduct.title,
                    description: dbProduct.description,
                    price: dbProduct.price,
                    currency: dbProduct.currency,
                    images: dbProduct.images || [],
                    category: dbProduct.category,
                    subcategory: dbProduct.subcategory,
                    deliveryType: dbProduct.delivery_type,
                    location: {
                        latitude: dbProduct.latitude,
                        longitude: dbProduct.longitude
                    },
                    locationName: dbProduct.location_name,
                    country: dbProduct.country,
                    city: dbProduct.city,
                    town: dbProduct.town,
                    district: dbProduct.district,
                    location_display_name: dbProduct.location_display_name,
                    createdAt: new Date(dbProduct.created_at).getTime(),
                    isPromoted: dbProduct.is_promoted,
                    status: dbProduct.status
                };
                setFetchedProduct(transformed);
            } catch (err: any) {
                if (err instanceof ApiError) {
                    setError(`Product not found (${err.status})`);
                    return;
                }
                console.error("[ProductPage] Failed to fetch product:", err);
                setError(err.message || 'Failed to load product');
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, [id, products, language]);

    useSEO({
        title: product ? `${product.title} - ${formatPrice(product.price)} | DESCU México` : 'Producto No Encontrado | DESCU',
        description: product ? `${product.title} a solo ${formatPrice(product.price)} en DESCU. ${product.description?.substring(0, 120) || ''} Compra artículos de segunda mano cerca de ti en México.` : 'Producto no encontrado en DESCU.',
        image: product?.images[0],
        product: product
    });

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
                <p className="text-gray-500 text-sm">{t('common.loading')}</p>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <PackageSearch size={28} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{t('product.not_found_title')}</h2>
                    <p className="text-gray-600 mb-4">{t('product.not_found_body')}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors"
                    >
                        {t('product.not_found_back')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <ProductDetails
            product={product}
            onBack={goBack}
            onContactSeller={onContactSeller}
            onRequireLogin={onRequireLogin}
            isInCart={false}
            user={user}
        />
    );
};
