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

export interface DetailedLocationInfo {
    city: string;          // 城市名称
    town?: string;         // 城镇名称
    district?: string;     // 区域名称
    suburb?: string;       // 郊区名称
    displayName: string;   // 格式化的显示名称
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

// IP Geolocation using backend proxy to avoid CORS
export const getLocationFromIP = async (): Promise<LocationInfo | null> => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/location/ip`);
        if (!response.ok) throw new Error('IP API failed');

        const data = await response.json();

        return {
            country: data.country || 'Unknown',
            city: data.city || 'Unknown',
            countryName: data.countryName || 'Unknown'
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

// Get detailed location information with town/district level granularity
// Uses localStorage cache to avoid redundant Nominatim calls (1h TTL)
export const getDetailedLocation = async (
    latitude: number,
    longitude: number
): Promise<DetailedLocationInfo> => {
    // Cache: round to 3 decimals (~111m precision) for cache key
    const cacheKey = `geo_cache_${latitude.toFixed(3)}_${longitude.toFixed(3)}`;
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const { data, ts } = JSON.parse(cached);
            if (Date.now() - ts < 3600000) { // 1 hour TTL
                console.log('[LocationService] 使用缓存:', cacheKey);
                return data as DetailedLocationInfo;
            }
        }
    } catch { /* ignore cache errors */ }

    try {
        // Use our backend proxy to avoid CORS issues
        const response = await fetch(
            `${API_BASE_URL}/api/location/reverse?lat=${latitude}&lon=${longitude}`
        );

        if (!response.ok) {
            throw new Error('Geocoding failed');
        }

        const data = await response.json();
        const address = data.address;

        // Extract location components with priority
        // Note: Different cities return different fields:
        // - Mexico City often returns "borough" (e.g., "Cuauhtémoc")
        // - Other cities may return "suburb", "district", "town", or "village"
        const city = address.city || address.county || address.state || 'Unknown';
        const town = address.town || address.village;
        const district = address.borough || address.suburb || address.neighbourhood || address.district;
        const suburb = address.suburb;

        // Build display name: City · Town/District
        // Format examples:
        // - "Mexico City · Coyoacán"
        // - "Los Angeles · Santa Monica"
        // - "Beijing · Chaoyang District"
        let displayName = city;
        if (town) {
            displayName += ` · ${town}`;
        } else if (district) {
            displayName += ` · ${district}`;
        }

        const result = {
            city,
            town,
            district,
            suburb,
            displayName
        };

        console.log('[LocationService] 解析结果:', result);

        // Persist to cache
        try {
            localStorage.setItem(cacheKey, JSON.stringify({ data: result, ts: Date.now() }));
        } catch { /* quota exceeded or SSR — ignore */ }

        return result;
    } catch (error) {
        console.error('Error getting detailed location:', error);
        // Return fallback with empty display name
        return {
            city: 'Unknown',
            displayName: '定位中...'
        };
    }
};
