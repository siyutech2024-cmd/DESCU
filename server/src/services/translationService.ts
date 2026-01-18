
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
// Lazy load to prevent startup crash if key missing or lib failure
let aiInstance: GoogleGenAI | null = null;
const getAI = () => {
    if (!aiInstance) {
        const key = process.env.GEMINI_API_KEY;
        if (key) {
            aiInstance = new GoogleGenAI({ apiKey: key });
        }
    }
    return aiInstance;
};

interface TranslatableItem {
    id: string;
    title: string;
    description: string;
}

export const translateBatch = async (
    items: TranslatableItem[],
    targetLang: string
): Promise<TranslatableItem[]> => {
    const ai = getAI();
    if (!ai || !items.length) return items;

    // Filter out items that don't need translation or empty
    // (Optimization: In a real app, we'd detect language first)
    // For now, we send them all in a batch.

    // Limit batch size to avoid context limits. 
    // If list is huge, we process in chunks. For now assume < 50 items.
    const chunk = items.slice(0, 50);

    // Create a minified map to save tokens
    const textMap = chunk.reduce((acc, item) => {
        acc[item.id] = { t: item.title, d: item.description };
        return acc;
    }, {} as Record<string, { t: string, d: string }>);

    const prompt = `
    You are a professional translator. 
    Translate the values (t=title, d=description) in the following JSON to ${targetLang}. 
    Keep the keys (id) exactly the same.
    Do not translate proper names or brands if they are common in ${targetLang}.
    Return ONLY valid JSON.
    Input: ${JSON.stringify(textMap)}
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Upgraded to 2.5 for higher quota
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                responseMimeType: "application/json"
            }
        });

        let text = response.text;
        if (!text) return items;

        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const translatedMap = JSON.parse(text);

        // Merge translations back
        return items.map(item => {
            const translated = translatedMap[item.id];
            if (translated) {
                return {
                    ...item,
                    title: translated.t || item.title,
                    description: translated.d || item.description
                };
            }
            return item;
        });

    } catch (error) {
        console.error('Translation failed:', error);
        return items; // Fallback to original
    }
};
