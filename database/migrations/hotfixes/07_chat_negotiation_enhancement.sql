-- ==============================================================================
-- DESCU MARKETPLACE - 聊天和议价功能数据库迁移
-- ==============================================================================
-- 此脚本扩展聊天系统以支持：
-- 1. 多种消息类型（文本、系统通知、订单状态、卡片等）
-- 2. 消息置顶功能
-- 3. 议价功能

-- =============================================================================
-- PART 1: 扩展 messages 表
-- =============================================================================

-- 添加新列
DO $$
BEGIN
    -- 消息类型
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'message_type'
    ) THEN
        ALTER TABLE messages ADD COLUMN message_type VARCHAR(20) DEFAULT 'text';
    END IF;
    
    -- 是否置顶
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'is_pinned'
    ) THEN
        ALTER TABLE messages ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- 置顶到何时
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'pinned_until'
    ) THEN
        ALTER TABLE messages ADD COLUMN pinned_until TIMESTAMPTZ;
    END IF;
    
    -- 消息元数据（JSON，用于存储卡片数据）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE messages ADD COLUMN metadata JSONB;
    END IF;
END $$;

-- 优化索引
CREATE INDEX IF NOT EXISTS idx_messages_type 
    ON messages(conversation_id, message_type);

CREATE INDEX IF NOT EXISTS idx_messages_pinned 
    ON messages(conversation_id, is_pinned DESC, created_at DESC);

-- 添加消息类型约束
ALTER TABLE messages DROP CONSTRAINT IF EXISTS check_message_type;
ALTER TABLE messages ADD CONSTRAINT check_message_type 
    CHECK (message_type IN (
        'text',              -- 普通文本
        'system',            -- 系统通知
        'order_status',      -- 订单状态更新
        'location',          -- 定位卡片
        'images',            -- 图片墙
        'meetup_time',       -- 见面时间
        'price_negotiation', -- 议价请求
        'price_negotiation_response' -- 议价响应
    ));

-- =============================================================================
-- PART 2: 创建 price_negotiations 表
-- =============================================================================

CREATE TABLE IF NOT EXISTS price_negotiations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    original_price DECIMAL(10, 2) NOT NULL,
    proposed_price DECIMAL(10, 2) NOT NULL,
    proposed_by UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(20) DEFAULT 'pending',
    counter_price DECIMAL(10, 2),
    response_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_negotiations_conversation 
    ON price_negotiations(conversation_id);

CREATE INDEX IF NOT EXISTS idx_negotiations_product 
    ON price_negotiations(product_id);

CREATE INDEX IF NOT EXISTS idx_negotiations_status 
    ON price_negotiations(status);

-- 状态约束
ALTER TABLE price_negotiations DROP CONSTRAINT IF EXISTS check_negotiation_status;
ALTER TABLE price_negotiations ADD CONSTRAINT check_negotiation_status 
    CHECK (status IN ('pending', 'accepted', 'rejected', 'countered', 'expired'));

-- RLS
ALTER TABLE price_negotiations ENABLE ROW LEVEL SECURITY;

-- 策略：用户可以查看自己对话中的议价
DROP POLICY IF EXISTS "Users can view negotiations in their conversations" ON price_negotiations;
CREATE POLICY "Users can view negotiations in their conversations"
ON price_negotiations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM conversations 
        WHERE conversations.id = price_negotiations.conversation_id 
        AND (conversations.buyer_id = auth.uid() OR conversations.seller_id = auth.uid())
    )
);

-- 策略：买家可以创建议价
DROP POLICY IF EXISTS "Buyers can create negotiations" ON price_negotiations;
CREATE POLICY "Buyers can create negotiations"
ON price_negotiations FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM conversations 
        WHERE conversations.id = price_negotiations.conversation_id 
        AND conversations.buyer_id = auth.uid()
    )
    AND proposed_by = auth.uid()
);

-- 策略：卖家可以更新议价状态
DROP POLICY IF EXISTS "Sellers can update negotiations" ON price_negotiations;
CREATE POLICY "Sellers can update negotiations"
ON price_negotiations FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM conversations 
        WHERE conversations.id = price_negotiations.conversation_id 
        AND conversations.seller_id = auth.uid()
    )
);

-- =============================================================================
-- PART 3: 触发器和函数
-- =============================================================================

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_price_negotiation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_price_negotiation_updated_at ON price_negotiations;
CREATE TRIGGER trigger_update_price_negotiation_updated_at
    BEFORE UPDATE ON price_negotiations
    FOR EACH ROW
    EXECUTE FUNCTION update_price_negotiation_updated_at();

-- 自动取消置顶过期的消息（可选，定期清理任务）
CREATE OR REPLACE FUNCTION unpin_expired_messages()
RETURNS void AS $$
BEGIN
    UPDATE messages
    SET is_pinned = FALSE
    WHERE is_pinned = TRUE 
    AND pinned_until IS NOT NULL 
    AND pinned_until < NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 4: 验证
-- =============================================================================

-- 验证 messages 表结构
SELECT 
    column_name, 
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'messages'
AND column_name IN ('message_type', 'is_pinned', 'pinned_until', 'metadata')
ORDER BY column_name;

-- 验证 price_negotiations 表
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'price_negotiations') as column_count
FROM information_schema.tables
WHERE table_name = 'price_negotiations';

-- 完成
SELECT 'Migration completed successfully!' as status;
