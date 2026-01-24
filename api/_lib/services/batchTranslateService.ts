/**
 * 批量翻译现有产品 API
 * 用于一次性翻译所有未翻译的产品
 */

import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../db/supabase.js';

// AI Instance
let aiInstance: GoogleGenAI | null = null;
const getAI = () => {
    if (!aiInstance) {
        // 支持两种环境变量名称（兼容前端和后端）
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            console.error('[BatchTranslate] No GEMINI_API_KEY or VITE_GEMINI_API_KEY found');
            return null;
        }
        console.log('[BatchTranslate] Initializing AI with key length:', apiKey.length);
        aiInstance = new GoogleGenAI({ apiKey });
    }
    return aiInstance;
};

interface TranslationResult {
    zh: { title: string; description: string };
    en: { title: string; description: string };
    es: { title: string; description: string };
}

/**
 * 翻译单个产品内容 - 与 auditService 完全相同的实现
 */
const translateProduct = async (title: string, description: string): Promise<TranslationResult | null> => {
    const ai = getAI();
    if (!ai) {
        console.error('[BatchTranslate] AI instance is null');
        return null;
    }

    try {
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

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json' }
        });

        let text = response.text;
        if (!text) {
            console.error('[BatchTranslate] Empty response from AI');
            return null;
        }

        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const result = JSON.parse(text) as TranslationResult;

        console.log(`[BatchTranslate] ✓ Translated: "${title.substring(0, 30)}..." => zh="${result.zh.title.substring(0, 30)}..."`);
        return result;
    } catch (error: any) {
        console.error('[BatchTranslate] Translation error:', error.message || error);
        return null;
    }
};

/**
 * 批量翻译所有未翻译的产品
 */
export const batchTranslateProducts = async (req: Request, res: Response) => {
    try {
        // 安全检查：需要管理员权限
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // 查询未翻译的产品（title_zh 为空的）
        const { data: products, error } = await supabase
            .from('products')
            .select('id, title, description')
            .is('title_zh', null)
            .eq('status', 'active')
            .limit(10); // 每批10个（避免超时）

        if (error) {
            console.error('[BatchTranslate] Query error:', error);
            return res.status(500).json({ error: 'Failed to query products', details: error.message });
        }

        if (!products || products.length === 0) {
            return res.json({ message: 'No products need translation', translated: 0 });
        }

        console.log(`[BatchTranslate] Starting translation for ${products.length} products...`);

        let translated = 0;
        let failed = 0;

        for (const product of products) {
            try {
                console.log(`[BatchTranslate] Processing: ${product.id} - "${product.title}"`);

                // 使用与 auditService 相同的翻译方式
                const translations = await translateProduct(product.title, product.description || '');

                if (translations) {
                    // 使用与 auditService 相同的更新方式
                    const { data, error: updateError } = await supabase
                        .from('products')
                        .update({
                            title_zh: translations.zh.title,
                            description_zh: translations.zh.description,
                            title_en: translations.en.title,
                            description_en: translations.en.description,
                            title_es: translations.es.title,
                            description_es: translations.es.description
                        })
                        .eq('id', product.id)
                        .select();

                    if (updateError) {
                        console.error(`[BatchTranslate] ✗ DB update failed for ${product.id}:`, updateError);
                        failed++;
                    } else {
                        translated++;
                        console.log(`[BatchTranslate] ✓ Saved: ${product.id}`);
                    }
                } else {
                    console.error(`[BatchTranslate] ✗ Translation failed for: ${product.id}`);
                    failed++;
                }

                // 避免 API 限流
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err: any) {
                console.error(`[BatchTranslate] ✗ Error for ${product.id}:`, err.message);
                failed++;
            }
        }

        console.log(`[BatchTranslate] Complete: ${translated} translated, ${failed} failed`);

        res.json({
            message: 'Batch translation complete',
            translated,
            failed,
            remaining: products.length - translated - failed
        });
    } catch (error: any) {
        console.error('[BatchTranslate] Fatal error:', error);
        res.status(500).json({ error: error.message });
    }
};
