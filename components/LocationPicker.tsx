import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Search } from 'lucide-react';
import { Coordinates } from '../types';

interface LocationPickerProps {
    value?: string;
    onChange: (location: string, coordinates?: Coordinates) => void;
    placeholder?: string;
    className?: string;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({ value = '', onChange, placeholder, className = '' }) => {
    const [inputValue, setInputValue] = useState(value);
    const [isLocating, setIsLocating] = useState(false);

    useEffect(() => {
        setInputValue(value);
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setInputValue(newVal);
        onChange(newVal); // Only update text for now
    };

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                // In a real app, reverse geocode here.
                // For MVP, we pass coordinates and a placeholder text
                const coordsText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

                // Attempt to fetch address (Using a free API like OpenStreetMap/Nominatim if allowed, 
                // but to avoid external deps issues, we might just use formatted coords or mock)
                // Let's just use "Current Location (Lat, Lng)" for safety or try a simple fetch if possible.
                // We'll stick to coordinates string to be safe and fast.

                const locText = `Location: ${coordsText}`;
                setInputValue(locText);
                onChange(locText, { latitude, longitude });
                setIsLocating(false);
            },
            (error) => {
                console.error("Location error", error);
                setIsLocating(false);
                // Don't alert, just fail silently or show toast handled by parent
            }
        );
    };

    return (
        <div className={`relative ${className}`}>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="text-gray-400" size={18} />
                </div>
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder={placeholder || "Enter meeting location (e.g. Starbucks, Central Park)"}
                    className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all outline-none"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        disabled={isLocating}
                        className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-brand-600 transition-colors"
                        title="Use current location"
                    >
                        {isLocating ? <span className="animate-spin text-lg">⟳</span> : <Navigation size={18} />}
                    </button>
                </div>
            </div>
            {/* Map Preview Placeholder - Could be an image or iframe */}
            <div className="mt-2 h-32 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden relative group">
                <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')] opacity-10 bg-center bg-cover"></div>
                <div className="z-10 text-center px-4">
                    <p className="text-xs text-gray-500 font-medium">Map Preview</p>
                    <p className="text-xs text-brand-600 font-bold mt-1">
                        {inputValue ? inputValue : "Select a location"}
                    </p>
                </div>
            </div>
        </div>
    );
};
