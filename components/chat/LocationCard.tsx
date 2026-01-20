import React from 'react';
import { MapPin, Navigation, Copy, ExternalLink, Sparkles } from 'lucide-react';

interface LocationCardProps {
    content: {
        name: string;
        address: string;
        lat: number;
        lng: number;
        shared_by?: string;
        timestamp?: string;
    };
    senderName?: string;
    senderAvatar?: string;
    isMe?: boolean;
}

export const LocationCard: React.FC<LocationCardProps> = ({ content, senderName, senderAvatar, isMe }) => {
    const { name, address, lat, lng } = content;

    // OpenStreetMap嵌入URL
    const osmStaticMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`;

    // Google Maps导航链接
    const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const viewMapUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    const handleCopyAddress = () => {
        navigator.clipboard.writeText(address);
        const toast = document.createElement('div');
        toast.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-6 py-3 rounded-full shadow-xl animate-fade-in z-[999] backdrop-blur-md flex items-center gap-2';
        toast.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>地址已复制';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    };

    return (
        <div className="relative overflow-hidden rounded-3xl shadow-xl max-w-sm group hover:shadow-2xl transition-all duration-500">
            {/* 渐变背景 */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 via-cyan-500 to-blue-600 opacity-90" />

            {/* 装饰性气泡 */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-white/10 rounded-full blur-2xl" />

            {/* Header with Sender Info */}
            <div className="relative flex items-center gap-3 p-4">
                {/* 发送者头像 */}
                {senderAvatar && (
                    <img
                        src={senderAvatar}
                        alt={senderName || '用户'}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-white/50 shadow-md"
                    />
                )}
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg">
                    <MapPin className="text-white drop-shadow-lg" size={20} />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                        <Sparkles size={14} className="text-yellow-300" />
                        <span className="text-xs font-bold text-white/90 uppercase tracking-wider">
                            {senderName ? `${senderName} 分享了位置` : '位置分享'}
                        </span>
                    </div>
                    <h4 className="font-bold text-white text-base truncate mt-0.5">{name}</h4>
                </div>
            </div>

            {/* Map Preview */}
            <div className="relative mx-3 rounded-2xl overflow-hidden shadow-inner">
                <iframe
                    src={osmStaticMapUrl}
                    className="w-full h-36 border-0"
                    title="地图预览"
                    loading="lazy"
                />
                <div
                    className="absolute inset-0 bg-transparent cursor-pointer group-hover:bg-white/10 transition-colors"
                    onClick={() => window.open(viewMapUrl, '_blank')}
                    title="点击查看大地图"
                />
            </div>

            {/* Location Info */}
            <div className="relative p-4 pt-3">
                <p className="text-sm text-white/90 mb-3 leading-relaxed line-clamp-2">{address}</p>

                {/* Coordinates - 年轻化标签样式 */}
                <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-white/90 font-mono mb-4">
                    <MapPin size={12} />
                    {lat.toFixed(4)}, {lng.toFixed(4)}
                </div>

                {/* Action Buttons - 更现代的设计 */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => window.open(navigationUrl, '_blank')}
                        className="flex items-center justify-center gap-2 bg-white text-emerald-600 py-3 rounded-xl font-bold text-sm hover:bg-white/90 transition-all shadow-lg active:scale-95"
                    >
                        <Navigation size={18} />
                        导航
                    </button>

                    <button
                        onClick={handleCopyAddress}
                        className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-sm text-white py-3 rounded-xl font-bold text-sm hover:bg-white/30 transition-all border border-white/30 active:scale-95"
                    >
                        <Copy size={18} />
                        复制
                    </button>
                </div>

                {/* View in Maps Link */}
                <button
                    onClick={() => window.open(viewMapUrl, '_blank')}
                    className="w-full mt-3 flex items-center justify-center gap-1.5 text-sm text-white/80 hover:text-white py-2 transition-colors"
                >
                    <ExternalLink size={14} />
                    <span>在Google Maps中查看</span>
                </button>
            </div>
        </div>
    );
};
