import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { API_BASE_URL } from '../services/apiConfig';
import { AddressForm } from './AddressForm';
import { Plus, Loader2, Trash2, Edit2, CheckCircle2, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Address {
    id: string;
    recipient_name: string;
    phone_number: string;
    street_address: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
    is_default: boolean;
}

interface AddressListProps {
    onSelect?: (address: Address) => void;
    selectedId?: string;
    selectable?: boolean;
}

export const AddressList: React.FC<AddressListProps> = ({ onSelect, selectedId, selectable = false }) => {
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);

    useEffect(() => {
        fetchAddresses();
    }, []);

    const fetchAddresses = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`${API_BASE_URL}/api/users/addresses`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setAddresses(data.addresses);
                // Auto-select default if none selected and selectable mode
                if (selectable && !selectedId && data.addresses.length > 0) {
                    const def = data.addresses.find((a: Address) => a.is_default) || data.addresses[0];
                    if (onSelect) onSelect(def);
                }
            }
        } catch (error) {
            console.error('Failed to load addresses', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (data: any) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const method = editingAddress ? 'PUT' : 'POST';
            const url = editingAddress
                ? `${API_BASE_URL}/api/users/addresses/${editingAddress.id}`
                : `${API_BASE_URL}/api/users/addresses`;

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.access_token}`
                },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                fetchAddresses();
                setIsAdding(false);
                setEditingAddress(null);
                toast.success(editingAddress ? 'Address updated' : 'Address added');
            } else {
                toast.error('Failed to save address');
            }
        } catch (error) {
            toast.error('Network error');
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this address?')) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_BASE_URL}/api/users/addresses/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session?.access_token}` }
            });

            if (res.ok) {
                setAddresses(prev => prev.filter(a => a.id !== id));
                toast.success('Address deleted');
                // Use functional update or re-fetch if currently selected deleted
                if (selectedId === id && onSelect) {
                    onSelect(null as any); // Or pick next available
                }
            } else {
                toast.error('Failed to delete');
            }
        } catch (error) {
            toast.error('Network error');
        }
    };

    if (loading) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-brand-600" /></div>;

    if (isAdding || editingAddress) {
        return (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4">{editingAddress ? 'Edit Address' : 'Add New Address'}</h3>
                <AddressForm
                    initialData={editingAddress}
                    onSubmit={handleSave}
                    onCancel={() => { setIsAdding(false); setEditingAddress(null); }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {addresses.map(addr => (
                <div
                    key={addr.id}
                    onClick={() => selectable && onSelect && onSelect(addr)}
                    className={`relative p-4 rounded-xl border transition-all cursor-pointer group ${selectable
                            ? selectedId === addr.id
                                ? 'border-brand-500 bg-brand-50 shadow-sm ring-1 ring-brand-500'
                                : 'border-gray-200 bg-white hover:border-brand-200 hover:bg-gray-50'
                            : 'border-gray-200 bg-white'
                        }`}
                >
                    <div className="flex justify-between items-start">
                        <div className="flex gap-3">
                            <div className={`mt-0.5 ${selectedId === addr.id ? 'text-brand-600' : 'text-gray-400'}`}>
                                <MapPin size={20} />
                            </div>
                            <div>
                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                    {addr.recipient_name}
                                    <span className="text-gray-500 font-normal text-sm">{addr.phone_number}</span>
                                    {addr.is_default && (
                                        <span className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded border border-gray-200 uppercase font-semibold">Default</span>
                                    )}
                                </div>
                                <div className="text-sm text-gray-600 mt-0.5">
                                    {addr.street_address}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {addr.city}, {addr.state} {addr.zip_code}
                                </div>
                            </div>
                        </div>

                        {selectable && selectedId === addr.id && (
                            <div className="absolute top-4 right-4 text-brand-600">
                                <CheckCircle2 size={20} fill="currentColor" className="text-brand-100" stroke="currentColor" /> // Simplified icon
                            </div>
                        )}

                        <div className={`flex items-center gap-1 ${selectable ? 'opacity-0 group-hover:opacity-100' : ''} transition-opacity absolute top-4 right-4 bg-white/80 p-0.5 rounded shadow-sm`}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setEditingAddress(addr); }}
                                className="p-1.5 text-gray-500 hover:text-brand-600 rounded hover:bg-gray-100"
                                title="Edit"
                            >
                                <Edit2 size={14} />
                            </button>
                            <button
                                onClick={(e) => handleDelete(addr.id, e)}
                                className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100"
                                title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            ))}

            <button
                onClick={() => setIsAdding(true)}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center gap-2"
            >
                <Plus size={20} />
                Add New Address
            </button>
        </div>
    );
};
