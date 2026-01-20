
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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // 使用稳定的1.5版本

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
      Category Rules:
      - "Electronics": Phones, Laptops, Cameras, Gadgets. (NOT for clothes/shoes).
      - "Clothing": Shirts, Pants, Jackets, Shoes, Accessories, Bags.
      - "Furniture": Tables, Chairs, Sofas, Home Decor.
      - "Sports": Gym equipment, Bicycles, Balls.
      - deliveryType: Best delivery method ("Meetup" for bulky/expensive, "Shipping" for small/shippable, "Both" for flexibility).

      Example format:
      {
        "title": "Nike Windbreaker Jacket",
        "price": 350,
        "currency": "MXN",
        "description": "Black and white windbreaker. Size M. Great condition.",
        "category": "Clothing",
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

export interface AIAuditResult {
  isSafe: boolean;
  categoryCorrect: boolean;
  suggestedCategory: string;
  flaggedReason?: string;
  confidence: number;
}

export const auditProductWithGemini = async (product: { title: string; description: string; category: string; images?: string[] }): Promise<AIAuditResult | null> => {
  if (!genAI) return null;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      You are an AI Moderator for a second-hand marketplace.
      Audit this product for:
      1. Safety/Ethics: Is it illegal, hateful, explicit, or prohibited (weapons, drugs)?
      2. Category Accuracy: Is the category "${product.category}" correct?

      Product:
      Title: "${product.title}"
      Description: "${product.description}"

      Return JSON:
      {
        "isSafe": boolean,
        "flaggedReason": "Reason if unsafe, else null",
        "categoryCorrect": boolean,
        "suggestedCategory": "Correct category if incorrect, else null",
        "confidence": number (0.0-1.0)
      }
    `;

    // Note: We are only sending text for now to save bandwidth/complexity, 
    // but could send image URL if we fetch it first.
    // For now, text audit is a good first step.

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedText) as AIAuditResult;
  } catch (error) {
    console.error("AI Audit Failed:", error);
    return null;
  }
};

export interface AIDisputeVerdict {
  verdict: 'Refund Buyer' | 'Release to Seller' | 'Split/Manual';
  reasoning: string;
  confidence: number;
}

export const judgeDisputeWithGemini = async (dispute: { reason: string; description?: string; sellerHistory?: string }): Promise<AIDisputeVerdict | null> => {
  if (!genAI) return null;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      You are an expert impartial arbitrator. Judge this e-commerce dispute.
      Buyer Reason: "${dispute.reason}"
      Additional Details: "${dispute.description || 'N/A'}"
      
      Return JSON:
      {
        "verdict": "Refund Buyer" OR "Release to Seller" OR "Split/Manual",
        "reasoning": "Clear explanation citing fair trade principles (max 50 words)",
        "confidence": number
      }
    `;

    const result = await model.generateContent(prompt);
    const text = (await result.response).text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text) as AIDisputeVerdict;
  } catch (error) {
    console.error("AI Judge Failed:", error);
    return null;
  }
};
