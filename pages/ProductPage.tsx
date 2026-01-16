
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product, User } from '../types';
import { ProductDetails } from '../components/ProductDetails';
import { useSEO } from '../hooks/useSEO';
import { useLanguage } from '../contexts/LanguageContext';

interface ProductPageProps {
    products: Product[];
    onAddToCart: (product: Product) => void;
    onContactSeller: (product: Product) => void;
    cart: Product[];
    user: User | null;
}

export const ProductPage: React.FC<ProductPageProps> = ({
    products,
    onAddToCart,
    onContactSeller,
    cart,
    user
}) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { formatPrice } = useLanguage();

    const product = products.find(p => p.id === id);

    useSEO({
        title: product ? `${product.title} | DESCU` : 'Item Not Found | DESCU',
        description: product ? `Check out ${product.title} for ${formatPrice(product.price)}. ${product.description.substring(0, 150)}...` : 'Product not found on DESCU.',
        image: product?.images[0],
    });

    if (!product) {
        return <div className="p-8 text-center text-gray-500">Product not found</div>;
    }

    return (
        <ProductDetails
            product={product}
            onBack={() => navigate(-1)}
            onAddToCart={onAddToCart}
            onContactSeller={onContactSeller}
            isInCart={cart.some(p => p.id === product.id)}
            user={user}
        />
    );
};
