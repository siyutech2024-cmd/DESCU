-- 查看最新产品的完整位置数据
SELECT 
    id,
    title,
    -- 位置字段
    country,
    city,
    town,
    district,
    location_display_name,
    -- 坐标
    latitude,
    longitude,
    -- 原始位置名称
    location_name,
    -- 时间
    created_at
FROM products
ORDER BY created_at DESC
LIMIT 1;
