import React, { useState } from 'react';
import { X } from 'lucide-react';
import { showToast } from '../utils/toast';

interface BatchOperationModalProps {
    selectedCount: number;
    onClose: () => void;
    onExecute: (operation: string, params?: any) => Promise<void>;
}

export const BatchOperationModal: React.FC<BatchOperationModalProps> = ({
    selectedCount,
    onClose,
    onExecute
}) => {
    const [operation, setOperation] = useState<string>('');
    const [category, setCategory] = useState('');
    const [status, setStatus] = useState('');
    const [processing, setProcessing] = useState(false);

    const handleExecute = async () => {
        if (!operation) {
            showToast.error('请选择操作类型');
            return;
        }

        let params: any = {};
        if (operation === 'change_category') {
            if (!category) {
                showToast.error('请选择新分类');
                return;
            }
            params = { category };
        } else if (operation === 'change_status') {
            if (!status) {
                showToast.error('请选择新状态');
                return;
            }
            params = { status };
        }

        setProcessing(true);
        try {
            await onExecute(operation, params);
            onClose();
        } catch (error) {
            // Error handled by parent
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">批量操作</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                        已选择 <span className="font-bold">{selectedCount}</span> 个商品
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Operation Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            操作类型 *
                        </label>
                        <select
                            value={operation}
                            onChange={(e) => setOperation(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                            <option value="">选择操作</option>
                            <option value="change_category">修改分类</option>
                            <option value="change_status">修改状态</option>
                            <option value="promote">设为推荐</option>
                            <option value="unpromote">取消推荐</option>
                            <option value="delete">删除商品</option>
                        </select>
                    </div>

                    {/* Category Selection */}
                    {operation === 'change_category' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                新分类 *
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                                <option value="">选择分类</option>
                                <option value="electronics">电子产品</option>
                                <option value="furniture">家具</option>
                                <option value="clothing">服装</option>
                                <option value="books">图书</option>
                                <option value="sports">运动</option>
                                <option value="vehicles">车辆</option>
                                <option value="real_estate">房产</option>
                                <option value="services">服务</option>
                                <option value="other">其他</option>
                            </select>
                        </div>
                    )}

                    {/* Status Selection */}
                    {operation === 'change_status' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                新状态 *
                            </label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                                <option value="">选择状态</option>
                                <option value="active">在售</option>
                                <option value="inactive">已下架</option>
                                <option value="pending_review">待审核</option>
                            </select>
                        </div>
                    )}

                    {/* Warning for delete */}
                    {operation === 'delete' && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-800">
                                ⚠️ 警告：此操作将永久删除选中的商品，无法恢复！
                            </p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        disabled={processing}
                        className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleExecute}
                        disabled={processing || !operation}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {processing ? '处理中...' : '执行操作'}
                    </button>
                </div>
            </div>
        </div>
    );
};
