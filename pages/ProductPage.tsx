
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product, User } from '../types';
import { ProductDetails } from '../components/ProductDetails';
import { useSEO } from '../hooks/useSEO';
import { useLanguage } from '../contexts/LanguageContext';
import { API_BASE_URL } from '../services/apiConfig';

interface ProductPageProps {
    products: Product[];
    // onAddToCart and cart removed - direct purchase model
    onContactSeller: (product: Product) => void;
    user: User | null;
}

export const ProductPage: React.FC<ProductPageProps> = ({
    products,
    onContactSeller,
    user
}) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { formatPrice, language } = useLanguage();
    const [fetchedProduct, setFetchedProduct] = React.useState<Product | null>(null);
    const [loading, setLoading] = React.useState(false);

    // Try to find in props first, then fall back to fetched state
    const product = products.find(p => p.id === id) || fetchedProduct;

    React.useEffect(() => {
        const foundInProps = products.find(p => p.id === id);
        if (!foundInProps && id && !id.startsWith('mock-')) { // Don't fetch mocks from API if local
            const fetchProduct = async () => {
                setLoading(true);
                try {
                    // Import API_BASE_URL dynamically or assume global/env. 
                    // Since we are in a component, we use the const from services
                    const API_BASE_URL = 'http://localhost:3000'; // Or use explicit import if possible.
                    // Better: use relative path if proxied, or hardcode for now based on context

                    const response = await fetch(`${'http://localhost:3000'}/api/products/${id}?lang=${language}`);
                    if (response.ok) {
                        const dbProduct = await response.json();
                        // Transform to App Product Type
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
                            deliveryType: dbProduct.delivery_type,
                            location: {
                                latitude: dbProduct.latitude,
                                longitude: dbProduct.longitude
                            },
                            locationName: dbProduct.location_name,
                            createdAt: new Date(dbProduct.created_at).getTime(),
                            isPromoted: dbProduct.is_promoted
                        };
                        setFetchedProduct(transformed);
                    }
                } catch (err) {
                    console.error("Failed to fetch product", err);
                } finally {
                    setLoading(false);
                }
            };
            fetchProduct();
        }
    }, [id, products, language]);

    useSEO({
        title: product ? `${product.title} | DESCU` : 'Item Not Found | DESCU',
        description: product ? `Check out ${product.title} for ${formatPrice(product.price)}. ${product.description.substring(0, 150)}...` : 'Product not found on DESCU.',
        image: product?.images[0],
        product: product
    });

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
            </div>
        );
    }

    if (!product) {
        return <div className="p-8 text-center text-gray-500">Product not found</div>;
    }

    return (
        <ProductDetails
            product={product}
            onBack={() => navigate('/')}
            onContactSeller={onContactSeller}
            isInCart={false}
            user={user}
        />
    );
};
