import React, { useEffect, useState } from 'react';
import { adminApi } from '../services/adminApi';
import { Settings as SettingsIcon, Save, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { SystemSetting } from '../types/admin';

export const Settings: React.FC = () => {
    const [settings, setSettings] = useState<SystemSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const result = await adminApi.getSettings();

            if (result.error) {
                setError(result.error);
                return;
            }

            setSettings(result.data?.settings || []);

            // Initialize edited settings
            const initialValues: Record<string, string> = {};
            result.data?.settings?.forEach((setting) => {
                initialValues[setting.setting_key] = setting.setting_value;
            });
            setEditedSettings(initialValues);
        } catch (err) {
            setError('加载设置失败');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (key: string, value: string) => {
        setEditedSettings((prev) => ({
            ...prev,
            [key]: value
        }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError('');
            setSuccess('');

            // Prepare settings array for batch update
            const settingsToUpdate = Object.entries(editedSettings).map(([key, value]) => {
                const original = settings.find((s) => s.setting_key === key);
                return {
                    setting_key: key,
                    setting_value: value,
                    description: original?.description || null
                };
            });

            const result = await adminApi.batchUpdateSettings(settingsToUpdate);

            if (result.error) {
                setError(result.error);
                return;
            }

            setSuccess('设置已成功保存！');
            setTimeout(() => setSuccess(''), 3000);

            // Reload settings to get updated values
            loadSettings();
        } catch (err) {
            setError('保存设置失败');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = () => {
        return settings.some(
            (setting) => editedSettings[setting.setting_key] !== setting.setting_value
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-gray-900">系统设置</h1>
                    <p className="text-gray-600 mt-1">管理系统配置和参数</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={loadSettings}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        刷新
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges() || saving}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${!hasChanges() || saving
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-orange-600 text-white hover:bg-orange-700'
                            }`}
                    >
                        <Save className="w-4 h-4" />
                        {saving ? '保存中...' : '保存更改'}
                    </button>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-700">{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p className="text-green-700">{success}</p>
                </div>
            )}

            {/* Settings Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {settings && settings.length > 0 ? (
                    settings.map((setting) => {
                        const isBooleanSetting = ['true', 'false'].includes(
                            setting.setting_value.toLowerCase()
                        );

                        return (
                            <div
                                key={setting.setting_key}
                                className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <SettingsIcon className="w-6 h-6 text-orange-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-bold text-gray-900 mb-1 capitalize">
                                            {setting.setting_key.replace(/_/g, ' ')}
                                        </h3>
                                        {setting.description && (
                                            <p className="text-sm text-gray-600 mb-4">
                                                {setting.description}
                                            </p>
                                        )}

                                        {isBooleanSetting ? (
                                            <div className="flex items-center gap-3">
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            editedSettings[setting.setting_key] === 'true'
                                                        }
                                                        onChange={(e) =>
                                                            handleChange(
                                                                setting.setting_key,
                                                                e.target.checked ? 'true' : 'false'
                                                            )
                                                        }
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                                                    <span className="ml-3 text-sm font-medium text-gray-700">
                                                        {editedSettings[setting.setting_key] === 'true'
                                                            ? '启用'
                                                            : '禁用'}
                                                    </span>
                                                </label>
                                            </div>
                                        ) : (
                                            <input
                                                type="text"
                                                value={editedSettings[setting.setting_key] || ''}
                                                onChange={(e) =>
                                                    handleChange(setting.setting_key, e.target.value)
                                                }
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                placeholder="输入设置值"
                                            />
                                        )}

                                        {editedSettings[setting.setting_key] !==
                                            setting.setting_value && (
                                                <p className="text-xs text-orange-600 mt-2">
                                                    • 已修改，尚未保存
                                                </p>
                                            )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-2 bg-white rounded-xl p-12 text-center">
                        <SettingsIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">暂无系统设置</p>
                    </div>
                )}
            </div>
        </div>
    );
};
