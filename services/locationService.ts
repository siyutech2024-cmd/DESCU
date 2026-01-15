
// Service to handle location related operations

interface GeocodeResult {
    city: string;
    country: string;
    display_name: string;
}

export const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
            {
                headers: {
                    'User-Agent': 'DescuMarketplace/1.0',
                    'Accept-Language': 'es, en' // Prefer Spanish for local names in Mexico
                }
            }
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
