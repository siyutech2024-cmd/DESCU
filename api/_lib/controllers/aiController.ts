import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

// --- LAZY AI INIT ---
let aiInstance: GoogleGenAI | null = null;
const getAI = () => {
    if (!aiInstance) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return null;
        aiInstance = new GoogleGenAI({ apiKey });
    }
    return aiInstance;
};

export const analyzeImage = async (req: Request, res: Response) => {
    try {
        const { image, language } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'Image data is required' });
        }

        const ai = getAI();
        if (!ai) {
            console.error('Gemini API Key is missing in server environment variables.');
            return res.status(500).json({ error: 'Gemini API not configured (Server)' });
        }

        // Schema definition (simplified for backend)
        const PRODUCT_SCHEMA = {
            type: "OBJECT",
            properties: {
                title: { type: "STRING" },
                description: { type: "STRING" },
                category: { type: "STRING", enum: ['electronics', 'furniture', 'clothing', 'books', 'sports', 'vehicles', 'real_estate', 'services', 'other'] },
                suggestedPrice: { type: "NUMBER" },
                suggestedDeliveryType: { type: "STRING", enum: ['meetup', 'shipping', 'both'] }
            },
            required: ["title", "description", "category", "suggestedPrice", "suggestedDeliveryType"],
        };

        const getLanguageName = (lang: string): string => {
            switch (lang) {
                case 'zh': return 'Chinese';
                case 'es': return 'Spanish (Mexico)';
                case 'en': return 'English';
                default: return 'Spanish';
            }
        };

        const langName = getLanguageName(language || 'es');

        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash", // Upgraded to 2.5 for higher quota
                contents: {
                    parts: [
                        {
                            inlineData: {
                                mimeType: "image/jpeg",
                                data: image.replace(/^data:image\/\w+;base64,/, ""), // Ensure base64 is clean
                            },
                        },
                        {
                            text: `You are an expert marketplace assistant for DESCU in Mexico. 
                  SAFETY INSTRUCTIONS:
                  - Do not generate descriptions for items containing hate speech, Nazi symbols, or extremist political propaganda.
                  - Do not generate descriptions for items promoting political misinformation or election interference.
                  - If the image contains sensitive political figures or controversial propaganda, return a neutral but firm description refusing the listing due to safety policies.
                  
                  TASK: Analyze this image and generate a listing. The title and description MUST be in ${langName}. The category must be one of the enum values provided. If it looks like a car, use 'vehicles'. If it looks like a house/apartment, use 'real_estate'. For large items, suggest 'meetup' as delivery type.`,
                        },
                    ],
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: PRODUCT_SCHEMA as any, // Type cast for now
                    temperature: 0.4,
                },
            });

            // Verify response structure for @google/genai SDK
            // TypeScript says response.text is a String (getter), so use it directly.
            const text = response.text;

            if (!text) {
                console.error("Gemini Empty Response:", JSON.stringify(response, null, 2));
                throw new Error("No text returned from Gemini");
            }

            // Clean markdown code blocks if present (e.g. ```json ... ```)
            const cleanText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');

            const data = JSON.parse(cleanText);
            res.json(data);

        } catch (error: any) {
            console.error('AI Analysis failed:', error);
            res.status(500).json({
                error: 'Failed to analyze image',
                details: error.message || 'Unknown error'
            });
        }

    } catch (error) {
        console.error('AI Analysis failed (General):', error);
        res.status(500).json({ error: 'Failed to analyze image' });
    }
};
