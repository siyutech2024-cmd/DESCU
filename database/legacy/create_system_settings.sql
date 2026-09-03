-- 创建 system_settings 表
-- 在 Supabase SQL Editor 中运行此脚本

-- 步骤1: 删除旧表（如果存在且结构不对）
DROP TABLE IF EXISTS system_settings CASCADE;

-- 步骤2: 创建新表
CREATE TABLE system_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 步骤3: 插入默认设置
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
    ('site_name', 'DESCU', '网站名称'),
    ('max_upload_size', '10', '最大上传文件大小(MB)'),
    ('enable_registration', 'true', '是否开放用户注册'),
    ('enable_ai_analysis', 'true', '是否启用AI商品分析'),
    ('maintenance_mode', 'false', '维护模式（启用后前端显示维护页面）'),
    ('admin_email', 'admin@descu.ai', '管理员邮箱地址'),
    ('items_per_page', '20', '每页显示商品数量'),
    ('enable_chat', 'true', '是否启用聊天功能'),
    ('max_images_per_product', '5', '每个商品最多图片数量'),
    ('currency_symbol', '$', '默认货币符号');

-- 步骤4: 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 步骤5: 验证表创建成功
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'system_settings'
ORDER BY ordinal_position;

-- 步骤6: 查看数据
SELECT * FROM system_settings ORDER BY setting_key;
