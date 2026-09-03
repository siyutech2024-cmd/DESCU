-- 用户端核心功能所需的数据库表
-- 在 Supabase SQL Editor 中运行

-- ======================
-- 1. PRODUCTS 表
-- ======================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id TEXT NOT NULL,
    seller_name TEXT NOT NULL,
    seller_email TEXT,
    seller_avatar TEXT,
    seller_verified BOOLEAN DEFAULT FALSE,
    
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL,
    currency TEXT DEFAULT 'MXN',
    images JSONB DEFAULT '[]'::jsonb,
    category TEXT NOT NULL,
    delivery_type TEXT DEFAULT 'both',
    
    latitude NUMERIC DEFAULT 0,
    longitude NUMERIC DEFAULT 0,
    location_name TEXT,
    
    status TEXT DEFAULT 'active',
    views_count INTEGER DEFAULT 0,
    reported_count INTEGER DEFAULT 0,
    is_promoted BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

--CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);

-- ======================
-- 2. CONVERSATIONS 表
-- ======================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL,
    user1_id TEXT NOT NULL,
    user2_id TEXT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(product_id, user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_users ON conversations(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_product ON conversations(product_id);

-- ======================
-- 3. MESSAGES 表
-- ======================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    text TEXT NOT NULL,
    
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);

-- ======================
-- 4. 触发器：自动更新 updated_at
-- ======================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Products表触发器
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Conversations表触发器
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ======================
-- 5. 验证表创建
-- ======================
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN ('products', 'conversations', 'messages')
ORDER BY table_name;
