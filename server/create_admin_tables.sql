-- 管理面板数据库表创建脚本
-- 在 Supabase SQL Editor 中执行

-- ======================
-- 1. ADMIN_USERS 表
-- ======================
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入默认管理员（使用您的Google账号邮箱）
INSERT INTO admin_users (id, email, name, role) VALUES
    ('admin-default', 'admin@descu.ai', 'Admin', 'super_admin')
ON CONFLICT (email) DO NOTHING;

-- ======================
-- 2. ADMIN_LOGS 表
-- ======================
CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id TEXT NOT NULL,
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);

-- ======================
-- 3. 验证表创建
-- ======================
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN ('admin_users', 'admin_logs', 'products', 'conversations', 'messages', 'system_settings')
ORDER BY table_name;

-- ======================
-- 4. 验证products表数据
-- ======================
SELECT COUNT(*) as total_products FROM products;
SELECT id, title, seller_name, created_at 
FROM products 
ORDER BY created_at DESC 
LIMIT 5;
