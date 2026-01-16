
// Service to handle location related operations

interface GeocodeResult {
    city: string;
    country: string;
    display_name: string;
}

export const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
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
