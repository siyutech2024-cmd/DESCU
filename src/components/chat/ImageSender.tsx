import React, { useState } from 'react';
import { X, Image as ImageIcon, Camera, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { uploadChatImage, compressImage } from '../../services/chatImageUpload';
import { useLanguage } from '../../contexts/LanguageContext';

interface ImageSenderProps {
    conversationId: string;
    onSent?: () => void;
    onClose?: () => void;
}

export const ImageSender: React.FC<ImageSenderProps> = ({
    conversationId,
    onSent,
    onClose
}) => {
    const { t } = useLanguage();
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files).slice(0, 5);
        setSelectedImages(fileArray);

        const urls = fileArray.map(file => URL.createObjectURL(file));
        setPreviewUrls(urls);
    };

    const handleRemoveImage = (index: number) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
        setPreviewUrls(prev => {
            const newUrls = prev.filter((_, i) => i !== index);
            URL.revokeObjectURL(prev[index]);
            return newUrls;
        });
    };

    const handleSend = async () => {
        if (selectedImages.length === 0) return;

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert(t('image.login_first'));
                return;
            }

            const userId = session.user.id;
            const uploadedUrls: string[] = [];

            for (let i = 0; i < selectedImages.length; i++) {
                const file = selectedImages[i];
                const compressedFile = await compressImage(file);
                const result = await uploadChatImage(compressedFile, userId);
                uploadedUrls.push(result.url);
                setUploadProgress(Math.round(((i + 1) / selectedImages.length) * 100));
            }

            const imagesContent = JSON.stringify({
                images: uploadedUrls,
                count: uploadedUrls.length,
                shared_by: userId,
                timestamp: new Date().toISOString()
            });

            const { error } = await supabase.from('messages').insert({
                conversation_id: conversationId,
                sender_id: userId,
                message_type: 'images',
                content: imagesContent,
                text: `📷 ${t('image.shared').replace('{0}', String(uploadedUrls.length))}`
            });

            if (error) throw error;

            previewUrls.forEach(url => URL.revokeObjectURL(url));
            setSelectedImages([]);
            setPreviewUrls([]);
            onSent?.();
        } catch (error) {
            console.error('Error sending images:', error);
            alert(t('image.send_failed'));
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleCapture = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.multiple = true;
        input.onchange = (e: any) => handleFileSelect(e);
        input.click();
    };

    return (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border-2 border-purple-200 shadow-lg max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                        <ImageIcon className="text-white" size={20} />
                    </div>
                    <h4 className="font-bold text-gray-900">{t('image.title')}</h4>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* Image Selection Buttons */}
            {selectedImages.length === 0 && (
                <div className="space-y-3 mb-4">
                    <label className="block">
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-md cursor-pointer">
                            <ImageIcon size={20} />
                            <span>{t('image.from_gallery')}</span>
                        </div>
                    </label>

                    <button
                        onClick={handleCapture}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 rounded-xl font-medium hover:from-purple-600 hover:to-pink-700 transition-all shadow-md"
                    >
                        <Camera size={20} />
                        <span>{t('image.take_photo')}</span>
                    </button>
                </div>
            )}

            {/* Image Preview Grid */}
            {selectedImages.length > 0 && (
                <div className="mb-4">
                    <div className="grid grid-cols-3 gap-2">
                        {previewUrls.map((url, index) => (
                            <div key={index} className="relative aspect-square">
                                <img
                                    src={url}
                                    alt={`Preview ${index + 1}`}
                                    className="w-full h-full object-cover rounded-lg"
                                />
                                <button
                                    onClick={() => handleRemoveImage(index)}
                                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                        {t('image.count').replace('{0}', String(selectedImages.length))}
                    </p>
                </div>
            )}

            {/* Upload Progress */}
            {isUploading && (
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Loader2 size={16} className="animate-spin text-purple-600" />
                        <span className="text-sm text-gray-700">{t('image.uploading').replace('{0}', String(uploadProgress))}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Send Button */}
            {selectedImages.length > 0 && !isUploading && (
                <button
                    onClick={handleSend}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 rounded-xl font-medium hover:from-purple-600 hover:to-pink-700 transition-all shadow-md"
                >
                    {t('image.send').replace('{0}', String(selectedImages.length))}
                </button>
            )}

            {/* Tips */}
            <p className="text-xs text-gray-500 text-center mt-3">
                💡 {t('image.tip')}
            </p>
        </div>
    );
};
