-- ================================================
-- DESCU 二手智选 - 完整数据库迁移脚本
-- ================================================
-- 版本: 1.0
-- 创建时间: 2026-01-13
-- 数据库: Supabase (PostgreSQL)
--
-- 说明:
-- 1. 此脚本创建所有应用需要的表和关系
-- 2. 包含完整的索引优化
-- 3. 配置了行级安全策略 (RLS)
-- 4. 启用了Real-time功能所需的配置
-- ================================================

-- ================================================
-- 1. PRODUCTS 表 - 商品信息
-- ================================================
CREATE TABLE IF NOT EXISTS products (
  -- 主键和基本信息
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 卖家信息
  seller_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  seller_email TEXT NOT NULL,
  seller_avatar TEXT,
  seller_verified BOOLEAN DEFAULT false,
  
  -- 商品基本信息
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL CHECK (price >= 0),
  currency TEXT DEFAULT 'MXN' NOT NULL,
  
  -- 商品图片 (数组)
  images TEXT[] NOT NULL DEFAULT '{}',
  
  -- 分类和配送
  category TEXT NOT NULL,
  delivery_type TEXT NOT NULL,
  
  -- 位置信息
  latitude NUMERIC NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
  longitude NUMERIC NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  location_name TEXT NOT NULL,
  
  -- 商品状态
  is_promoted BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Products 表索引
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_is_promoted ON products(is_promoted) WHERE is_promoted = true;
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active) WHERE is_active = true;
-- 地理位置索引 - 使用简单的B-tree索引
CREATE INDEX IF NOT EXISTS idx_products_latitude ON products(latitude);
CREATE INDEX IF NOT EXISTS idx_products_longitude ON products(longitude);

-- Products 表触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 2. CONVERSATIONS 表 - 聊天对话
-- ================================================
CREATE TABLE IF NOT EXISTS conversations (
  -- 主键
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联的商品
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  
  -- 参与对话的两个用户
  user1_id TEXT NOT NULL,
  user2_id TEXT NOT NULL,
  
  -- 对话状态
  is_archived BOOLEAN DEFAULT false,
  
  -- 时间戳
  last_message_time TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- 唯一约束：同一商品的两个用户只能有一个对话
  CONSTRAINT unique_conversation UNIQUE (product_id, user1_id, user2_id)
);

-- Conversations 表索引
CREATE INDEX IF NOT EXISTS idx_conversations_product ON conversations(product_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_time DESC);

-- ================================================
-- 3. MESSAGES 表 - 聊天消息
-- ================================================
CREATE TABLE IF NOT EXISTS messages (
  -- 主键
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 所属对话
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- 发送者
  sender_id TEXT NOT NULL,
  
  -- 消息内容
  text TEXT NOT NULL CHECK (length(text) > 0 AND length(text) <= 5000),
  
  -- 消息类型 (text, image, system)
  message_type TEXT DEFAULT 'text' NOT NULL,
  
  -- 附件 URL (可选)
  attachment_url TEXT,
  
  -- 消息状态
  is_read BOOLEAN DEFAULT false NOT NULL,
  is_deleted BOOLEAN DEFAULT false NOT NULL,
  
  -- 时间戳
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Messages 表索引
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = false;

-- ================================================
-- 4. USER_PROFILES 表 - 用户扩展信息 (可选)
-- ================================================
-- 注意: Supabase Auth 已经有 auth.users 表
-- 这个表用于存储额外的用户信息
CREATE TABLE IF NOT EXISTS user_profiles (
  -- 用户ID (关联到 auth.users)
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 用户名和显示信息
  username TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  
  -- 联系信息
  phone TEXT,
  
  -- 位置信息
  default_location_name TEXT,
  default_latitude NUMERIC,
  default_longitude NUMERIC,
  
  -- 用户状态
  is_verified BOOLEAN DEFAULT false,
  verification_badge_type TEXT, -- 'email', 'phone', 'identity'
  
  -- 统计信息
  total_listings INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  rating_average NUMERIC(3,2) DEFAULT 0.0,
  rating_count INTEGER DEFAULT 0,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- User Profiles 表索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_verified ON user_profiles(is_verified) WHERE is_verified = true;

-- User Profiles 表触发器
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 5. REVIEWS 表 - 用户评价 (可选，用于未来扩展)
-- ================================================
CREATE TABLE IF NOT EXISTS reviews (
  -- 主键
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 评价关系
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- 评分和内容
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- 唯一约束：一个用户对同一商品只能评价一次
  CONSTRAINT unique_review UNIQUE (reviewer_id, product_id)
);

-- Reviews 表索引
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_user ON reviews(reviewed_user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);

-- ================================================
-- 6. FAVORITES 表 - 用户收藏 (可选)
-- ================================================
CREATE TABLE IF NOT EXISTS favorites (
  -- 主键
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关系
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- 唯一约束
  CONSTRAINT unique_favorite UNIQUE (user_id, product_id)
);

-- Favorites 表索引
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product ON favorites(product_id);

-- ================================================
-- 7. NOTIFICATIONS 表 - 通知系统 (可选)
-- ================================================
CREATE TABLE IF NOT EXISTS notifications (
  -- 主键
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 接收者
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 通知类型和内容
  notification_type TEXT NOT NULL, -- 'message', 'like', 'comment', 'system'
  title TEXT NOT NULL,
  body TEXT,
  
  -- 关联数据
  related_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  related_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  
  -- 状态
  is_read BOOLEAN DEFAULT false NOT NULL,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Notifications 表索引
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ================================================
-- 8. 行级安全策略 (Row Level Security)
-- ================================================

-- 启用 RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Products 策略
CREATE POLICY "Anyone can view active products" ON products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can create products" ON products
  FOR INSERT WITH CHECK (auth.uid()::text = seller_id);

CREATE POLICY "Users can update own products" ON products
  FOR UPDATE USING (auth.uid()::text = seller_id);

CREATE POLICY "Users can delete own products" ON products
  FOR DELETE USING (auth.uid()::text = seller_id);

-- Conversations 策略
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (
    auth.uid()::text = user1_id OR 
    auth.uid()::text = user2_id
  );

CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK (
    auth.uid()::text = user1_id OR 
    auth.uid()::text = user2_id
  );

-- Messages 策略
CREATE POLICY "Users can view messages in own conversations" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = messages.conversation_id 
      AND (conversations.user1_id = auth.uid()::text OR conversations.user2_id = auth.uid()::text)
    )
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid()::text = sender_id AND
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = conversation_id 
      AND (conversations.user1_id = auth.uid()::text OR conversations.user2_id = auth.uid()::text)
    )
  );

CREATE POLICY "Users can update own messages" ON messages
  FOR UPDATE USING (auth.uid()::text = sender_id);

-- User Profiles 策略
CREATE POLICY "Anyone can view profiles" ON user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reviews 策略
CREATE POLICY "Anyone can view reviews" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can create reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Favorites 策略
CREATE POLICY "Users can view own favorites" ON favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own favorites" ON favorites
  FOR ALL USING (auth.uid() = user_id);

-- Notifications 策略
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ================================================
-- 9. Supabase Real-time 配置
-- ================================================

-- 启用 Real-time (需要在 Supabase Dashboard 中手动启用)
-- 但我们可以添加注释说明哪些表需要开启

-- IMPORTANT: 在 Supabase Dashboard 中启用以下表的 Real-time:
-- 1. messages - 用于实时聊天
-- 2. conversations - 用于对话列表更新
-- 3. notifications - 用于实时通知

-- ================================================
-- 10. 实用函数
-- ================================================

-- 计算两点之间的距离 (公里)
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 NUMERIC, 
  lon1 NUMERIC, 
  lat2 NUMERIC, 
  lon2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  R NUMERIC := 6371; -- 地球半径（公里）
  dLat NUMERIC;
  dLon NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  dLat := radians(lat2 - lat1);
  dLon := radians(lon2 - lon1);
  
  a := sin(dLat/2) * sin(dLat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dLon/2) * sin(dLon/2);
  
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================
-- 11. 初始化数据 (可选)
-- ================================================

-- 插入一些示例分类数据（如果需要单独的categories表）
-- 当前应用使用枚举，所以此处不需要

-- ================================================
-- 完成！
-- ================================================

-- 验证表创建
SELECT 
  table_name, 
  (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND table_name IN ('products', 'conversations', 'messages', 'user_profiles', 'reviews', 'favorites', 'notifications')
ORDER BY table_name;
