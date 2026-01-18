import React from 'react';
import { MapPin, Navigation, Copy, ExternalLink } from 'lucide-react';

interface LocationCardProps {
    content: {
        name: string;
        address: string;
        lat: number;
        lng: number;
        shared_by?: string;
        timestamp?: string;
    };
}

export const LocationCard: React.FC<LocationCardProps> = ({ content }) => {
    const { name, address, lat, lng } = content;

    // Google Maps静态图片URL
    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=400x200&markers=color:red%7C${lat},${lng}&key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8`;

    // 使用OpenStreetMap作为备用（无需API密钥）
    const osmStaticMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`;

    // Google Maps导航链接
    const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    // 地图查看链接
    const viewMapUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    const handleCopyAddress = () => {
        navigator.clipboard.writeText(address);
        // 简单的toast提示
        const toast = document.createElement('div');
        toast.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-6 py-3 rounded-full shadow-xl animate-fade-in z-[999] backdrop-blur-md';
        toast.innerText = '✓ 地址已复制';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    };

    const handleNavigate = () => {
        window.open(navigationUrl, '_blank');
    };

    const handleViewMap = () => {
        window.open(viewMapUrl, '_blank');
    };

    return (
        <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl overflow-hidden border-2 border-green-200 shadow-lg max-w-sm">
            {/* Header */}
            <div className="flex items-center gap-2 p-4 bg-gradient-to-r from-green-600 to-emerald-600">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <MapPin className="text-white" size={20} />
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-white text-sm">📍 位置分享</h4>
                </div>
            </div>

            {/* Map Preview - Using OpenStreetMap iframe */}
            <div className="relative w-full h-40 bg-gray-200">
                <iframe
                    src={osmStaticMapUrl}
                    className="w-full h-full border-0"
                    title="地图预览"
                    loading="lazy"
                />
                <div
                    className="absolute inset-0 bg-transparent cursor-pointer"
                    onClick={handleViewMap}
                    title="点击查看大地图"
                />
            </div>

            {/* Location Info */}
            <div className="p-4">
                <h3 className="font-bold text-gray-900 mb-1 text-base">{name}</h3>
                <p className="text-sm text-gray-600 mb-3 leading-relaxed">{address}</p>

                {/* Coordinates */}
                <div className="text-xs text-gray-500 mb-3 font-mono">
                    📍 {lat.toFixed(6)}, {lng.toFixed(6)}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleNavigate}
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2.5 rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-md active:scale-95"
                    >
                        <Navigation size={16} />
                        <span className="text-sm">导航</span>
                    </button>

                    <button
                        onClick={handleCopyAddress}
                        className="flex items-center justify-center gap-2 bg-white text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-all border-2 border-gray-200 active:scale-95"
                    >
                        <Copy size={16} />
                        <span className="text-sm">复制</span>
                    </button>
                </div>

                {/* View in Maps Link */}
                <button
                    onClick={handleViewMap}
                    className="w-full mt-2 flex items-center justify-center gap-1 text-sm text-blue-600 hover:text-blue-700 py-2 transition-colors"
                >
                    <ExternalLink size={14} />
                    <span>在Google Maps中查看</span>
                </button>
            </div>
        </div>
    );
};
