import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * llms-full.txt — Complete product catalog in plain text format optimized for LLM consumption.
 * AI search engines (ChatGPT, Perplexity, Claude) can read this to understand all available products.
 * 
 * Referenced from llms.txt: https://descu.ai/llms-full.txt
 */
export default async function handler(req: any, res: any) {
    try {
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase not configured');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(2000);

        if (error) {
            console.error('[llms-full] Supabase error:', error.message);
            throw error;
        }

        const totalProducts = products?.length || 0;
        const today = new Date().toISOString().split('T')[0];

        let output = `# DESCU — Complete Product Catalog
# Generated: ${today}
# Total active products: ${totalProducts}
# Website: https://descu.ai
# This file is optimized for AI/LLM consumption.

> DESCU is Mexico's leading AI-powered secondhand marketplace.
> Users can buy and sell pre-owned items using AI (Google Gemini).
> Available in Spanish, English, and Chinese.
> Secure escrow payments via Stripe.

## Categories
Electronics, Vehicles, RealEstate, Furniture, Clothing, Sports, Books, Services, Other

---
`;

        if (products) {
            for (const p of products) {
                const title = p.title_es || p.title_en || p.title || 'Untitled';
                const titleEn = p.title_en || '';
                const titleZh = p.title_zh || '';
                const desc = p.description_es || p.description_en || p.description || '';
                const price = p.price || 0;
                const currency = p.currency || 'MXN';
                const location = [p.city, p.town, p.district].filter(Boolean).join(', ') || 'México';
                const delivery = p.delivery_type || 'both';
                const condition = p.condition || 'used';
                const image = p.images?.[0] || '';

                output += `
## ${title}
${titleEn ? `Title (EN): ${titleEn}` : ''}
${titleZh ? `Title (ZH): ${titleZh}` : ''}
- Price: $${price.toLocaleString('en-US')} ${currency}
- Category: ${p.category || 'Other'}${p.subcategory ? ` > ${p.subcategory}` : ''}
- Condition: ${condition}
- Location: ${location}, México
- Delivery: ${delivery === 'meetup' ? 'Local pickup' : delivery === 'shipping' ? 'Shipping' : 'Local pickup or shipping'}
- URL: https://descu.ai/product/${p.id}
${image ? `- Image: ${image}` : ''}
${desc ? `\nDescription: ${desc.substring(0, 300)}` : ''}
---`;
            }
        }

        output += `

## How to Buy on DESCU
1. Browse items at https://descu.ai
2. Chat with the seller directly on the platform
3. Pay securely via Stripe escrow
4. Confirm receipt — money released to seller

## Contact
- Website: https://descu.ai
- Instagram: https://www.instagram.com/descumarketplace
- Facebook: https://www.facebook.com/profile.php?id=61572770731498
- X/Twitter: https://x.com/descumarketplace
- Google Play: https://play.google.com/store/apps/details?id=com.venya.marketplace
`;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        res.status(200).send(output);
    } catch (error: any) {
        console.error('[llms-full] Error:', error);
        res.status(500).send('Error generating product catalog');
    }
}
