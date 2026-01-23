/**
 * AI 商品审核服务
 * 用于自动审核待发布的商品
 */

import { GoogleGenAI } from '@google/genai';
import { supabase } from '../db/supabase.js';

// --- LAZY AI INIT ---
let aiInstance: GoogleGenAI | null = null;
const getAI = () => {
    if (!aiInstance) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return null;
        aiInstance = new GoogleGenAI({ apiKey });
    }
    return aiInstance;
};

// 系统支持的分类
const SYSTEM_CATEGORIES = [
    'electronics', 'furniture', 'clothing', 'books',
    'sports', 'vehicles', 'real_estate', 'services', 'other'
];

/**
 * 将AI建议的详细分类映射到系统分类
 */
const mapToSystemCategory = (suggestedCategory: string | null): string => {
    if (!suggestedCategory) return 'other';

    const suggestion = suggestedCategory.toLowerCase();

    // 如果已经是系统分类，直接返回
    if (SYSTEM_CATEGORIES.includes(suggestion)) {
        return suggestion;
    }

    // 分类关键词映射 - 扩展版
    const mappings: Array<{ keywords: string[], category: string }> = [
        // 电子产品
        { keywords: ['electronic', 'phone', 'computer', 'laptop', 'camera', 'gadget', 'appliance', 'kitchen appliance', 'small appliance', 'tablet', 'headphone', 'speaker', 'tv', 'television', 'monitor'], category: 'electronics' },
        // 家具
        { keywords: ['furniture', 'table', 'chair', 'sofa', 'bed', 'desk', 'cabinet', 'shelf', 'wardrobe', 'drawer'], category: 'furniture' },
        // 服饰 & 美妆
        { keywords: ['clothing', 'clothes', 'shoe', 'fashion', 'accessori', 'beauty', 'fragrance', 'cosmetic', 'jewelry', 'bag', 'watch', 'perfume', 'skincare', 'cream', 'makeup', 'health', 'lotion', 'shampoo'], category: 'clothing' },
        // 书籍
        { keywords: ['book', 'magazine', 'textbook', 'novel', 'comic', 'manga', 'reading'], category: 'books' },
        // 运动
        { keywords: ['sport', 'fitness', 'gym', 'bicycle', 'bike', 'outdoor', 'exercise', 'ball', 'racket', 'yoga', 'running'], category: 'sports' },
        // 车辆
        { keywords: ['vehicle', 'car', 'motorcycle', 'auto', 'truck', 'motor', 'scooter'], category: 'vehicles' },
        // 房产
        { keywords: ['real estate', 'house', 'apartment', 'property', 'rent', 'room'], category: 'real_estate' },
        // 服务
        { keywords: ['service', 'repair', 'cleaning', 'install', 'maintenance', 'lesson', 'tutoring'], category: 'services' },
        // 食品饮料 -> 映射到 other
        { keywords: ['food', 'snack', 'beverage', 'drink', 'juice', 'candy', 'chocolate', 'grocery', 'fruit', 'vegetable', 'meat', 'coffee', 'tea'], category: 'other' },
        // 收藏品 -> 映射到 other
        { keywords: ['collectible', 'souvenir', 'memorabilia', 'antique', 'vintage', 'rare', 'limited edition', 'figurine', 'toy', 'game', 'puzzle', 'lego', 'doll', 'plush'], category: 'other' },
        // 家居园艺 -> 映射到 furniture
        { keywords: ['home', 'garden', 'plant', 'pot', 'decor', 'decoration', 'lamp', 'light', 'curtain', 'rug', 'carpet'], category: 'furniture' },
    ];

    for (const mapping of mappings) {
        for (const keyword of mapping.keywords) {
            if (suggestion.includes(keyword)) {
                return mapping.category;
            }
        }
    }

    return 'other';
};

export interface AuditResult {
    isSafe: boolean;
    categoryCorrect: boolean;
    suggestedCategory: string | null;
    flaggedReason: string | null;
    confidence: number;
}

/**
 * 使用 AI 审核单个商品
 */
export const auditProduct = async (product: {
    title: string;
    description: string;
    category: string;
}): Promise<AuditResult | null> => {
    const ai = getAI();
    if (!ai) {
        console.error('[AuditService] Gemini API not available');
        return null;
    }

    try {
        const prompt = `
You are an AI Moderator for a second-hand marketplace (DESCU) in Mexico.
Audit this product for:
1. Safety/Ethics: Is it illegal, hateful, explicit, or prohibited (weapons, drugs, counterfeit)?
2. Category Accuracy: Is the category "${product.category}" correct?

Available categories: electronics, furniture, clothing, books, sports, vehicles, real_estate, services, other

Product:
Title: "${product.title}"
Description: "${product.description}"

Return ONLY valid JSON (no markdown):
{
  "isSafe": boolean,
  "flaggedReason": "Reason if unsafe or null",
  "categoryCorrect": boolean,
  "suggestedCategory": "Best matching category from the list above if incorrect, or null",
  "confidence": number (0.0-1.0)
}
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                temperature: 0.2
            }
        });

        let text = response.text;
        if (!text) {
            console.error('[AuditService] Empty response from AI');
            return null;
        }

        // Clean markdown code blocks if present
        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        return JSON.parse(text) as AuditResult;

    } catch (error) {
        console.error('[AuditService] Audit failed:', error);
        return null;
    }
};

/**
 * 批量审核待审核商品
 * @param limit 最大处理数量
 * @param hoursAgo 仅处理多少小时内创建的商品 (默认24小时)
 */
export const autoReviewPendingProducts = async (
    limit: number = 50,
    hoursAgo: number = 24
): Promise<{ approved: number; categoryCorrected: number; flagged: number; errors: number }> => {
    const stats = { approved: 0, categoryCorrected: 0, flagged: 0, errors: 0 };

    try {
        // 计算时间范围
        const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

        // 查询待审核商品
        const { data: products, error } = await supabase
            .from('products')
            .select('id, title, description, category')
            .eq('status', 'pending_review')
            .gte('created_at', since)
            .order('created_at', { ascending: true })
            .limit(limit);

        if (error) {
            console.error('[AutoReview] Query failed:', error);
            return stats;
        }

        if (!products || products.length === 0) {
            console.log('[AutoReview] No pending products found');
            return stats;
        }

        console.log(`[AutoReview] Processing ${products.length} products...`);

        // 逐个审核（避免并发过多导致API限流）
        for (const product of products) {
            try {
                const audit = await auditProduct({
                    title: product.title,
                    description: product.description || '',
                    category: product.category || 'other'
                });

                if (!audit) {
                    stats.errors++;
                    continue;
                }

                // 核心逻辑：安全商品直接通过，不安全商品才需人工审核
                if (audit.isSafe && audit.confidence > 0.6) {
                    // 安全商品：自动通过，分类不正确则纠正
                    let finalCategory = product.category;
                    let reviewNote = `[AI自动审核] 通过，置信度: ${(audit.confidence * 100).toFixed(0)}%`;
                    let wasCorrected = false;

                    if (!audit.categoryCorrect && audit.suggestedCategory) {
                        // 映射AI建议分类到系统分类
                        const mappedCategory = mapToSystemCategory(audit.suggestedCategory);
                        if (mappedCategory !== product.category) {
                            finalCategory = mappedCategory;
                            reviewNote = `[AI自动审核] 通过，分类从 "${product.category}" 纠正为 "${mappedCategory}"`;
                            wasCorrected = true;
                            stats.categoryCorrected++;
                        }
                    }

                    await supabase
                        .from('products')
                        .update({
                            status: 'active',
                            category: finalCategory,
                            review_note: reviewNote,
                            reviewed_at: new Date().toISOString()
                        })
                        .eq('id', product.id);

                    stats.approved++;
                    console.log(`[AutoReview] Approved: ${product.id}${wasCorrected ? ` (category: ${product.category} → ${finalCategory})` : ''}`);

                } else {
                    // 不安全商品：标记需人工复核
                    const reason = audit.flaggedReason || '安全性需人工确认';
                    await supabase
                        .from('products')
                        .update({
                            review_note: `[AI标记-不安全] ${reason}`,
                            reviewed_at: new Date().toISOString()
                        })
                        .eq('id', product.id);
                    stats.flagged++;
                    console.log(`[AutoReview] Flagged (unsafe): ${product.id} - ${reason}`);
                }

                // 添加小延迟避免API限流
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (productError) {
                console.error(`[AutoReview] Error processing ${product.id}:`, productError);
                stats.errors++;
            }
        }

        console.log(`[AutoReview] Complete: approved=${stats.approved}, categoryCorrected=${stats.categoryCorrected}, flagged=${stats.flagged}, errors=${stats.errors}`);
        return stats;

    } catch (error) {
        console.error('[AutoReview] Service error:', error);
        return stats;
    }
};

