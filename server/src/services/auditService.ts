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

Product:
Title: "${product.title}"
Description: "${product.description}"

Return ONLY valid JSON (no markdown):
{
  "isSafe": boolean,
  "flaggedReason": "Reason if unsafe or null",
  "categoryCorrect": boolean,
  "suggestedCategory": "Correct category if incorrect or null",
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
): Promise<{ approved: number; flagged: number; errors: number }> => {
    const stats = { approved: 0, flagged: 0, errors: 0 };

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
                    category: product.category || 'Other'
                });

                if (!audit) {
                    stats.errors++;
                    continue;
                }

                if (audit.isSafe && audit.categoryCorrect && audit.confidence > 0.8) {
                    // 自动通过
                    await supabase
                        .from('products')
                        .update({
                            status: 'active',
                            review_note: `[AI自动审核] 通过，置信度: ${(audit.confidence * 100).toFixed(0)}%`,
                            reviewed_at: new Date().toISOString()
                        })
                        .eq('id', product.id);
                    stats.approved++;
                    console.log(`[AutoReview] Approved: ${product.id}`);
                } else {
                    // 标记需人工复核
                    const reason = audit.flaggedReason ||
                        (!audit.categoryCorrect ? `分类建议: ${audit.suggestedCategory}` : '需人工复核');
                    await supabase
                        .from('products')
                        .update({
                            review_note: `[AI标记] ${reason}`,
                            reviewed_at: new Date().toISOString()
                        })
                        .eq('id', product.id);
                    stats.flagged++;
                    console.log(`[AutoReview] Flagged: ${product.id} - ${reason}`);
                }

                // 添加小延迟避免API限流
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (productError) {
                console.error(`[AutoReview] Error processing ${product.id}:`, productError);
                stats.errors++;
            }
        }

        console.log(`[AutoReview] Complete: approved=${stats.approved}, flagged=${stats.flagged}, errors=${stats.errors}`);
        return stats;

    } catch (error) {
        console.error('[AutoReview] Service error:', error);
        return stats;
    }
};
