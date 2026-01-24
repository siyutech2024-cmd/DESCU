/**
 * 测试翻译 API
 */

import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

export const testTranslation = async (req: Request, res: Response) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.json({
                error: 'GEMINI_API_KEY not found',
                hasKey: false
            });
        }

        console.log('[TestTranslation] API Key exists, length:', apiKey.length);

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
Translate the following product title and description into Chinese, English, and Spanish.
Return ONLY valid JSON in this exact format:
{
  "zh": { "title": "中文标题", "description": "中文描述" },
  "en": { "title": "English title", "description": "English description" },
  "es": { "title": "Título en español", "description": "Descripción en español" }
}

Original content:
Title: Test Product
Description: This is a test description
`;

        console.log('[TestTranslation] Calling Gemini AI...');

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json' }
        });

        console.log('[TestTranslation] Response received');

        let text = response.text;
        if (!text) {
            return res.json({
                error: 'Empty response from AI',
                hasKey: true,
                aiCalled: true,
                responseEmpty: true
            });
        }

        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const result = JSON.parse(text);

        res.json({
            success: true,
            hasKey: true,
            aiCalled: true,
            result
        });
    } catch (error: any) {
        console.error('[TestTranslation] Error:', error);
        res.json({
            error: error.message,
            stack: error.stack?.substring(0, 500),
            hasKey: !!process.env.GEMINI_API_KEY
        });
    }
};
