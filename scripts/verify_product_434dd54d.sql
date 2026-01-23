-- 验证特定产品的位置数据
-- 产品 ID: 434dd54d-1092-4d8a-b7a0-24a02791bc2b

SELECT 
    '=== 产品位置信息 ===' as section,
    id,
    title,
    country,
    city,
    town,
    district,
    location_display_name,
    latitude,
    longitude,
    created_at
FROM products
WHERE id = '434dd54d-1092-4d8a-b7a0-24a02791bc2b';

-- 位置数据检查
SELECT 
    '=== 数据完整性检查 ===' as section,
    CASE 
        WHEN city IS NOT NULL AND city != 'Unknown' THEN '✅ 城市: ' || city
        ELSE '❌ 城市缺失'
    END as city_check,
    CASE 
        WHEN district IS NOT NULL AND district != '' THEN '✅ 区域: ' || district
        ELSE '⚠️ 区域为空'
    END as district_check,
    CASE 
        WHEN location_display_name IS NOT NULL AND location_display_name != '' 
        THEN '✅ 显示名称: ' || location_display_name
        ELSE '❌ 显示名称缺失'
    END as display_name_check,
    CASE 
        WHEN latitude IS NOT NULL AND longitude IS NOT NULL 
        THEN '✅ 坐标: (' || latitude || ', ' || longitude || ')'
        ELSE '❌ 坐标缺失'
    END as coordinates_check
FROM products
WHERE id = '434dd54d-1092-4d8a-b7a0-24a02791bc2b';
