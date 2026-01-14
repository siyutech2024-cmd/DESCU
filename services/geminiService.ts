
import { AISuggestion, Language } from "../types";

export const analyzeProductImage = async (base64Image: string, language: Language = 'es'): Promise<AISuggestion> => {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image: base64Image, language })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const data = await response.json();
    return data as AISuggestion;
  } catch (error) {
    console.error("AI Analysis failed:", error);
    throw error;
  }
};
