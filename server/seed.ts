import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env.local') });
// 如果上一级没有 .env.local，尝试当前目录 .env
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

// 模拟数据生成器
const categories = ['electronics', 'furniture', 'clothing', 'books', 'sports', 'vehicles', 'real_estate', 'services', 'other'];
const locations = ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Cancún'];

const sellers = [
    {
        id: 'user-001',
        name: 'Maria Garcia',
        email: 'maria@example.com',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria',
        verified: true
    },
    {
        id: 'user-002',
        name: 'Juan Hernandez',
        email: 'juan@example.com',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Juan',
        verified: true
    },
    {
        id: 'user-003',
        name: 'Sofia Lopez',
        email: 'sofia@example.com',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sofia',
        verified: false
    },
    {
        id: 'user-004',
        name: 'Carlos Martinez',
        email: 'carlos@example.com',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos',
        verified: true
    },
    {
        id: 'user-005',
        name: 'Ana Rodriguez',
        email: 'ana@example.com',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana',
        verified: false
    }
];

const sampleProducts = [
    { title: 'iPhone 13 Pro', price: 15000, category: 'electronics' },
    { title: 'MacBook Air M1', price: 18000, category: 'electronics' },
    { title: 'Sofa Cama', price: 5000, category: 'furniture' },
    { title: 'Nike Air Max', price: 2500, category: 'clothing' },
    { title: 'Toyota Corolla 2018', price: 250000, category: 'vehicles' },
    { title: 'Bicicleta de Montaña', price: 4500, category: 'sports' },
    { title: 'Harry Potter Collection', price: 800, category: 'books' },
    { title: 'Apartamento en Polanco', price: 3500000, category: 'real_estate' },
    { title: 'Servicio de Limpieza', price: 500, category: 'services' },
    { title: 'PlayStation 5', price: 12000, category: 'electronics' }
];

async function seed() {
    console.log('🌱 Starting seed...');

    try {
        // 1. 生成商品
        console.log('Creating products...');
        const productsToInsert = [];

        for (let i = 0; i < 30; i++) {
            const seller = sellers[Math.floor(Math.random() * sellers.length)];
            const template = sampleProducts[Math.floor(Math.random() * sampleProducts.length)];
            const location = locations[Math.floor(Math.random() * locations.length)];

            // 随机状态
            let status = 'active';
            let deleted_at = null;
            const rand = Math.random();
            if (rand < 0.1) status = 'pending_review';
            else if (rand < 0.2) status = 'inactive';
            else if (rand < 0.25) {
                status = 'deleted';
                deleted_at = new Date().toISOString();
            }

            // 随机日期 (过去30天内)
            const created_at = new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString();

            productsToInsert.push({
                seller_id: seller.id,
                seller_name: seller.name,
                seller_email: seller.email,
                seller_avatar: seller.avatar,
                seller_verified: seller.verified,
                title: `${template.title} ${Math.floor(Math.random() * 100)}`,
                description: `This is a sample description for ${template.title}. Condition is good.`,
                price: template.price * (0.8 + Math.random() * 0.4), // +/- 20%
                currency: 'MXN',
                images: [`https://source.unsplash.com/random/400x400/?${template.category}`],
                category: template.category,
                delivery_type: Math.random() > 0.5 ? 'shipping' : 'pickup',
                location_name: location,
                latitude: 19.4326 + (Math.random() - 0.5) * 0.1,
                longitude: -99.1332 + (Math.random() - 0.5) * 0.1,
                status,
                is_promoted: Math.random() < 0.2, // 20% promoted
                views_count: Math.floor(Math.random() * 1000),
                created_at,
                deleted_at
            });
        }

        const { data: insertedProducts, error: productError } = await supabase
            .from('products')
            .insert(productsToInsert)
            .select();

        if (productError) throw productError;
        console.log(`✅ Inserted ${insertedProducts.length} products`);

        // 2. 生成对话和消息
        console.log('Creating conversations...');
        if (!insertedProducts || insertedProducts.length === 0) return;

        const activeProducts = insertedProducts.filter(p => p.status === 'active');

        for (const product of activeProducts.slice(0, 10)) { // 为前10个活跃商品创建对话
            // 找一个不是卖家的用户作为买家
            let buyer = sellers[Math.floor(Math.random() * sellers.length)];
            while (buyer.id === product.seller_id) {
                buyer = sellers[Math.floor(Math.random() * sellers.length)];
            }

            const { data: conv, error: convError } = await supabase
                .from('conversations')
                .insert({
                    product_id: product.id,
                    user1_id: buyer.id,
                    user2_id: product.seller_id
                })
                .select()
                .single();

            if (convError) continue;

            // 插入几条消息
            await supabase.from('messages').insert([
                {
                    conversation_id: conv.id,
                    sender_id: buyer.id,
                    text: 'Hi, is this still available?',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString()
                },
                {
                    conversation_id: conv.id,
                    sender_id: product.seller_id,
                    text: 'Yes, it is!',
                    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString()
                }
            ]);
        }
        console.log('✅ Created conversations and messages');

        console.log('🎉 Seed completed successfully!');
    } catch (error) {
        console.error('❌ Seed failed:', error);
    }
}

seed();
