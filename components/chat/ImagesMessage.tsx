import React, { useState } from 'react';
import { X } from 'lucide-react';

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
                    className="cursor-pointer rounded-xl overflow-hidden max-w-sm hover:opacity-95 transition-opacity"
                >
                    <img
                        src={images[0]}
                        alt="分享的图片"
                        className="w-full h-auto max-h-96 object-cover"
                    />
                </div>
            );
        }

        if (count === 2) {
            return (
                <div className="grid grid-cols-2 gap-1 max-w-md">
                    {images.map((url, idx) => (
                        <div
                            key={idx}
                            onClick={() => handleImageClick(url)}
                            className="aspect-square cursor-pointer rounded-lg overflow-hidden hover:opacity-95 transition-opacity"
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

        if (count === 3) {
            return (
                <div className="grid grid-cols-3 gap-1 max-w-md">
                    {images.map((url, idx) => (
                        <div
                            key={idx}
                            onClick={() => handleImageClick(url)}
                            className="aspect-square cursor-pointer rounded-lg overflow-hidden hover:opacity-95 transition-opacity"
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

        // 4-5张图片：2x2 或 2x3 网格
        return (
            <div className="grid grid-cols-2 gap-1 max-w-md">
                {images.slice(0, 4).map((url, idx) => (
                    <div
                        key={idx}
                        onClick={() => handleImageClick(url)}
                        className="aspect-square cursor-pointer rounded-lg overflow-hidden hover:opacity-95 transition-opacity relative"
                    >
                        <img
                            src={url}
                            alt={`图片 ${idx + 1}`}
                            className="w-full h-full object-cover"
                        />
                        {/* 第4张显示剩余数量 */}
                        {idx === 3 && count > 4 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="text-white text-2xl font-bold">
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
            <div className="bg-white rounded-2xl p-2 shadow-md max-w-md border border-gray-200">
                {renderImageGrid()}
                {count > 1 && (
                    <p className="text-xs text-gray-500 text-center mt-2">
                        📷 {count} 张图片
                    </p>
                )}
            </div>

            {/* Full Screen Image Viewer */}
            {selectedImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 animate-fade-in"
                    onClick={closeViewer}
                >
                    <button
                        onClick={closeViewer}
                        className="absolute top-4 right-4 w-10 h-10 bg-white/10 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-colors z-10"
                    >
                        <X size={24} />
                    </button>

                    <div className="relative max-w-4xl max-h-full">
                        <img
                            src={selectedImage}
                            alt="全屏查看"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />

                        {/* Image navigation */}
                        {count > 1 && (
                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                                {images.map((url, idx) => (
                                    <button
                                        key={idx}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedImage(url);
                                        }}
                                        className={`w-3 h-3 rounded-full transition-all ${url === selectedImage
                                                ? 'bg-white w-8'
                                                : 'bg-white/50 hover:bg-white/75'
                                            }`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Download hint */}
                    <div className="absolute bottom-4 right-4 text-white/60 text-sm">
                        点击图片外部关闭
                    </div>
                </div>
            )}
        </>
    );
};
