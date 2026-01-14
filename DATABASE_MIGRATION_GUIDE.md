# Supabase 数据库迁移步骤

## 📋 迁移脚本内容

请按照以下步骤在 Supabase 中创建数据库表结构：

### 步骤 1: 登录 Supabase Dashboard

1. 打开浏览器，访问：https://supabase.com/dashboard
2. 使用您的账户登录
3. 选择项目：`iubhtksmswvglcqxkoqi`

### 步骤 2: 打开 SQL Editor

1. 在左侧菜单中，点击 **SQL Editor** (或直接访问：https://supabase.com/dashboard/project/iubhtksmswvglcqxkoqi/sql)
2. 点击 **+ New Query** 创建新查询

### 步骤 3: 复制并粘贴以下 SQL 脚本

```sql
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
```

### 步骤 4: 执行脚本

1. 粘贴完整的 SQL 脚本到编辑器
2. 点击右下角的 **Run** 按钮 (或按 `Cmd+Enter` / `Ctrl+Enter`)
3. 等待执行完成

### 步骤 5: 验证表已创建

1. 在左侧菜单中，点击 **Table Editor**
2. 您应该看到三个新创建的表：
   - ✅ `products`
   - ✅ `conversations`
   - ✅ `messages`

---

## ✅ 表结构说明

### `products` 表 (商品)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键，自动生成 |
| `seller_id` | TEXT | 卖家用户 ID |
| `seller_name` | TEXT | 卖家姓名 |
| `seller_email` | TEXT | 卖家邮箱 |
| `seller_avatar` | TEXT | 卖家头像 URL |
| `seller_verified` | BOOLEAN | 卖家是否已验证 |
| `title` | TEXT | 商品标题 |
| `description` | TEXT | 商品描述 |
| `price` | NUMERIC | 价格 |
| `currency` | TEXT | 货币（默认 MXN） |
| `images` | TEXT[] | 图片 URL 数组 |
| `category` | TEXT | 分类 |
| `delivery_type` | TEXT | 交付方式 |
| `latitude` | NUMERIC | 纬度 |
| `longitude` | NUMERIC | 经度 |
| `location_name` | TEXT | 位置名称 |
| `is_promoted` | BOOLEAN | 是否推广 |
| `created_at` | TIMESTAMPTZ | 创建时间 |

### `conversations` 表 (对话)

用于存储聊天对话记录（用户之间关于商品的对话）

### `messages` 表 (消息)

存储对话中的具体消息内容

---

## 🔒 安全策略 (Row Level Security)

脚本已启用 RLS 并创建了基本策略：
- ✅ 所有人可以查看商品
- ✅ 所有人可以创建商品（简化版，生产环境应限制为已登录用户）

---

## ❓ 常见问题

**Q: 脚本执行后显示错误怎么办？**
- 检查是否有权限执行 DDL 语句
- 确认使用的是正确的 Supabase 项目

**Q: 如何查看已创建的表？**
- 左侧菜单 → Table Editor → 查看表列表

**Q: 如何修改表结构？**
- 可以在 SQL Editor 中运行 `ALTER TABLE` 语句
- 或在 Table Editor 中可视化编辑

---

完成后，数据库结构就准备好了！您可以开始使用应用上传商品。
