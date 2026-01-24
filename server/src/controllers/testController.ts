/**
 * 测试翻译 API - 使用与前端相同的包
 */

import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const testTranslation = async (req: Request, res: Response) => {
    try {
        // 支持两种环境变量名称（兼容前端和后端）
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            return res.json({
                error: 'No API key found',
                hasKey: false,
                envKeys: Object.keys(process.env).filter(k => k.includes('GEMINI'))
            });
        }

        console.log('[TestTranslation] API Key exists, length:', apiKey.length);

        // 使用与前端相同的包 @google/generative-ai
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        if (!text) {
            return res.json({
                error: 'Empty response from AI',
                hasKey: true,
                aiCalled: true,
                responseEmpty: true
            });
        }

        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(text);

        res.json({
            success: true,
            hasKey: true,
            aiCalled: true,
            result: parsed
        });
    } catch (error: any) {
        console.error('[TestTranslation] Error:', error);
        res.json({
            error: error.message,
            stack: error.stack?.substring(0, 500),
            hasKey: !!(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY)
        });
    }
};
