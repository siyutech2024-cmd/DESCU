import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: any, res: any) {
    try {
        // 获取所有活跃商品
        const { data: products, error } = await supabase
            .from('products')
            .select('id, updated_at, category')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching products:', error);
            return res.status(500).send('Error generating sitemap');
        }

        const baseUrl = 'https://descu.ai';
        const today = new Date().toISOString().split('T')[0];

        // 静态页面
        const staticPages = [
            { loc: '/', priority: '1.0', changefreq: 'daily' },
            { loc: '/privacy-policy', priority: '0.5', changefreq: 'monthly' },
            { loc: '/profile', priority: '0.7', changefreq: 'weekly' },
            { loc: '/chat', priority: '0.6', changefreq: 'daily' },
            { loc: '/favorites', priority: '0.6', changefreq: 'daily' },
            { loc: '/orders', priority: '0.6', changefreq: 'daily' },
        ];

        // 分类页面
        const categories = ['Electronics', 'Vehicles', 'RealEstate', 'Furniture', 'Clothing', 'Sports', 'Books', 'Services', 'Other'];
        const categoryPages = categories.map(cat => ({
            loc: `/?category=${cat}`,
            priority: '0.8',
            changefreq: 'daily'
        }));

        // 生成 XML
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

        // 添加静态页面
        for (const page of staticPages) {
            xml += `  <url>
    <loc>${baseUrl}${page.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
        }

        // 添加分类页面
        for (const page of categoryPages) {
            xml += `  <url>
    <loc>${baseUrl}${page.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
        }

        // 添加商品页面
        if (products) {
            for (const product of products) {
                const lastmod = product.updated_at
                    ? new Date(product.updated_at).toISOString().split('T')[0]
                    : today;
                xml += `  <url>
    <loc>${baseUrl}/product/${product.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
            }
        }

        xml += `</urlset>`;

        // 设置响应头
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 缓存1小时
        res.status(200).send(xml);

    } catch (error) {
        console.error('Sitemap generation error:', error);
        res.status(500).send('Error generating sitemap');
    }
}
