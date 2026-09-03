import React, { useState } from 'react';
import { Filter, X } from 'lucide-react';

interface AdvancedFiltersProps {
    onApply: (filters: FilterValues) => void;
    onReset: () => void;
}

export interface FilterValues {
    minPrice?: number;
    maxPrice?: number;
    startDate?: string;
    endDate?: string;
    promotedOnly?: boolean | null;
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({ onApply, onReset }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filters, setFilters] = useState<FilterValues>({});

    const handleApply = () => {
        onApply(filters);
        setIsOpen(false);
    };

    const handleReset = () => {
        setFilters({});
        onReset();
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
                <Filter className="w-4 h-4" />
                高级筛选
                {Object.keys(filters).some(k => filters[k as keyof FilterValues] !== undefined) && (
                    <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                )}
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Filter Panel */}
                    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border z-50 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">高级筛选</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Price Range */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    价格范围 (MXN)
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="number"
                                        placeholder="最低价"
                                        value={filters.minPrice || ''}
                                        onChange={(e) => setFilters({
                                            ...filters,
                                            minPrice: e.target.value ? Number(e.target.value) : undefined
                                        })}
                                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                    <input
                                        type="number"
                                        placeholder="最高价"
                                        value={filters.maxPrice || ''}
                                        onChange={(e) => setFilters({
                                            ...filters,
                                            maxPrice: e.target.value ? Number(e.target.value) : undefined
                                        })}
                                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Date Range */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    创建日期范围
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="date"
                                        value={filters.startDate || ''}
                                        onChange={(e) => setFilters({
                                            ...filters,
                                            startDate: e.target.value
                                        })}
                                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                    <input
                                        type="date"
                                        value={filters.endDate || ''}
                                        onChange={(e) => setFilters({
                                            ...filters,
                                            endDate: e.target.value
                                        })}
                                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Promoted Status */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    推荐状态
                                </label>
                                <div className="flex gap-4">
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            name="promoted"
                                            checked={filters.promotedOnly === null || filters.promotedOnly === undefined}
                                            onChange={() => setFilters({ ...filters, promotedOnly: null })}
                                            className="mr-2"
                                        />
                                        <span className="text-sm">全部</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            name="promoted"
                                            checked={filters.promotedOnly === true}
                                            onChange={() => setFilters({ ...filters, promotedOnly: true })}
                                            className="mr-2"
                                        />
                                        <span className="text-sm">仅推荐</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            name="promoted"
                                            checked={filters.promotedOnly === false}
                                            onChange={() => setFilters({ ...filters, promotedOnly: false })}
                                            className="mr-2"
                                        />
                                        <span className="text-sm">非推荐</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={handleReset}
                                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                重置
                            </button>
                            <button
                                onClick={handleApply}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                应用筛选
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
