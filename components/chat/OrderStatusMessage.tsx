import React from 'react';
import {
    ShoppingCart,
    DollarSign,
    MapPin,
    Truck,
    CheckCircle,
    Calendar,
    Package,
    PartyPopper,
    XCircle,
    AlertTriangle
} from 'lucide-react';

interface OrderStatusMessageProps {
    content: {
        orderId: string;
        eventType: string;
        productTitle: string;
        productImage?: string;
        amount: number;
        currency: string;
        orderType: string;
        paymentMethod: string;
        message: string;
        description: string;
        location?: string;
        time?: string;
        trackingNumber?: string;
        confirmedBy?: 'buyer' | 'seller';
        [key: string]: any;
    };
}

export const OrderStatusMessage: React.FC<OrderStatusMessageProps> = ({ content }) => {
    const {
        orderId,
        eventType,
        productTitle,
        productImage,
        amount,
        currency,
        message,
        description,
        location,
        time,
        trackingNumber
    } = content;

    // 根据事件类型配置样式
    const getEventConfig = () => {
        switch (eventType) {
            case 'created':
                return {
                    icon: <ShoppingCart size={24} />,
                    color: 'blue',
                    bgGradient: 'from-blue-50 to-indigo-50',
                    borderColor: 'border-blue-200',
                    textColor: 'text-blue-900'
                };

            case 'paid':
                return {
                    icon: <DollarSign size={24} />,
                    color: 'green',
                    bgGradient: 'from-green-50 to-emerald-50',
                    borderColor: 'border-green-200',
                    textColor: 'text-green-900'
                };

            case 'meetup_arranged':
                return {
                    icon: <MapPin size={24} />,
                    color: 'purple',
                    bgGradient: 'from-purple-50 to-pink-50',
                    borderColor: 'border-purple-200',
                    textColor: 'text-purple-900'
                };

            case 'shipped':
                return {
                    icon: <Truck size={24} />,
                    color: 'orange', bgGradient: 'from-orange-50 to-amber-50',
                    borderColor: 'border-orange-200',
                    textColor: 'text-orange-900'
                };

            case 'delivered':
                return {
                    icon: <Package size={24} />,
                    color: 'teal',
                    bgGradient: 'from-teal-50 to-cyan-50',
                    borderColor: 'border-teal-200',
                    textColor: 'text-teal-900'
                };

            case 'confirmed':
                return {
                    icon: <CheckCircle size={24} />,
                    color: 'green',
                    bgGradient: 'from-green-50 to-lime-50',
                    borderColor: 'border-green-200',
                    textColor: 'text-green-900'
                };

            case 'completed':
                return {
                    icon: <PartyPopper size={24} />,
                    color: 'green',
                    bgGradient: 'from-green-100 to-emerald-100',
                    borderColor: 'border-green-300',
                    textColor: 'text-green-900'
                };

            case 'cancelled':
                return {
                    icon: <XCircle size={24} />,
                    color: 'gray',
                    bgGradient: 'from-gray-50 to-slate-50',
                    borderColor: 'border-gray-300',
                    textColor: 'text-gray-900'
                };

            case 'disputed':
                return {
                    icon: <AlertTriangle size={24} />,
                    color: 'red',
                    bgGradient: 'from-red-50 to-orange-50',
                    borderColor: 'border-red-300',
                    textColor: 'text-red-900'
                };

            default:
                return {
                    icon: <Package size={24} />,
                    color: 'gray',
                    bgGradient: 'from-gray-50 to-slate-50',
                    borderColor: 'border-gray-200',
                    textColor: 'text-gray-900'
                };
        }
    };

    const config = getEventConfig();

    return (
        <div className={`bg-gradient-to-br ${config.bgGradient} rounded-2xl p-5 border-2 ${config.borderColor} shadow-md`}>
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
                <div className={`w-12 h-12 rounded-full bg-${config.color}-100 flex items-center justify-center flex-shrink-0`}>
                    <div className={`text-${config.color}-600`}>
                        {config.icon}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className={`font-bold ${config.textColor} text-lg mb-1`}>
                        {message}
                    </h4>
                    <p className="text-sm text-gray-600 whitespace-pre-line">
                        {description}
                    </p>
                </div>
            </div>

            {/* Product Info */}
            <div className="flex items-center gap-3 p-3 bg-white/60 rounded-xl mb-3">
                {productImage && (
                    <img
                        src={productImage}
                        alt={productTitle}
                        className="w-12 h-12 rounded-lg object-cover"
                    />
                )}
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate text-sm">
                        {productTitle}
                    </div>
                    <div className="text-xs text-gray-500">
                        ${amount.toFixed(2)} {currency}
                    </div>
                </div>
            </div>

            {/* Additional Info */}
            {(location || time || trackingNumber) && (
                <div className="space-y-2 pt-3 border-t border-gray-200/50">
                    {location && (
                        <div className="flex items-start gap-2 text-sm">
                            <MapPin size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">{location}</span>
                        </div>
                    )}
                    {time && (
                        <div className="flex items-start gap-2 text-sm">
                            <Calendar size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">{new Date(time).toLocaleString('zh-CN')}</span>
                        </div>
                    )}
                    {trackingNumber && (
                        <div className="flex items-start gap-2 text-sm">
                            <Truck size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700 font-mono">{trackingNumber}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Order ID */}
            <div className="mt-3 pt-3 border-t border-gray-200/50">
                <div className="text-xs text-gray-500 font-mono">
                    订单 #{orderId.slice(0, 8)}
                </div>
            </div>
        </div>
    );
};
