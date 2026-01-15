
import { AISuggestion, Language } from "../types";
import { API_ENDPOINTS } from "./apiConfig";

export const analyzeProductImage = async (base64Image: string, language: Language = 'es'): Promise<AISuggestion> => {
  try {
    const response = await fetch(API_ENDPOINTS.ANALYZE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image: base64Image, language })
    });

    if (!response.ok) {
      let errorMessage = `Server error: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
          if (errorData.details) errorMessage += ` (${errorData.details})`;
        }
      } catch (e) {
        // Ignore JSON parse error if body is not JSON
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data as AISuggestion;
  } catch (error) {
    console.error("AI Analysis failed:", error);
    throw error;
  }
};
