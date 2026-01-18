-- ============================================
-- 简化版卖家收款 - 数据库迁移
-- ============================================

-- 1. 为 sellers 表添加银行信息字段
DO $$
BEGIN
    -- CLABE 银行账号 (18位)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sellers' AND column_name = 'bank_clabe'
    ) THEN
        ALTER TABLE sellers ADD COLUMN bank_clabe VARCHAR(18);
    END IF;
    
    -- 银行名称
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sellers' AND column_name = 'bank_name'
    ) THEN
        ALTER TABLE sellers ADD COLUMN bank_name VARCHAR(100);
    END IF;
    
    -- 账户持有人姓名
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sellers' AND column_name = 'bank_holder_name'
    ) THEN
        ALTER TABLE sellers ADD COLUMN bank_holder_name VARCHAR(200);
    END IF;
    
    -- 银行信息更新时间
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sellers' AND column_name = 'bank_info_updated_at'
    ) THEN
        ALTER TABLE sellers ADD COLUMN bank_info_updated_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. 为 orders 表添加结算状态字段
DO $$
BEGIN
    -- 结算状态: pending, processing, paid, failed
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'payout_status'
    ) THEN
        ALTER TABLE orders ADD COLUMN payout_status VARCHAR(20) DEFAULT 'pending';
    END IF;
    
    -- 结算时间
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'payout_at'
    ) THEN
        ALTER TABLE orders ADD COLUMN payout_at TIMESTAMPTZ;
    END IF;
    
    -- 结算备注 (转账参考号等)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'payout_reference'
    ) THEN
        ALTER TABLE orders ADD COLUMN payout_reference VARCHAR(100);
    END IF;
END $$;

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_orders_payout_status ON orders(payout_status);
CREATE INDEX IF NOT EXISTS idx_sellers_bank_clabe ON sellers(bank_clabe);

-- 4. 验证
SELECT 'Sellers 表银行字段:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sellers' AND column_name LIKE 'bank_%'
ORDER BY column_name;

SELECT 'Orders 表结算字段:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name LIKE 'payout_%'
ORDER BY column_name;

SELECT '迁移完成! ✅' as status;
