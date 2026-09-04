
import { createClient } from '@supabase/supabase-js';
// Circular with '@/lib/api/client' (it reads `supabase` for the bearer token); both sides only
// touch the other's export at call time, so the cycle is safe.
import { api } from '@/lib/api/client';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.');
}

// 确保有默认值以防止崩溃
const url = supabaseUrl || 'https://placeholder.supabase.co';
const key = supabaseAnonKey || 'placeholder';

export const supabase = createClient(url, key, {
    auth: {
        detectSessionInUrl: false,  // 禁用自动检测，我们在 App.tsx initAuth 中手动处理
        autoRefreshToken: true,
        persistSession: true,
    }
});

export const uploadProductImage = async (file: File): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('products')
            .upload(filePath, file);

        if (uploadError) {
            throw uploadError;
        }

        const { data } = supabase.storage.from('products').getPublicUrl(filePath);
        return data.publicUrl;
    } catch (error) {
        console.error('Error uploading image:', error);
        return null;
    }
};

/** Upload a (pre-compressed) avatar to Storage and return its public URL. */
export const uploadAvatarImage = async (file: File, userId: string): Promise<string | null> => {
    try {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const filePath = `avatars/${userId}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('products').upload(filePath, file, { upsert: false, contentType: file.type || undefined });
        if (error) throw error;
        return supabase.storage.from('products').getPublicUrl(filePath).data.publicUrl;
    } catch (error) {
        console.error('Error uploading avatar:', error);
        return null;
    }
};

/** Owner-only status change via the API; resolves `true` on success. */
const setOwnProductStatus = async (productId: string, status: 'sold' | 'active', label: string): Promise<boolean> => {
    try {
        await api.patch(`/api/products/${encodeURIComponent(productId)}/status`, { status }, { auth: 'required' });
        return true;
    } catch (error) {
        console.error(`Error ${label}:`, error);
        return false;
    }
};

// 标记产品为已售出
export const markProductAsSold = (productId: string): Promise<boolean> =>
    setOwnProductStatus(productId, 'sold', 'marking product as sold');

// 重新上架产品（服务端会将状态置为 pending_review，需要重新审核）
export const relistProduct = (productId: string): Promise<boolean> =>
    setOwnProductStatus(productId, 'active', 'relisting product');
