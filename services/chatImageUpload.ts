import { supabase } from '../services/supabase';

/**
 * 图片上传服务
 * 处理聊天中的图片上传到Supabase Storage
 */

export interface UploadedImage {
    url: string;
    path: string;
    size: number;
    type: string;
}

/**
 * 上传图片到Supabase Storage
 * @param file - 要上传的文件
 * @param userId - 用户ID
 * @returns 上传后的图片URL和路径
 */
export async function uploadChatImage(
    file: File,
    userId: string
): Promise<UploadedImage> {
    try {
        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            throw new Error('只能上传图片文件');
        }

        // 验证文件大小（最大5MB）
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error('图片大小不能超过5MB');
        }

        // 生成唯一文件名
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${timestamp}_${randomStr}.${ext}`;
        const filePath = `chat-images/${userId}/${fileName}`;

        console.log('[ImageUpload] Uploading to:', filePath);

        // 上传到Supabase Storage
        const { data, error } = await supabase.storage
            .from('products') // 使用现有的products bucket
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // 获取公开URL
        const { data: { publicUrl } } = supabase.storage
            .from('products')
            .getPublicUrl(filePath);

        console.log('[ImageUpload] Upload successful:', publicUrl);

        return {
            url: publicUrl,
            path: filePath,
            size: file.size,
            type: file.type
        };
    } catch (error) {
        console.error('[ImageUpload] Upload failed:', error);
        throw error;
    }
}

/**
 * 上传多张图片
 * @param files - 文件列表
 * @param userId - 用户ID
 * @param onProgress - 进度回调
 * @returns 上传后的图片列表
 */
export async function uploadMultipleChatImages(
    files: FileList | File[],
    userId: string,
    onProgress?: (current: number, total: number) => void
): Promise<UploadedImage[]> {
    const fileArray = Array.from(files);
    const results: UploadedImage[] = [];

    for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];

        try {
            const uploaded = await uploadChatImage(file, userId);
            results.push(uploaded);

            if (onProgress) {
                onProgress(i + 1, fileArray.length);
            }
        } catch (error) {
            console.error(`[ImageUpload] Failed to upload ${file.name}:`, error);
            // 继续上传其他文件
        }
    }

    return results;
}

/**
 * 压缩图片（客户端）
 * @param file - 原始文件
 * @param maxWidth - 最大宽度
 * @param maxHeight - 最大高度
 * @param quality - 质量(0-1)
 * @returns 压缩后的文件
 */
export async function compressImage(
    file: File,
    maxWidth: number = 1920,
    maxHeight: number = 1080,
    quality: number = 0.8
): Promise<File> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // 计算缩放比例
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('无法创建canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('图片压缩失败'));
                            return;
                        }

                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });

                        console.log(
                            `[ImageUpload] Compressed: ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB`
                        );

                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    quality
                );
            };

            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = e.target?.result as string;
        };

        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
    });
}

/**
 * 删除图片
 * @param path - 图片路径
 */
export async function deleteChatImage(path: string): Promise<void> {
    try {
        const { error } = await supabase.storage
            .from('products')
            .remove([path]);

        if (error) throw error;

        console.log('[ImageUpload] Deleted:', path);
    } catch (error) {
        console.error('[ImageUpload] Delete failed:', error);
        throw error;
    }
}
