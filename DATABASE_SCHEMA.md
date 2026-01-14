# 数据库架构文档

## 📊 完整数据库表结构

### 核心表（必需）

#### 1. **products** - 商品表
| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| seller_id | TEXT | 卖家ID | NOT NULL |
| seller_name | TEXT | 卖家姓名 | NOT NULL |
| seller_email | TEXT | 卖家邮箱 | NOT NULL |
| seller_avatar | TEXT | 卖家头像URL | |
| seller_verified | BOOLEAN | 卖家认证状态 | DEFAULT false |
| title | TEXT | 商品标题 | NOT NULL |
| description | TEXT | 商品描述 | |
| price | NUMERIC | 价格 | NOT NULL, >= 0 |
| currency | TEXT | 货币 | DEFAULT 'MXN' |
| images | TEXT[] | 图片URLs数组 | NOT NULL |
| category | TEXT | 分类 | NOT NULL |
| delivery_type | TEXT | 配送方式 | NOT NULL |
| latitude | NUMERIC | 纬度 | NOT NULL, -90~90 |
| longitude | NUMERIC | 经度 | NOT NULL, -180~180 |
| location_name | TEXT | 位置名称 | NOT NULL |
| is_promoted | BOOLEAN | 是否推广 | DEFAULT false |
| is_active | BOOLEAN | 是否激活 | DEFAULT true |
| view_count | INTEGER | 浏览次数 | DEFAULT 0 |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | 更新时间 | DEFAULT NOW() |

**索引**: seller_id, category, created_at, is_promoted, is_active, location

---

#### 2. **conversations** - 对话表
| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| product_id | UUID | 关联商品 | REFERENCES products |
| user1_id | TEXT | 用户1 ID | NOT NULL |
| user2_id | TEXT | 用户2 ID | NOT NULL |
| is_archived | BOOLEAN | 是否归档 | DEFAULT false |
| last_message_time | TIMESTAMPTZ | 最后消息时间 | DEFAULT NOW() |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |

**唯一约束**: (product_id, user1_id, user2_id)  
**索引**: product_id, user1_id, user2_id, last_message_time

---

#### 3. **messages** - 消息表
| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| conversation_id | UUID | 所属对话 | REFERENCES conversations |
| sender_id | TEXT | 发送者ID | NOT NULL |
| text | TEXT | 消息内容 | NOT NULL, 1-5000字符 |
| message_type | TEXT | 消息类型 | DEFAULT 'text' |
| attachment_url | TEXT | 附件URL | |
| is_read | BOOLEAN | 是否已读 | DEFAULT false |
| is_deleted | BOOLEAN | 是否删除 | DEFAULT false |
| timestamp | TIMESTAMPTZ | 时间戳 | DEFAULT NOW() |

**索引**: conversation_id, sender_id, timestamp, unread messages

---

### 扩展表（可选，用于未来功能）

#### 4. **user_profiles** - 用户资料表
存储用户扩展信息（Supabase Auth 提供基础用户表）

**包含字段**: username, display_name, bio, phone, 默认位置, 认证状态, 评分统计等

#### 5. **reviews** - 评价表
用户对商品/卖家的评价系统

**包含字段**: reviewer_id, reviewed_user_id, product_id, rating(1-5星), comment

#### 6. **favorites** - 收藏表
用户收藏的商品

**包含字段**: user_id, product_id, created_at

#### 7. **notifications** - 通知表
系统通知（新消息、点赞、评论等）

**包含字段**: user_id, notification_type, title, body, is_read, 关联数据

---

## 🔐 安全策略 (RLS)

### Products
- ✅ 所有人可查看激活的商品
- ✅ 用户可创建自己的商品
- ✅ 用户可更新/删除自己的商品

### Conversations & Messages
- ✅ 用户只能查看自己参与的对话和消息
- ✅ 用户只能在自己的对话中发送消息
- ✅ 用户可更新自己发送的消息

### User Profiles
- ✅ 所有人可查看用户资料
- ✅ 用户只能编辑自己的资料

---

## 📈 性能优化

### 索引策略
1. **商品查询**: category, created_at, location
2. **用户查询**: seller_id
3. **聊天查询**: conversation_id, timestamp
4. **地理位置**: GiST 索引用于附近商品查询

### 触发器
- 自动更新 `updated_at` 字段（products, user_profiles）

---

## ⚡ Real-time 配置

需要在 Supabase Dashboard 启用以下表的 Real-time：

1. ✅ **messages** - 实时聊天
2. ✅ **conversations** - 对话列表更新
3. ✅ **notifications** - 实时通知（可选）

---

## 🛠️ 实用函数

### calculate_distance()
计算两个地理坐标之间的距离（公里）

**用法**:
```sql
SELECT calculate_distance(19.4326, -99.1332, 19.4285, -99.1277);
-- 返回距离（公里）
```

---

## 📝 数据迁移检查清单

### 基础表（必需）
- [ ] products
- [ ] conversations  
- [ ] messages

### 扩展表（可选）
- [ ] user_profiles
- [ ] reviews
- [ ] favorites
- [ ] notifications

### 配置项
- [ ] 所有表的RLS策略
- [ ] 所有必要的索引
- [ ] Real-time 启用
- [ ] 触发器创建

---

## 🔍 表关系图

```
auth.users (Supabase内置)
    ↓
user_profiles (扩展资料)
    ↓
products (商品) ← reviews (评价)
    ↓           ↗
conversations (对话)
    ↓
messages (消息)

favorites (收藏)
    ↓
products

notifications (通知)
    ↓
products / conversations
```

---

## ✅ 验证查询

运行迁移脚本后，执行以下查询验证表创建：

```sql
SELECT 
  table_name, 
  (SELECT count(*) FROM information_schema.columns 
   WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

---

## 📌 注意事项

1. **核心表优先**: 先迁移 products, conversations, messages
2. **扩展表可选**: reviews, favorites, notifications 可后续添加
3. **Real-time**: 必须手动在 Supabase Dashboard 启用
4. **RLS 测试**: 迁移后测试每个策略是否正常工作
