-- ==============================================================================
-- 用户位置信息扩展
-- ==============================================================================
-- 为users表添加位置相关字段，用于IP自动定位

-- 添加位置字段
DO $$
BEGIN
    -- 国家代码
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'location_country'
    ) THEN
        ALTER TABLE users ADD COLUMN location_country VARCHAR(2);
    END IF;
    
    -- 城市
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'location_city'
    ) THEN
        ALTER TABLE users ADD COLUMN location_city VARCHAR(100);
    END IF;
    
    -- 纬度
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'location_lat'
    ) THEN
        ALTER TABLE users ADD COLUMN location_lat DECIMAL(10, 8);
    END IF;
    
    -- 经度
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'location_lng'
    ) THEN
        ALTER TABLE users ADD COLUMN location_lng DECIMAL(11, 8);
    END IF;
    
    -- 最后更新时间
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'location_updated_at'
    ) THEN
        ALTER TABLE users ADD COLUMN location_updated_at TIMESTAMPTZ;
    END IF;
END $$;

-- 创建索引以加速位置查询
CREATE INDEX IF NOT EXISTS idx_users_location 
    ON users(location_country, location_city);

-- 验证
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name LIKE 'location_%'
ORDER BY column_name;

SELECT 'User location fields added successfully! 🌍' as status;
