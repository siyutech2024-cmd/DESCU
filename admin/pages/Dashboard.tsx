import React, { useEffect, useState } from 'react';
import { adminApi } from '../services/adminApi';
import {
    Package,
    Users,
    MessageSquare,
    TrendingUp,
    ShoppingCart,
    AlertTriangle
} from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ElementType;
    color: string;
    trend?: string;
}

const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    subtitle,
    icon: Icon,
    color,
    trend
}) => {
    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-gray-900 mb-2">{value}</h3>
                    {subtitle && (
                        <p className="text-sm text-gray-500">{subtitle}</p>
                    )}
                    {trend && (
                        <div className="flex items-center gap-1 mt-2">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">{trend}</span>
                        </div>
                    )}
                </div>
                <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>
        </div>
    );
};

export const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const result = await adminApi.getDashboardStats();

            if (result.error) {
                setError(result.error);
                return;
            }

            setStats(result.data);
        } catch (err) {
            setError('加载数据失败');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                    <div>
                        <h3 className="font-bold text-red-900">加载失败</h3>
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    const statCards = [
        {
            title: '商品总数',
            value: stats?.stats?.totalProducts || 0,
            subtitle: `今日新增 ${stats?.stats?.productsToday || 0}`,
            icon: Package,
            color: 'bg-blue-600',
            trend: '+12% 本周'
        },
        {
            title: '用户总数',
            value: stats?.stats?.totalUsers || 0,
            subtitle: '活跃用户',
            icon: Users,
            color: 'bg-green-600',
            trend: '+8% 本周'
        },
        {
            title: '消息数量',
            value: stats?.stats?.totalMessages || 0,
            subtitle: `今日 ${stats?.stats?.messagesToday || 0}`,
            icon: MessageSquare,
            color: 'bg-purple-600',
            trend: '+15% 本周'
        },
        {
            title: '对话总数',
            value: stats?.stats?.totalConversations || 0,
            subtitle: '活跃对话',
            icon: ShoppingCart,
            color: 'bg-orange-600',
            trend: '+5% 本周'
        }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-gray-900">仪表板</h1>
                <p className="text-gray-600 mt-1">欢迎回来！这是您的平台概览</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((card, index) => (
                    <StatCard key={index} {...card} />
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 7-Day Trend */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="font-bold text-lg text-gray-900 mb-4">7天趋势</h3>
                    <div className="h-64 flex items-center justify-center text-gray-400">
                        {stats?.weeklyTrend && stats.weeklyTrend.length > 0 ? (
                            <div className="w-full">
                                <p className="text-sm text-gray-600 text-center">
                                    {stats.weeklyTrend.length} 天数据
                                </p>
                                {/* 这里可以集成图表库，如 Recharts 或 Chart.js */}
                                <div className="mt-4 space-y-2">
                                    {stats.weeklyTrend.slice(0, 7).map((item: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600">
                                                {new Date(item.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                                            </span>
                                            <span className="font-medium text-gray-900">
                                                {item.products_count} 商品
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p>暂无数据</p>
                        )}
                    </div>
                </div>

                {/* Category Distribution */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="font-bold text-lg text-gray-900 mb-4">分类分布</h3>
                    <div className="h-64 overflow-y-auto">
                        {stats?.categoryStats && stats.categoryStats.length > 0 ? (
                            <div className="space-y-3">
                                {stats.categoryStats.slice(0, 8).map((cat: any, idx: number) => {
                                    const colors = [
                                        'bg-blue-500',
                                        'bg-green-500',
                                        'bg-purple-500',
                                        'bg-orange-500',
                                        'bg-pink-500',
                                        'bg-indigo-500',
                                        'bg-red-500',
                                        'bg-teal-500'
                                    ];
                                    const total = stats.categoryStats.reduce((sum: number, c: any) => sum + c.total_count, 0);
                                    const percentage = ((cat.total_count / total) * 100).toFixed(1);

                                    return (
                                        <div key={idx}>
                                            <div className="flex items-center justify-between text-sm mb-1">
                                                <span className="text-gray-700 font-medium capitalize">
                                                    {cat.category.replace('_', ' ')}
                                                </span>
                                                <span className="text-gray-900 font-bold">
                                                    {cat.total_count} ({percentage}%)
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div
                                                    className={`${colors[idx % colors.length]} h-2 rounded-full transition-all`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                <p>暂无数据</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Products */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="font-bold text-lg text-gray-900">最新商品</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    商品
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    分类
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    价格
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    卖家
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    状态
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    发布时间
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {stats?.recentProducts && stats.recentProducts.length > 0 ? (
                                stats.recentProducts.map((product: any) => (
                                    <tr key={product.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <img
                                                    src={product.images?.[0] || '/placeholder.jpg'}
                                                    alt={product.title}
                                                    className="w-10 h-10 rounded-lg object-cover mr-3"
                                                />
                                                <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                                                    {product.title}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-600 capitalize">
                                                {product.category?.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-semibold text-gray-900">
                                                ${product.price}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-600">
                                                {product.seller_name}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-2 py-1 text-xs font-semibold rounded-full ${product.status === 'active'
                                                        ? 'bg-green-100 text-green-800'
                                                        : product.status === 'inactive'
                                                            ? 'bg-gray-100 text-gray-800'
                                                            : 'bg-yellow-100 text-yellow-800'
                                                    }`}
                                            >
                                                {product.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(product.created_at).toLocaleDateString('zh-CN')}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                                        暂无商品数据
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
