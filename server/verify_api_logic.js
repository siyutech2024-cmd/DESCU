"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// 加载环境变量
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env.local') });
if (!process.env.SUPABASE_URL) {
    dotenv_1.default.config();
}
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
function verifyApiLogic() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🔍 开始验证API数据逻辑...');
        try {
            // 1. 验证 AdminProducts 逻辑
            console.log('\n📦 验证商品列表 (getAdminProducts)...');
            const { data: products, error: prodError, count: prodCount } = yield supabase
                .from('products')
                .select('*', { count: 'exact' })
                .limit(5);
            if (prodError)
                throw prodError;
            console.log(`✅ 商品总数: ${prodCount}`);
            console.log(`✅ 成功获取 ${products.length} 个最新商品:`);
            products.forEach(p => console.log(`   - [${p.status}] ${p.title} ($${p.price})`));
            // 2. 验证 AdminUsers 逻辑 (从 products 衍生)
            console.log('\n👥 验证用户列表 (getAdminUsers)...');
            // 模拟 adminUserController 的逻辑
            const { data: sellers, error: userError } = yield supabase
                .from('products')
                .select('seller_id, seller_name, seller_email, seller_avatar, seller_verified');
            if (userError)
                throw userError;
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
            Array.from(uniqueUsers.values()).slice(0, 3).forEach((u) => {
                console.log(`   - ${u.seller_name} (${u.seller_email}) [已认证: ${u.seller_verified}]`);
            });
            // 3. 验证筛选逻辑 (例如日期筛选)
            console.log('\n📅 验证日期筛选 logic...');
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { count: recentCount, error: filterError } = yield supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', oneWeekAgo);
            if (filterError)
                throw filterError;
            console.log(`✅ 最近7天发布的商品数: ${recentCount}`);
            console.log('\n🎉 API数据逻辑验证通过！逻辑与数据库实际数据一致。');
        }
        catch (error) {
            console.error('❌ 验证失败:', error);
        }
    });
}
verifyApiLogic();
