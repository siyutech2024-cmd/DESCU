-- 修复产品城市数据为null的问题
-- 根据location_name字段推断城市信息

-- 步骤1: 更新所有包含CDMX的产品
UPDATE products 
SET 
    city = 'Ciudad de México',
    country = 'MX'
WHERE 
    city IS NULL 
    AND (
        location_name ILIKE '%CDMX%' 
        OR location_name ILIKE '%Mexico%'
        OR location_name ILIKE '%Nearby%'
    );

-- 步骤2: 根据经纬度范围判断墨西哥城区域 (CDMX大致坐标范围)
-- 纬度: 19.2 - 19.7, 经度: -99.4 - -99.0
UPDATE products 
SET 
    city = 'Ciudad de México',
    country = 'MX'
WHERE 
    city IS NULL
    AND latitude BETWEEN 19.2 AND 19.7
    AND longitude BETWEEN -99.4 AND -99.0;

-- 步骤3: 对剩余无城市的产品设置默认值
UPDATE products 
SET 
    city = COALESCE(location_name, 'Unknown'),
    country = COALESCE(country, 'MX')
WHERE 
    city IS NULL;

-- 步骤4: 更新location_display_name
UPDATE products 
SET 
    location_display_name = city
WHERE 
    location_display_name IS NULL 
    AND city IS NOT NULL;

-- 验证结果
SELECT 
    city, 
    country, 
    COUNT(*) as count 
FROM products 
WHERE deleted_at IS NULL
GROUP BY city, country
ORDER BY count DESC;
