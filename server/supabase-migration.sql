-- Supabase 数据库迁移脚本
-- 在 Supabase SQL Editor 中运行此脚本

-- 创建 products 表
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  seller_email TEXT NOT NULL,
  seller_avatar TEXT,
  seller_verified BOOLEAN DEFAULT false,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'MXN',
  images TEXT[] NOT NULL,
  category TEXT NOT NULL,
  delivery_type TEXT NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  location_name TEXT NOT NULL,
  is_promoted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);

-- 创建 conversations 表 (聊天对话)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  user1_id TEXT NOT NULL,
  user2_id TEXT NOT NULL,
  last_message_time TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建 messages 表 (聊天消息)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_conversations_product ON conversations(product_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);

-- 启用行级安全 (RLS) - 可选，根据需要配置
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 创建策略：所有人可以读取产品
CREATE POLICY "Anyone can view products" ON products
  FOR SELECT USING (true);

-- 创建策略：所有人可以插入产品（简化版，实际应基于认证）
CREATE POLICY "Anyone can create products" ON products
  FOR INSERT WITH CHECK (true);
