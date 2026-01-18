import { supabase } from '../db/supabase';

/**
 * AI自动审核服务
 * 在产品创建/更新时自动触发，检测违禁内容和质量问题
 */

interface ReviewResult {
    score: number;
    passed: boolean;
    status: 'active' | 'rejected' | 'pending_review';
    note: string;
    details: {
        imageScore: number;
        textScore: number;
        priceScore: number;
    };
}

/**
 * 触发产品自动审核
 */
export async function triggerAutoReview(productId: string): Promise<ReviewResult> {
    console.log(`[AutoReview] Starting review for product ${productId}`);

    try {
        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (error || !product) {
            console.error('[AutoReview] Product not found:', error);
            throw new Error('Product not found');
        }

        // 并行执行三项审核
        const [imageScore, textScore, priceScore] = await Promise.all([
            reviewImages(product.images || []),
            reviewText(product.title, product.description),
            reviewPrice(product.price, product.category)
        ]);

        // 综合评分（加权平均）
        const finalScore = (imageScore * 0.4 + textScore * 0.4 + priceScore * 0.2);

        console.log(`[AutoReview] Scores - Image: ${imageScore}, Text: ${textScore}, Price: ${priceScore}, Final: ${finalScore}`);

        // 决策逻辑
        let status: 'active' | 'rejected' | 'pending_review' = 'active';
        let note = '';

        if (finalScore < 0.3) {
            status = 'rejected';
            note = '内容不符合平台规范，自动拒绝';
        } else if (finalScore < 0.6) {
            status = 'pending_review';
            note = '内容存在疑问，需要人工复审';
        } else {
            status = 'active';
            note = '审核通过';
        }

        // 更新产品状态
        const { error: updateError } = await supabase
            .from('products')
            .update({
                status,
                review_note: note
            })
            .eq('id', productId);

        if (updateError) {
            console.error('[AutoReview] Failed to update product:', updateError);
        }

        console.log(`[AutoReview] Review completed - Status: ${status}, Note: ${note}`);

        return {
            score: finalScore,
            passed: status === 'active',
            status,
            note,
            details: { imageScore, textScore, priceScore }
        };

    } catch (error: any) {
        console.error('[AutoReview] Error during review:', error);

        // 审核失败时默认设为待审核
        await supabase
            .from('products')
            .update({
                status: 'pending_review',
                review_note: '自动审核失败，需要人工审核'
            })
            .eq('id', productId);

        throw error;
    }
}

/**
 * 图片审核
 */
async function reviewImages(images: string[]): Promise<number> {
    if (!images || images.length === 0) {
        console.log('[ImageReview] No images provided');
        return 0.4; // 没有图片给低分但不直接拒绝
    }

    let totalScore = 0;
    let validImages = 0;

    for (const imageUrl of images) {
        try {
            // 基础检查：URL格式
            if (!imageUrl || !imageUrl.startsWith('http')) {
                console.log('[ImageReview] Invalid image URL:', imageUrl);
                continue;
            }

            // TODO: 在未来可以集成实际的图像识别API
            // 例如 Google Cloud Vision API 或 AWS Rekognition
            // 现在先做基础检查

            // 检查是否是Supabase存储的图片
            const isSupabaseImage = imageUrl.includes('supabase.co/storage');

            if (isSupabaseImage) {
                totalScore += 1.0; // Supabase存储的图片给满分
            } else {
                totalScore += 0.7; // 外部图片给较低分
            }

            validImages++;

        } catch (error) {
            console.error('[ImageReview] Error reviewing image:', imageUrl, error);
            totalScore += 0.5; // 错误时给中等分
            validImages++;
        }
    }

    const avgScore = validImages > 0 ? totalScore / validImages : 0.4;
    console.log(`[ImageReview] Reviewed ${validImages} images, average score: ${avgScore}`);

    return avgScore;
}

/**
 * 文本审核
 */
async function reviewText(title: string, description: string): Promise<number> {
    const text = `${title} ${description || ''}`.toLowerCase();

    console.log(`[TextReview] Reviewing text: "${title.substring(0, 50)}..."`);

    // 违禁词库（敏感内容）
    const bannedWords = [
        // 中文违禁词
        '假货', '盗版', '色情', '赌博', '毒品', '武器', '枪支', '炸药',
        '诈骗', '传销', '法轮功', '黄色', '成人', '裸', '性爱',
        // 英文违禁词
        'fake', 'counterfeit', 'replica', 'porn', 'xxx', 'sex', 'nude',
        'drugs', 'cocaine', 'heroin', 'marijuana', 'weed',
        'weapon', 'gun', 'rifle', 'explosive', 'bomb',
        'scam', 'fraud', 'pyramid', 'mlm'
    ];

    // 检查违禁词
    for (const word of bannedWords) {
        if (text.includes(word)) {
            console.log(`[TextReview] Banned word detected: ${word}`);
            return 0; // 发现违禁词直接0分
        }
    }

    let score = 1.0;
    const issues: string[] = [];

    // 质量检查

    // 1. 标题太短
    if (title.length < 3) {
        score -= 0.3;
        issues.push('标题过短');
    }

    // 2. 标题太长
    if (title.length > 100) {
        score -= 0.1;
        issues.push('标题过长');
    }

    // 3. 描述太短
    if (!description || description.length < 5) {
        score -= 0.2;
        issues.push('描述过短');
    }

    // 4. 全大写（疑似垃圾信息）
    if (title === title.toUpperCase() && /[A-Z]/.test(title)) {
        score -= 0.2;
        issues.push('全大写标题');
    }

    // 5. 重复字符过多
    if (/(.)\1{4,}/.test(text)) {
        score -= 0.2;
        issues.push('重复字符');
    }

    // 6. 特殊字符过多
    const specialChars = (text.match(/[!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?]/g) || []).length;
    if (specialChars > text.length * 0.1) {
        score -= 0.2;
        issues.push('特殊字符过多');
    }

    // 7. 包含联系方式（微信、电话等）- 鼓励站内交易
    const hasContact = /微信|wechat|qq|电话|手机|phone|whatsapp|\d{10,}/i.test(text);
    if (hasContact) {
        score -= 0.1;
        issues.push('包含联系方式');
    }

    const finalScore = Math.max(0, score);

    if (issues.length > 0) {
        console.log(`[TextReview] Issues found: ${issues.join(', ')}, Score: ${finalScore}`);
    } else {
        console.log(`[TextReview] No issues, Score: ${finalScore}`);
    }

    return finalScore;
}

/**
 * 价格审核
 */
async function reviewPrice(price: number, category: string): Promise<number> {
    console.log(`[PriceReview] Reviewing price ${price} for category ${category}`);

    // 价格合理范围（按类别）
    const priceRanges: Record<string, { min: number; max: number }> = {
        'Electronics': { min: 10, max: 100000 },
        'Furniture': { min: 50, max: 50000 },
        'Clothing': { min: 10, max: 10000 },
        'Books': { min: 5, max: 2000 },
        'Sports': { min: 20, max: 20000 },
        'Vehicles': { min: 5000, max: 1000000 },
        'Other': { min: 1, max: 200000 }
    };

    const range = priceRanges[category] || priceRanges['Other'];

    // 价格为0或负数
    if (price <= 0) {
        console.log('[PriceReview] Price is zero or negative');
        return 0;
    }

    // 价格异常低（可能是诈骗）
    if (price < range.min) {
        console.log(`[PriceReview] Price too low: ${price} < ${range.min}`);
        return 0.3;
    }

    // 价格异常高（需要复审）
    if (price > range.max) {
        console.log(`[PriceReview] Price too high: ${price} > ${range.max}`);
        return 0.4;
    }

    // 价格在合理范围内
    console.log('[PriceReview] Price within acceptable range');
    return 1.0;
}

/**
 * 批量审核待审核的产品（定时任务）
 */
export async function reviewPendingProducts() {
    console.log('[BatchReview] Starting batch review');

    const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('status', 'pending_review')
        .limit(50);

    if (!products || products.length === 0) {
        console.log('[BatchReview] No pending products');
        return;
    }

    console.log(`[BatchReview] Found ${products.length} pending products`);

    for (const product of products) {
        try {
            await triggerAutoReview(product.id);
            // 避免并发过多，稍微延迟
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error(`[BatchReview] Failed to review product ${product.id}:`, error);
        }
    }

    console.log('[BatchReview] Batch review completed');
}
