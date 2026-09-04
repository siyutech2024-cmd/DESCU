import { GoogleGenAI } from '@google/genai';
import { HttpError, asyncHandler, parseBody } from '../lib/http.js';
import type { AuthenticatedRequest } from '../middleware/userAuth.js';
import { AnalyzeImageSchema } from '../schemas/products.js';

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

export const analyzeImage = asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { image, language } = parseBody(AnalyzeImageSchema, req.body);

    const ai = getAI();
    if (!ai) {
        console.error('Gemini API Key is missing in server environment variables.');
        throw new HttpError(500, 'Gemini API not configured (Server)');
    }

    const langName = getLanguageName(language || 'es');

    // The upstream call can fail for many reasons (quota, safety block, malformed JSON); the
    // client only needs to know the analysis failed — the cause goes to the server log.
    let data: unknown;
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

        // TypeScript says response.text is a String (getter), so use it directly.
        const text = response.text;
        if (!text) {
            console.error("Gemini Empty Response:", JSON.stringify(response, null, 2));
            throw new Error("No text returned from Gemini");
        }

        // Clean markdown code blocks if present (e.g. ```json ... ```)
        const cleanText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        data = JSON.parse(cleanText);
    } catch (error) {
        console.error('AI Analysis failed:', error);
        throw new HttpError(500, 'Failed to analyze image');
    }

    res.json(data);
});
