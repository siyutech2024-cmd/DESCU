
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
  subcategory?: string; // New: Subcategory from AI analysis
  deliveryType: 'Meetup' | 'Shipping' | 'Both';
}

export const analyzeImageWithGemini = async (imageBase64: string): Promise<AIAnalysisResult | null> => {
  if (!genAI) {
    console.error("[Gemini] API Key (VITE_GEMINI_API_KEY) is missing! Please check .env file.");
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // 使用稳定的2.0版本

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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `
      You are an AI Moderator for a second-hand marketplace.
      Audit this product for:
      1. Safety/Ethics: Is it illegal, hateful, explicit, or prohibited (weapons, drugs)?
      2. Category Accuracy: Is the category "${product.category}" correct?

      Product:
      Title: "${product.title}"
      Description: "${product.description}"

      IMPORTANT: Return ONLY a valid JSON object, no additional text or explanation.
      {
        "isSafe": boolean,
        "flaggedReason": "Reason if unsafe, else null",
        "categoryCorrect": boolean,
        "suggestedCategory": "Correct category if incorrect, else null",
        "confidence": number (0.0-1.0)
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // 清理可能的markdown代码块
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // 尝试提取JSON对象（处理AI添加额外文本的情况）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[AI Audit] No JSON found in response:", text.substring(0, 100));
      return null;
    }

    return JSON.parse(jsonMatch[0]) as AIAuditResult;
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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

// 翻译结果接口
export interface TranslationResult {
  zh: { title: string; description: string };
  en: { title: string; description: string };
  es: { title: string; description: string };
}

// 翻译产品内容为三语言
export const translateProductWithGemini = async (
  title: string,
  description: string
): Promise<TranslationResult | null> => {
  if (!genAI) {
    console.error("[Gemini] AI not available for translation");
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `
Translate the following product title and description into Chinese, English, and Spanish.
Return ONLY valid JSON in this exact format:
{
  "zh": { "title": "中文标题", "description": "中文描述" },
  "en": { "title": "English title", "description": "English description" },
  "es": { "title": "Título en español", "description": "Descripción en español" }
}

Original content:
Title: ${title}
Description: ${description}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    if (!text) {
      console.error("[Gemini Translation] Empty response");
      return null;
    }

    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(text) as TranslationResult;
    console.log(`[Gemini Translation] Success: "${title}" translated`);
    return parsed;
  } catch (error) {
    console.error("[Gemini Translation] Failed:", error);
    return null;
  }
};

