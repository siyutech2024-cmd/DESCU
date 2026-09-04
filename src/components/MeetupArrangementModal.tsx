import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Calendar } from 'lucide-react';
import { Order } from '../types';
import { LocationPicker } from './LocationPicker';
import { api } from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Sheet } from './ui/Sheet';

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
            const payload = {
                location,
                time: new Date(time).toISOString(),
                lat: coords?.lat,
                lng: coords?.lng
            };

            await api.post(`/api/orders/${order.id}/arrange-meetup`, payload, { auth: 'optional' });

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
        <Sheet
            open={isOpen}
            onClose={onClose}
            size="md"
            layer="modal-top"
            title={
                <span className="flex items-center gap-2">
                    <MapPin className="text-brand-600" />
                    Arrange Meetup
                </span>
            }
        >
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
        </Sheet>
    );
};
