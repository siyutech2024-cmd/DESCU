import React, { useState, useEffect } from 'react';
import { X, MapPin, Clock, Calendar } from 'lucide-react';
import { Order } from '../types';
import { LocationPicker } from './LocationPicker';
import { API_BASE_URL } from '../services/apiConfig';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

interface MeetupArrangementModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order;
    onSuccess: () => void;
}

export const MeetupArrangementModal: React.FC<MeetupArrangementModalProps> = ({ isOpen, onClose, order, onSuccess }) => {
    const [location, setLocation] = useState(order.meetup_location || '');
    const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [time, setTime] = useState(order.meetup_time ? new Date(order.meetup_time).toISOString().slice(0, 16) : '');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLocation(order.meetup_location || '');
            setTime(order.meetup_time ? new Date(order.meetup_time).toISOString().slice(0, 16) : '');
            // Removed incorrect order.location check
        }
    }, [isOpen, order]);

    const handleSubmit = async () => {
        if (!location || !time) {
            toast.error('Please provide both location and time');
            return;
        }

        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            const payload = {
                location,
                time: new Date(time).toISOString(),
                lat: coords?.lat,
                lng: coords?.lng
            };

            const res = await fetch(`${API_BASE_URL}/api/orders/${order.id}/arrange-meetup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to update meetup details');

            toast.success('Meetup arranged successfully!');
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Failed to arrange meetup');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                        <MapPin className="text-brand-600" />
                        Arrange Meetup
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Location Section */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <MapPin size={16} /> Location
                        </label>
                        <LocationPicker
                            value={location}
                            onChange={(val, c) => {
                                setLocation(val);
                                if (c) setCoords({ lat: c.latitude, lng: c.longitude });
                            }}
                        />
                    </div>

                    {/* Time Section */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Clock size={16} /> Time
                        </label>
                        <div className="relative">
                            <input
                                type="datetime-local"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none font-medium text-gray-800"
                            />
                            {/* Custom calendar icon overlay could go here if removing native picker indicator, but native is best for mobile */}
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl flex gap-3 items-start text-sm text-blue-800 border border-blue-100">
                        <Calendar size={20} className="flex-shrink-0 mt-0.5" />
                        <p>
                            Choose a safe, public location (like a cafe or mall) and a time that works for both.
                            Payment will be released only after you confirm the meetup.
                        </p>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-brand-200"
                    >
                        {isLoading ? <span className="animate-spin">⌛</span> : 'Confirm Details'}
                    </button>
                </div>
            </div>
        </div>
    );
};
