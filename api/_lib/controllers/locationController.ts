
import { Request, Response } from 'express';

// Reverse Geocode Proxy (Server-side to avoid CORS)
export const reverseGeocodeProxy = async (req: Request, res: Response) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'DescuMarketplace/1.0',
                'Accept-Language': 'es, en'
            }
        });

        if (!response.ok) {
            throw new Error(`Nominatim API Error: ${response.statusText}`);
        }

        const data = await response.json();
        res.json(data);

    } catch (error: any) {
        console.error('Location Proxy Error:', error);
        res.status(500).json({ error: 'Failed to fetch location data' });
    }
};
