import { supabase } from './supabase';

export const getFavorites = async (userId: string) => {
    const { data, error } = await supabase
        .from('favorites')
        .select('product_id')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching favorites:', error);
        return [];
    }
    return data.map(f => f.product_id);
};

export const toggleFavorite = async (userId: string, productId: string) => {
    // Check if exists
    const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .single();

    if (existing) {
        // Remove
        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('id', existing.id);
        if (error) throw error;
        return false; // Not favorited anymore
    } else {
        // Add
        const { error } = await supabase
            .from('favorites')
            .insert({ user_id: userId, product_id: productId });
        if (error) throw error;
        return true; // Favorited
    }
};
