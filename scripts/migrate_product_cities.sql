-- 为现有产品更新城市信息
-- 注意：这个脚本会将所有没有城市信息的产品设置为默认值
-- 在实际运行前，应该根据产品的 latitude/longitude 调用地理编码 API 获取真实城市

-- 方案1: 设置默认城市（临时方案）
UPDATE products
SET 
    city = COALESCE(city, 'Ciudad de México'),
    country = COALESCE(country, 'MX')
WHERE deleted_at IS NULL
  AND (city IS NULL OR city = '');

-- 方案2: 根据常见坐标推测城市（需要自定义逻辑）
-- 示例：墨西哥城附近的坐标
UPDATE products
SET 
    city = CASE 
        WHEN latitude BETWEEN 19.0 AND 19.9 AND longitude BETWEEN -99.5 AND -98.5 THEN 'Ciudad de México'
        ELSE COALESCE(city, 'Unknown')
    END,
    country = COALESCE(country, 'MX')
WHERE deleted_at IS NULL
  AND (city IS NULL OR city = '');
