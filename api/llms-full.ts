import { createClient } from '@supabase/supabase-js';
import { categoryLabel } from './_lib/seo/site.js';
import { normalizeCategory } from './_lib/domain/categories.js';

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
# Website: https://descu.ai · Site facts and FAQ: https://descu.ai/llms.txt · How it works: https://descu.ai/como-funciona
# This file is optimized for AI/LLM consumption. Prices are in Mexican pesos (MXN) unless stated.

> DESCU is a secondhand marketplace in Mexico. Listing is free; the AI (Google Gemini) writes and prices the listing from a photo.
> Payments: card, OXXO or SPEI via Stripe held in escrow until the buyer confirms receipt, or cash at an in-person handoff.
> Buyers pay a 5% service fee on online payments only; sellers pay no commission. Home shipping is a flat MX$50.
> Available in Spanish, English and Chinese.

## Categories
Electronics, Vehicles, Real Estate, Home & Furniture, Clothing & Fashion, Sports, Books, Services, Other
Landing pages: https://descu.ai/buy/{electronics|vehicles|realestate|furniture|clothing|sports|books|services|other|all}/in/{mexico|ciudad-de-mexico|guadalajara|monterrey|...}

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
- Category: ${categoryLabel(p.category, 'en')} (${normalizeCategory(p.category)})${p.subcategory ? ` > ${p.subcategory}` : ''}
- Condition: ${condition}
- Location: ${location}, México${p.created_at ? `\n- Listed: ${String(p.created_at).split('T')[0]}` : ''}
- Delivery: ${delivery === 'meetup' ? 'Local pickup' : delivery === 'shipping' ? 'Shipping' : 'Local pickup or shipping'}
- URL: https://descu.ai/product/${p.id}
${image ? `- Image: ${image}` : ''}
${desc ? `\nDescription: ${desc.substring(0, 300)}` : ''}
---`;
            }
        }

        output += `

## How to Buy on DESCU
1. Browse items at https://descu.ai (sorted by distance) or the landing pages above
2. Chat with the seller in the app; offers can be accepted, rejected or countered
3. Choose meetup or shipping (flat MX$50) and pay by card / OXXO / SPEI (escrow) or cash at handoff
4. Confirm receipt — the money is released to the seller; disputes are handled by the DESCU team

## Contact
- Website: https://descu.ai
- Instagram: https://www.instagram.com/descumarketplace
- Facebook: https://www.facebook.com/profile.php?id=61572770731498
- X/Twitter: https://x.com/descumarketplace
- Google Play: https://play.google.com/store/apps/details?id=com.venya.marketplace
`;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
        res.status(200).send(output);
    } catch (error: any) {
        console.error('[llms-full] Error:', error);
        res.status(500).send('Error generating product catalog');
    }
}
