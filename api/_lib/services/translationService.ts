
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../db/supabase.js';

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

/**
 * 从缓存中获取已翻译的产品
 * @param productIds 产品ID列表
 * @param targetLang 目标语言
 * @returns 缓存的翻译结果映射表
 */
const getCachedTranslations = async (
    productIds: string[],
    targetLang: string
): Promise<Map<string, TranslatableItem>> => {
    try {
        const { data, error } = await supabase
            .from('product_translations')
            .select('product_id, title, description')
            .in('product_id', productIds)
            .eq('language', targetLang);

        if (error) {
            console.error('Failed to fetch cached translations:', error);
            return new Map();
        }

        const cacheMap = new Map<string, TranslatableItem>();
        (data || []).forEach(item => {
            cacheMap.set(item.product_id, {
                id: item.product_id,
                title: item.title,
                description: item.description
            });
        });

        return cacheMap;
    } catch (error) {
        console.error('Error accessing translation cache:', error);
        return new Map();
    }
};

/**
 * 将翻译结果写入缓存
 * @param translations 翻译结果列表
 * @param targetLang 目标语言
 */
const saveCachedTranslations = async (
    translations: TranslatableItem[],
    targetLang: string
): Promise<void> => {
    try {
        const records = translations.map(item => ({
            product_id: item.id,
            language: targetLang,
            title: item.title,
            description: item.description,
            updated_at: new Date().toISOString()
        }));

        // 使用upsert：存在则更新，不存在则插入
        const { error } = await supabase
            .from('product_translations')
            .upsert(records, {
                onConflict: 'product_id,language',
                ignoreDuplicates: false
            });

        if (error) {
            console.error('Failed to save translation cache:', error);
        } else {
            console.log(`[Translation Cache] Saved ${records.length} translations for lang: ${targetLang}`);
        }
    } catch (error) {
        console.error('Error saving translation cache:', error);
    }
};

/**
 * 批量翻译产品内容（带缓存优化）
 * @param items 待翻译的产品列表
 * @param targetLang 目标语言 (Chinese/English/Spanish)
 * @returns 翻译后的产品列表
 */
export const translateBatch = async (
    items: TranslatableItem[],
    targetLang: string
): Promise<TranslatableItem[]> => {
    if (!items.length) return items;

    // 1. 获取语言代码 (Chinese -> zh)
    const langCode = targetLang.toLowerCase().startsWith('chinese') ? 'zh'
        : targetLang.toLowerCase().startsWith('english') ? 'en'
            : targetLang.toLowerCase().startsWith('spanish') ? 'es'
                : null;

    if (!langCode) {
        console.warn(`Unsupported language: ${targetLang}`);
        return items;
    }

    // 2. 从缓存中查找已翻译的产品
    const productIds = items.map(item => item.id);
    const cachedTranslations = await getCachedTranslations(productIds, langCode);

    // 3. 分离已缓存和需要翻译的产品
    const needsTranslation: TranslatableItem[] = [];
    const results: TranslatableItem[] = [];

    items.forEach(item => {
        const cached = cachedTranslations.get(item.id);
        if (cached) {
            // 使用缓存
            results.push(cached);
        } else {
            // 需要翻译
            needsTranslation.push(item);
        }
    });

    console.log(`[Translation Cache] Cache hit: ${results.length}/${items.length}, Need translation: ${needsTranslation.length}`);

    // 4. 如果全部命中缓存，直接返回
    if (needsTranslation.length === 0) {
        return results;
    }

    // 5. 调用AI翻译未缓存的产品
    const ai = getAI();
    if (!ai) {
        console.warn('Gemini AI not available, returning original items');
        return items;
    }

    // Limit batch size to avoid context limits
    const chunk = needsTranslation.slice(0, 50);

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
        if (!text) {
            console.error('No translation response from AI');
            return items;
        }

        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const translatedMap = JSON.parse(text);

        // 6. 处理翻译结果
        const newTranslations: TranslatableItem[] = [];
        chunk.forEach(item => {
            const translated = translatedMap[item.id];
            if (translated) {
                const translatedItem: TranslatableItem = {
                    id: item.id,
                    title: translated.t || item.title,
                    description: translated.d || item.description
                };
                newTranslations.push(translatedItem);
                results.push(translatedItem);
            } else {
                // Fallback to original
                results.push(item);
            }
        });

        // 7. 异步保存到缓存（不阻塞响应）
        if (newTranslations.length > 0) {
            saveCachedTranslations(newTranslations, langCode).catch(err => {
                console.error('Failed to save cache asynchronously:', err);
            });
        }

        return results;

    } catch (error) {
        console.error('Translation failed:', error);
        return items; // Fallback to original
    }
};
