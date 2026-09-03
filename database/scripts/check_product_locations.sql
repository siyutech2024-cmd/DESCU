-- 查询所有产品的位置信息，检查 city 和坐标数据
SELECT 
    id,
    title,
    city,
    country,
    latitude,
    longitude,
    location_name,
    created_at
FROM products
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- 统计缺少城市信息的产品数量
SELECT 
    COUNT(*) as total_products,
    COUNT(city) as products_with_city,
    COUNT(*) - COUNT(city) as products_without_city
FROM products
WHERE deleted_at IS NULL;
