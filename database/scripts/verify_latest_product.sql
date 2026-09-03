-- 验证最新上传产品的位置数据
-- 运行此脚本查看新产品的完整位置信息

SELECT 
    id,
    title,
    -- 基础位置字段
    country,
    city,
    town,
    district,
    location_display_name,
    -- 坐标
    latitude,
    longitude,
    -- 时间戳
    created_at,
    -- 检查结果
    CASE 
        WHEN location_display_name IS NOT NULL AND location_display_name != '' 
        THEN '✅ 位置显示名称正常'
        ELSE '❌ 位置显示名称为空'
    END as display_name_status,
    CASE 
        WHEN city IS NOT NULL AND city != 'Unknown' 
        THEN '✅ 城市信息正常'
        ELSE '❌ 城市信息缺失'
    END as city_status,
    CASE 
        WHEN district IS NOT NULL AND district != '' 
        THEN '✅ 区域信息正常'
        ELSE '⚠️ 区域信息为空（可能该位置无区域）'
    END as district_status
FROM products
ORDER BY created_at DESC
LIMIT 1;

-- 显示格式化的位置信息
SELECT 
    '📍 产品位置' as info_type,
    COALESCE(location_display_name, '未知位置') as location,
    CONCAT(
        COALESCE(city, '?'), 
        CASE WHEN town IS NOT NULL THEN CONCAT(' > ', town) ELSE '' END,
        CASE WHEN district IS NOT NULL THEN CONCAT(' > ', district) ELSE '' END
    ) as full_hierarchy
FROM products
ORDER BY created_at DESC
LIMIT 1;
