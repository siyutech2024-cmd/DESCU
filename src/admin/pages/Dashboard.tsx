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
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

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

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#14B8A6'];

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
                <button
                    onClick={loadDashboardData}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                    重试
                </button>
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

    // 准备图表数据
    const trendData = stats?.weeklyTrend?.map((item: any) => ({
        date: new Date(item.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
        products: item.products_count || 0,
        users: item.users_count || 0,
    })) || [];

    const categoryData = stats?.categoryStats?.map((cat: any, idx: number) => ({
        name: cat.category || '其他',
        value: cat.count || 0,
        color: COLORS[idx % COLORS.length]
    })) || [];

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
                {/* 7-Day Trend Chart */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="font-bold text-lg text-gray-900 mb-4">7天趋势</h3>
                    <div className="h-64">
                        {trendData && trendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorProducts" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                                    <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#fff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                        }}
                                    />
                                    <Legend />
                                    <Area
                                        type="monotone"
                                        dataKey="products"
                                        stroke="#3B82F6"
                                        fillOpacity={1}
                                        fill="url(#colorProducts)"
                                        name="商品"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="users"
                                        stroke="#10B981"
                                        fillOpacity={1}
                                        fill="url(#colorUsers)"
                                        name="用户"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <p>暂无数据</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Category Distribution Pie Chart */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="font-bold text-lg text-gray-900 mb-4">分类分布</h3>
                    <div className="h-64">
                        {categoryData && categoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) =>
                                            `${name} ${(percent * 100).toFixed(0)}%`
                                        }
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <p>暂无数据</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg text-gray-900 mb-4">最近活动</h3>
                <div className="space-y-3">
                    {stats?.recentProducts && stats.recentProducts.length > 0 ? (
                        stats.recentProducts.slice(0, 5).map((product: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                                <img
                                    src={product.images?.[0] || 'https://via.placeholder.com/40'}
                                    alt={product.title}
                                    className="w-10 h-10 rounded object-cover"
                                />
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">{product.title}</p>
                                    <p className="text-sm text-gray-500">
                                        {product.seller_name} • {new Date(product.created_at).toLocaleDateString('zh-CN')}
                                    </p>
                                </div>
                                <span className="text-sm font-semibold text-blue-600">¥{product.price}</span>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-gray-400 py-8">暂无最近活动</p>
                    )}
                </div>
            </div>
        </div>
    );
};
