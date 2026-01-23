-- ========================================
-- 方案1：基于坐标智能推测城市并更新
-- ========================================
-- 此脚本会根据产品的经纬度坐标自动推测所在城市
-- 涵盖墨西哥主要城市的坐标范围

-- 步骤1：先查看将要更新的产品数量（预览）
SELECT 
    COUNT(*) as total_to_update,
    COUNT(CASE WHEN latitude BETWEEN 19.0 AND 19.9 AND longitude BETWEEN -99.5 AND -98.5 THEN 1 END) as cdmx,
    COUNT(CASE WHEN latitude BETWEEN 20.5 AND 21.0 AND longitude BETWEEN -103.5 AND -103.0 THEN 1 END) as guadalajara,
    COUNT(CASE WHEN latitude BETWEEN 25.5 AND 26.0 AND longitude BETWEEN -100.5 AND -100.0 THEN 1 END) as monterrey
FROM products
WHERE deleted_at IS NULL
  AND (city IS NULL OR city = '' OR city = 'Unknown' OR city = '未知城市');

-- 步骤2：执行更新（请在确认上面的预览后运行）
UPDATE products
SET 
    city = CASE 
        -- 墨西哥城 (Ciudad de México)
        -- 坐标范围: 19.0-19.9°N, -99.5--98.5°W
        WHEN latitude BETWEEN 19.0 AND 19.9 
         AND longitude BETWEEN -99.5 AND -98.5 
        THEN 'Ciudad de México'
        
        -- 瓜达拉哈拉 (Guadalajara)
        -- 坐标范围: 20.5-21.0°N, -103.5--103.0°W
        WHEN latitude BETWEEN 20.5 AND 21.0 
         AND longitude BETWEEN -103.5 AND -103.0 
        THEN 'Guadalajara'
        
        -- 蒙特雷 (Monterrey)
        -- 坐标范围: 25.5-26.0°N, -100.5--100.0°W
        WHEN latitude BETWEEN 25.5 AND 26.0 
         AND longitude BETWEEN -100.5 AND -100.0 
        THEN 'Monterrey'
        
        -- 普埃布拉 (Puebla)
        -- 坐标范围: 18.8-19.2°N, -98.5--97.9°W
        WHEN latitude BETWEEN 18.8 AND 19.2 
         AND longitude BETWEEN -98.5 AND -97.9 
        THEN 'Puebla'
        
        -- 坎昆 (Cancún)
        -- 坐标范围: 21.0-21.3°N, -86.9--86.7°W
        WHEN latitude BETWEEN 21.0 AND 21.3 
         AND longitude BETWEEN -86.9 AND -86.7 
        THEN 'Cancún'
        
        -- 蒂华纳 (Tijuana)
        -- 坐标范围: 32.4-32.6°N, -117.2--116.9°W
        WHEN latitude BETWEEN 32.4 AND 32.6 
         AND longitude BETWEEN -117.2 AND -116.9 
        THEN 'Tijuana'
        
        -- 莱昂 (León)
        -- 坐标范围: 21.0-21.3°N, -101.8--101.5°W
        WHEN latitude BETWEEN 21.0 AND 21.3 
         AND longitude BETWEEN -101.8 AND -101.5 
        THEN 'León'
        
        -- 克雷塔罗 (Querétaro)
        -- 坐标范围: 20.5-20.7°N, -100.5--100.3°W
        WHEN latitude BETWEEN 20.5 AND 20.7 
         AND longitude BETWEEN -100.5 AND -100.3 
        THEN 'Querétaro'
        
        -- 其他情况：保持现有值或设为 Unknown
        ELSE COALESCE(city, 'Unknown')
    END,
    country = COALESCE(country, 'MX'),
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND (city IS NULL OR city = '' OR city = 'Unknown' OR city = '未知城市');

-- 步骤3：验证更新结果
SELECT 
    city,
    country,
    COUNT(*) as product_count,
    AVG(latitude) as avg_lat,
    AVG(longitude) as avg_lon
FROM products
WHERE deleted_at IS NULL
GROUP BY city, country
ORDER BY product_count DESC;

-- 步骤4：查看最近更新的产品
SELECT 
    id,
    title,
    city,
    country,
    latitude,
    longitude,
    updated_at
FROM products
WHERE deleted_at IS NULL
ORDER BY updated_at DESC
LIMIT 10;
