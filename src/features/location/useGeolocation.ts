import { useEffect, useState } from 'react';
import type { Coordinates } from '@/types';
import { getDetailedLocation, DetailedLocationInfo } from '@/services/locationService';

/** Mexico City — used whenever the browser cannot provide a position. */
export const FALLBACK_LOCATION: Coordinates = { latitude: 19.4326, longitude: -99.1332 };

export interface GeolocationState {
    location: Coordinates | null;
    locationInfo: DetailedLocationInfo | null;
    isLoading: boolean;
    permissionDenied: boolean;
}

/**
 * Resolve the device position once on mount, then reverse-geocode it for display.
 * Falls back to Mexico City when permission is denied or geolocation is unavailable.
 */
export const useGeolocation = (): GeolocationState => {
    const [state, setState] = useState<GeolocationState>({
        location: null,
        locationInfo: null,
        isLoading: true,
        permissionDenied: false,
    });

    useEffect(() => {
        let cancelled = false;

        const fallback = () => {
            if (cancelled) return;
            setState({ location: FALLBACK_LOCATION, locationInfo: null, isLoading: false, permissionDenied: true });
        };

        if (!('geolocation' in navigator)) {
            fallback();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position => {
                if (cancelled) return;
                const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
                setState({ location: coords, locationInfo: null, isLoading: false, permissionDenied: false });

                getDetailedLocation(coords.latitude, coords.longitude)
                    .then(detail => {
                        if (!cancelled && detail) setState(prev => ({ ...prev, locationInfo: detail }));
                    })
                    .catch(err => console.warn('[location] getDetailedLocation error:', err));
            },
            error => {
                console.warn('[location] geolocation error:', error.message);
                fallback();
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 3_600_000 }
        );

        return () => {
            cancelled = true;
        };
    }, []);

    return state;
};
