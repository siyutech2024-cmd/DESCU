import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../services/apiConfig';
import { supabase } from '../../services/supabase';
import { Loader2, Users, ShoppingBag, MessageSquare, TrendingUp, DollarSign } from 'lucide-react';

interface StatsData {
    stats: {
        totalProducts: number;
        productsToday: number;
        activeProducts: number;
        totalUsers: number;
        totalMessages: number;
        messagesToday: number;
        totalConversations: number;
    };
    weeklyTrend: any[];
    recentProducts: any[];
}

export const AdminDashboardStats: React.FC = () => {
    const [data, setData] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_BASE_URL}/api/admin/dashboard/stats`, {
                headers: { Authorization: `Bearer ${session?.access_token}` }
            });
            if (res.ok) {
                const stats = await res.json();
                setData(stats);
            }
        } catch (error) {
            console.error('Failed to fetch stats', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-brand-600" /></div>;
    if (!data) return <div className="p-8 text-center text-gray-500">Failed to load statistics</div>;

    const cards = [
        { title: 'Total Users', value: data.stats.totalUsers, icon: Users, color: 'bg-blue-500' },
        { title: 'Active Listings', value: data.stats.activeProducts, icon: ShoppingBag, color: 'bg-emerald-500' },
        { title: 'New Products (24h)', value: data.stats.productsToday, icon: TrendingUp, color: 'bg-purple-500' },
        { title: 'Messages (Total)', value: data.stats.totalMessages, icon: MessageSquare, color: 'bg-indigo-500' },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card, i) => (
                    <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                        <div>
                            <p className="text-sm font-medium text-gray-500">{card.title}</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{card.value}</h3>
                        </div>
                        <div className={`p-3 rounded-lg ${card.color} bg-opacity-10`}>
                            <card.icon className={`w-6 h-6 ${card.color.replace('bg-', 'text-')}`} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Activity Section could go here */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-4">Recent Products</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-medium">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Product</th>
                                <th className="px-4 py-3">Price</th>
                                <th className="px-4 py-3">Seller</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 rounded-r-lg">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.recentProducts.map((p: any) => (
                                <tr key={p.id} className="hover:bg-gray-50/50">
                                    <td className="px-4 py-3 font-medium text-gray-900">{p.title}</td>
                                    <td className="px-4 py-3 font-mono text-gray-600">${p.price} {p.currency}</td>
                                    <td className="px-4 py-3 text-gray-600">{p.seller_name || p.seller_email}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {p.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">
                                        {new Date(p.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
