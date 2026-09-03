import { useMutation } from '@tanstack/react-query';
import type { Product, User } from '@/types';
import { useLanguage } from '@/i18n';
import { notify } from '@/lib/toast';
import { getErrorMessage } from '@/lib/errors';
import { getDetailedLocation } from '@/services/locationService';
import { createProduct } from './productsApi';
import type { ApiProduct } from './productMapper';

export type NewProductInput = Omit<Product, 'id' | 'createdAt' | 'distance'>;

interface Options {
    onCreated?: (product: ApiProduct) => void;
}

/** Publish a new listing, enriching it with a reverse-geocoded location first. */
export const useCreateProduct = (user: User | null, { onCreated }: Options = {}) => {
    const { t, language } = useLanguage();

    const mutation = useMutation({
        mutationFn: async (input: NewProductInput) => {
            if (!user) throw new Error(t('toast.please_login'));

            let detailed: Awaited<ReturnType<typeof getDetailedLocation>> | null = null;
            try {
                detailed = await getDetailedLocation(input.location.latitude, input.location.longitude);
            } catch (error) {
                console.warn('[products] detailed location lookup failed, continuing:', error);
            }

            return createProduct({
                seller_id: user.id,
                seller_name: user.name,
                seller_email: user.email,
                seller_avatar: user.avatar,
                seller_verified: user.isVerified || false,
                title: input.title,
                description: input.description,
                price: input.price,
                currency: input.currency,
                images: input.images,
                category: input.category,
                subcategory: input.subcategory || null,
                source_language: language,
                delivery_type: input.deliveryType,
                latitude: input.location.latitude,
                longitude: input.location.longitude,
                location_name: input.locationName,
                country: user.country || 'MX',
                city: detailed?.city || user.city || 'Unknown',
                town: detailed?.town || null,
                district: detailed?.district || null,
                location_display_name: detailed?.displayName || user.city || 'Unknown',
            });
        },
        onSuccess: (product) => {
            onCreated?.(product);
            notify.success(t('toast.product_published'));
        },
        onError: (error) => {
            console.error('[products] create failed:', error);
            notify.error(`${t('toast.product_publish_failed')}: ${getErrorMessage(error)}`);
        },
    });

    /** Fire-and-forget: errors are reported via toast, never rethrown to the caller. */
    const createProductSafe = (input: NewProductInput) => mutation.mutateAsync(input).catch(() => undefined);

    return { createProduct: createProductSafe, isCreating: mutation.isPending };
};
