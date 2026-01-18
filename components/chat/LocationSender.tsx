import React, { useState } from 'react';
import { MapPin, X, Loader2, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface LocationSenderProps {
    conversationId: string;
    onSent?: () => void;
    onClose?: () => void;
}

export const LocationSender: React.FC<LocationSenderProps> = ({
    conversationId,
    onSent,
    onClose
}) => {
    const [isSending, setIsSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLocation, setSelectedLocation] = useState<{
        name: string;
        address: string;
        lat: number;
        lng: number;
    } | null>(null);

    // 获取当前位置
    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            alert('您的浏览器不支持地理定位');
            return;
        }

        setIsSending(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                // 使用反向地理编码获取地址
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                    );
                    const data = await response.json();

                    setSelectedLocation({
                        name: '当前位置',
                        address: data.display_name || `${latitude}, ${longitude}`,
                        lat: latitude,
                        lng: longitude
                    });
                } catch (error) {
                    console.error('Failed to get address:', error);
                    setSelectedLocation({
                        name: '当前位置',
                        address: `纬度: ${latitude}, 经度: ${longitude}`,
                        lat: latitude,
                        lng: longitude
                    });
                }
                setIsSending(false);
            },
            (error) => {
                console.error('Error getting location:', error);
                alert('无法获取您的位置，请检查权限设置');
                setIsSending(false);
            }
        );
    };

    // 搜索地点（简化版 - 使用预设位置）
    const handleSearch = () => {
        if (!searchQuery.trim()) return;

        // 墨西哥城常见地点示例
        const popularPlaces = [
            { name: '改革大道', address: 'Paseo de la Reforma, Ciudad de México', lat: 19.4326, lng: -99.1332 },
            { name: '宪法广场', address: 'Plaza de la Constitución, Centro Histórico', lat: 19.4326, lng: -99.1332 },
            { name: '查普尔特佩克公园', address: 'Bosque de Chapultepec', lat: 19.4204, lng: -99.2024 },
        ];

        const found = popularPlaces.find(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (found) {
            setSelectedLocation(found);
        } else {
            alert('未找到该地点。请尝试"改革大道"、"宪法广场"或"查普尔特佩克公园"');
        }
    };

    const handleSendLocation = async () => {
        if (!selectedLocation) return;

        setIsSending(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const locationContent = JSON.stringify({
                name: selectedLocation.name,
                address: selectedLocation.address,
                lat: selectedLocation.lat,
                lng: selectedLocation.lng,
                shared_by: session.user.id,
                timestamp: new Date().toISOString()
            });

            const { error } = await supabase.from('messages').insert({
                conversation_id: conversationId,
                sender_id: session.user.id,
                message_type: 'location',
                content: locationContent,
                text: `📍 分享了位置: ${selectedLocation.name}` // 备用文本
            });

            if (error) throw error;

            onSent?.();
            setSelectedLocation(null);
            setSearchQuery('');
        } catch (error) {
            console.error('Error sending location:', error);
            alert('发送位置失败，请重试');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border-2 border-blue-200 shadow-lg max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                        <MapPin className="text-white" size={20} />
                    </div>
                    <h4 className="font-bold text-gray-900">分享位置</h4>
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

            {/* Current Location Button */}
            <button
                onClick={handleGetCurrentLocation}
                disabled={isSending}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-md mb-4 disabled:opacity-50"
            >
                {isSending ? (
                    <Loader2 size={20} className="animate-spin" />
                ) : (
                    <MapPin size={20} />
                )}
                <span>使用当前位置</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-300"></div>
                <span className="text-sm text-gray-500">或搜索地点</span>
                <div className="flex-1 h-px bg-gray-300"></div>
            </div>

            {/* Search */}
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="搜索地点..."
                    className="flex-1 px-4 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
                <button
                    onClick={handleSearch}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                    <Search size={20} />
                </button>
            </div>

            {/* Selected Location Preview */}
            {selectedLocation && (
                <div className="bg-white rounded-xl p-4 mb-4 border-2 border-green-200">
                    <div className="flex items-start gap-2 mb-2">
                        <MapPin size={16} className="text-green-600 mt-1 flex-shrink-0" />
                        <div className="flex-1">
                            <h5 className="font-bold text-gray-900">{selectedLocation.name}</h5>
                            <p className="text-sm text-gray-600">{selectedLocation.address}</p>
                            <p className="text-xs text-gray-500 mt-1 font-mono">
                                {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Send Button */}
            {selectedLocation && (
                <button
                    onClick={handleSendLocation}
                    disabled={isSending}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isSending ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            <span>发送中...</span>
                        </>
                    ) : (
                        <span>发送位置</span>
                    )}
                </button>
            )}

            {/* Tips */}
            <p className="text-xs text-gray-500 text-center mt-3">
                💡 提示：可尝试搜索"改革大道"、"宪法广场"等
            </p>
        </div>
    );
};
