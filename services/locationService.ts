import { API_BASE_URL } from './apiConfig';

// Service to handle location related operations

interface GeocodeResult {
    city: string;
    country: string;
    display_name: string;
}

export interface LocationInfo {
    country: string;       // e.g., "MX", "US", "CN"
    city: string;          // e.g., "Mexico City", "Los Angeles"
    countryName: string;   // e.g., "Mexico"
}

export const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
        // Use our backend proxy to avoid CORS issues
        const response = await fetch(
            `${API_BASE_URL}/api/location/reverse?lat=${latitude}&lon=${longitude}`
        );

        if (!response.ok) {
            throw new Error('Geocoding failed');
        }

        const data = await response.json();

        // Extract the most relevant city/town name
        // Nominatim returns address object with varying keys depending on location type
        const address = data.address;

        // Priorities: city -> town -> village -> suburb -> county -> state
        const locationName =
            address.city ||
            address.town ||
            address.village ||
            address.suburb ||
            address.county ||
            "Unknown Location";

        return locationName;
    } catch (error) {
        console.error('Error reverse geocoding:', error);
        return ""; // Return empty string to let caller decide fallback
    }
};

// IP Geolocation using ipapi.co (free tier: 1000 requests/day)
export const getLocationFromIP = async (): Promise<LocationInfo | null> => {
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error('IP API failed');

        const data = await response.json();

        return {
            country: data.country_code || 'Unknown',
            city: data.city || 'Unknown',
            countryName: data.country_name || 'Unknown'
        };
    } catch (error) {
        console.error('Failed to get location from IP:', error);
        return null;
    }
};

// Check if user can purchase a product based on location rules
export const canPurchaseProduct = (
    userCountry: string,
    userCity: string,
    productCountry: string,
    productCity: string,
    deliveryType: 'shipping' | 'meetup' | 'both'
): { canPurchase: boolean; reason?: string } => {
    // Rule 1: Must be same country
    if (userCountry !== productCountry) {
        return {
            canPurchase: false,
            reason: `此产品仅限${productCountry}地区购买 / Only available in ${productCountry}`
        };
    }

    // Rule 2: If product is local-only (meetup), must be same city
    if (deliveryType === 'meetup' && userCity !== productCity) {
        return {
            canPurchase: false,
            reason: `此产品仅限${productCity}同城交易 / Local pickup in ${productCity} only`
        };
    }

    return { canPurchase: true };
};
