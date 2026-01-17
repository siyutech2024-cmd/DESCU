
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Fail gracefully if no key is found
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export interface AIAnalysisResult {
  title: string;
  price: number;
  currency: string;
  description: string;
  category: string;
  deliveryType: 'Meetup' | 'Shipping' | 'Both';
}

export const analyzeImageWithGemini = async (imageBase64: string): Promise<AIAnalysisResult | null> => {
  if (!genAI) {
    console.warn("Gemini API Key is missing");
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    // Clean base64 string if needed (remove data:image/jpeg;base64, prefix)
    const base64Data = imageBase64.split(',')[1] || imageBase64;

    const prompt = `
      Analyze this image for a second-hand marketplace listing.
      Return a STRICT JSON object (no markdown, no extra text) with the following fields:
      - title: A short, catchy title (in Spanish if the location seems to be Mexico, otherwise English).
      - price: A suggested second-hand price in numbers (logic: resale value).
      - currency: "MXN".
      - description: A brief description highlighting condition and key features (max 30 words).
      - category: One of ["Vehicles", "RealEstate", "Electronics", "Services", "Furniture", "Clothing", "Sports", "Books", "Other"].
      - deliveryType: Best delivery method ("Meetup" for large/expensive items, "Shipping" for small items, "Both" for others).

      Example format:
      {
        "title": "iPhone 12 Pro - 128GB",
        "price": 8500,
        "currency": "MXN",
        "description": "Used iPhone 12 Pro in good condition. Minor scratches on bezel. Battery health 88%.",
        "category": "Electronics",
        "deliveryType": "Shipping"
      }
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    // Clean potential markdown code blocks
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(cleanedText) as AIAnalysisResult;
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return null;
  }
};
