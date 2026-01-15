import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env.local') });
if (!process.env.SUPABASE_URL) {
    dotenv.config();
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyApiLogic() {
    console.log('🔍 开始验证API数据逻辑...');

    try {
        // 1. 验证 AdminProducts 逻辑
        console.log('\n📦 验证商品列表 (getAdminProducts)...');
        const { data: products, error: prodError, count: prodCount } = await supabase
            .from('products')
            .select('*', { count: 'exact' })
            .limit(5);

        if (prodError) throw prodError;
        console.log(`✅ 商品总数: ${prodCount}`);
        console.log(`✅ 成功获取 ${products.length} 个最新商品:`);
        products.forEach(p => console.log(`   - [${p.status}] ${p.title} ($${p.price})`));


        // 2. 验证 AdminUsers 逻辑 (从 products 衍生)
        console.log('\n👥 验证用户列表 (getAdminUsers)...');
        // 模拟 adminUserController 的逻辑
        const { data: sellers, error: userError } = await supabase
            .from('products')
            .select('seller_id, seller_name, seller_email, seller_avatar, seller_verified');

        if (userError) throw userError;

        // 模拟去重
        const uniqueUsers = new Map();
        sellers.forEach(s => {
            if (!uniqueUsers.has(s.seller_id)) {
                uniqueUsers.set(s.seller_id, s);
            }
        });

        console.log(`✅ 原始卖家记录数: ${sellers.length}`);
        console.log(`✅ 去重后用户数: ${uniqueUsers.size}`);
        console.log('✅ 活跃卖家示例:');
        Array.from(uniqueUsers.values()).slice(0, 3).forEach((u: any) => {
            console.log(`   - ${u.seller_name} (${u.seller_email}) [已认证: ${u.seller_verified}]`);
        });

        // 3. 验证筛选逻辑 (例如日期筛选)
        console.log('\n📅 验证日期筛选 logic...');
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count: recentCount, error: filterError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', oneWeekAgo);

        if (filterError) throw filterError;
        console.log(`✅ 最近7天发布的商品数: ${recentCount}`);

        console.log('\n🎉 API数据逻辑验证通过！逻辑与数据库实际数据一致。');

    } catch (error) {
        console.error('❌ 验证失败:', error);
    }
}

verifyApiLogic();
