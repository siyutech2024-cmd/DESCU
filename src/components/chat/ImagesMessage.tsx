import React, { useState } from 'react';
import { X, Image as ImageIcon, ZoomIn } from 'lucide-react';

interface ImagesMessageProps {
    content: {
        images: string[];
        count: number;
        shared_by?: string;
        timestamp?: string;
    };
}

export const ImagesMessage: React.FC<ImagesMessageProps> = ({ content }) => {
    const { images, count } = content;
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const handleImageClick = (url: string) => {
        setSelectedImage(url);
    };

    const closeViewer = () => {
        setSelectedImage(null);
    };

    // 根据图片数量渲染不同布局
    const renderImageGrid = () => {
        if (count === 1) {
            return (
                <div
                    onClick={() => handleImageClick(images[0])}
                    className="cursor-pointer rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform duration-300 relative group"
                >
                    <img
                        src={images[0]}
                        alt="分享的图片"
                        className="w-full h-auto max-h-80 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" size={32} />
                    </div>
                </div>
            );
        }

        if (count === 2) {
            return (
                <div className="grid grid-cols-2 gap-1.5">
                    {images.map((url, idx) => (
                        <div
                            key={idx}
                            onClick={() => handleImageClick(url)}
                            className="aspect-square cursor-pointer rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform duration-300 relative group"
                        >
                            <img
                                src={url}
                                alt={`图片 ${idx + 1}`}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>
                    ))}
                </div>
            );
        }

        if (count === 3) {
            return (
                <div className="grid grid-cols-3 gap-1.5">
                    {images.map((url, idx) => (
                        <div
                            key={idx}
                            onClick={() => handleImageClick(url)}
                            className="aspect-square cursor-pointer rounded-xl overflow-hidden hover:scale-[1.02] transition-transform duration-300 relative group"
                        >
                            <img
                                src={url}
                                alt={`图片 ${idx + 1}`}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ))}
                </div>
            );
        }

        // 4-5张图片
        return (
            <div className="grid grid-cols-2 gap-1.5">
                {images.slice(0, 4).map((url, idx) => (
                    <div
                        key={idx}
                        onClick={() => handleImageClick(url)}
                        className="aspect-square cursor-pointer rounded-xl overflow-hidden hover:scale-[1.02] transition-transform duration-300 relative group"
                    >
                        <img
                            src={url}
                            alt={`图片 ${idx + 1}`}
                            className="w-full h-full object-cover"
                        />
                        {idx === 3 && count > 4 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                                <span className="text-white text-3xl font-bold">
                                    +{count - 4}
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <>
            <div className="relative overflow-hidden rounded-3xl shadow-lg max-w-sm group">
                {/* 渐变背景 */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 opacity-90" />

                {/* 装饰 */}
                <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full blur-2xl" />

                {/* Header */}
                <div className="relative flex items-center gap-2 p-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <ImageIcon className="text-white" size={16} />
                    </div>
                    <span className="text-xs font-bold text-white/90 uppercase tracking-wider">
                        📷 {count} 张图片
                    </span>
                </div>

                {/* Images */}
                <div className="relative p-3 pt-0">
                    {renderImageGrid()}
                </div>
            </div>

            {/* Full Screen Image Viewer */}
            {selectedImage && (
                <div
                    className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4 animate-fade-in"
                    onClick={closeViewer}
                >
                    <button
                        onClick={closeViewer}
                        className="absolute top-4 right-4 w-12 h-12 bg-white/10 backdrop-blur-xl text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-colors z-10 shadow-lg"
                    >
                        <X size={24} />
                    </button>

                    <div className="relative max-w-4xl max-h-full">
                        <img
                            src={selectedImage}
                            alt="全屏查看"
                            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />

                        {count > 1 && (
                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full">
                                {images.map((url, idx) => (
                                    <button
                                        key={idx}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedImage(url);
                                        }}
                                        className={`w-2.5 h-2.5 rounded-full transition-all ${url === selectedImage
                                            ? 'bg-white w-6'
                                            : 'bg-white/50 hover:bg-white/75'
                                            }`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
