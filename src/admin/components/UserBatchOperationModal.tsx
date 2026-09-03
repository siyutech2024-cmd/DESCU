import React, { useState } from 'react';
import { X } from 'lucide-react';
import { showToast } from '../utils/toast';

interface UserBatchOperationModalProps {
    selectedCount: number;
    onClose: () => void;
    onExecute: (operation: string) => Promise<void>;
}

export const UserBatchOperationModal: React.FC<UserBatchOperationModalProps> = ({
    selectedCount,
    onClose,
    onExecute
}) => {
    const [operation, setOperation] = useState<string>('');
    const [processing, setProcessing] = useState(false);

    const handleExecute = async () => {
        if (!operation) {
            showToast.error('请选择操作类型');
            return;
        }

        setProcessing(true);
        try {
            await onExecute(operation);
            onClose();
        } catch (error) {
            //  Error handled by parent
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">批量操作用户</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                        已选择 <span className="font-bold">{selectedCount}</span> 个用户
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
                            <option value="verify">批量认证</option>
                            <option value="unverify">取消认证</option>
                            <option value="disable">禁用账户</option>
                            <option value="enable">启用账户</option>
                            <option value="export">导出数据</option>
                        </select>
                    </div>

                    {/* Warning for disable */}
                    {operation === 'disable' && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-800">
                                ⚠️ 警告：禁用后用户将无法登录系统！
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
