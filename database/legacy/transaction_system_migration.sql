-- Orders table - 核心订单表
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  
  -- 订单类型
  order_type VARCHAR(20) CHECK (order_type IN ('meetup', 'shipping')),
  payment_method VARCHAR(20) CHECK (payment_method IN ('online', 'cash')),
  
  -- 订单状态
  status VARCHAR(30) CHECK (status IN (
    'pending_payment',
    'paid',
    'meetup_arranged',
    'shipped',
    'delivered',
    'completed',
    'cancelled',
    'disputed',
    'refunded'
  )) DEFAULT 'pending_payment',
  
  -- 金额
  product_amount DECIMAL(10, 2) NOT NULL,
  shipping_fee DECIMAL(10, 2) DEFAULT 0,
  platform_fee DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'MXN',
  
  -- 当面交易字段
  meetup_location TEXT,
  meetup_location_lat DECIMAL(10, 7),
  meetup_location_lng DECIMAL(10, 7),
  meetup_time TIMESTAMP,
  meetup_confirmed_by_buyer BOOLEAN DEFAULT FALSE,
  meetup_confirmed_by_seller BOOLEAN DEFAULT FALSE,
  
  -- 物流交易字段
  shipping_address JSONB,
  shipping_carrier VARCHAR(100),
  tracking_number VARCHAR(100),
  tracking_url TEXT,
  shipping_evidence_urls TEXT[],
  
  -- 确认字段
  buyer_confirmed_at TIMESTAMP,
  seller_confirmed_at TIMESTAMP,
  auto_confirmed BOOLEAN DEFAULT FALSE,
  
  -- 支付字段
  stripe_payment_intent_id VARCHAR(255),
  stripe_transfer_id VARCHAR(255),
  payment_captured BOOLEAN DEFAULT FALSE,
  transferred_to_seller BOOLEAN DEFAULT FALSE,
  
  -- 时间管理
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  expires_at TIMESTAMP,
  
  CONSTRAINT valid_meetup CHECK (
    order_type != 'meetup' OR (meetup_location IS NOT NULL OR status = 'pending_payment' OR status = 'paid')
  ),
  CONSTRAINT valid_shipping CHECK (
    order_type != 'shipping' OR (shipping_address IS NOT NULL OR status = 'pending_payment')
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Order Timeline table - 订单事件日志
CREATE TABLE IF NOT EXISTS order_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  description TEXT,
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_order ON order_timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_timeline_created ON order_timeline(created_at DESC);

-- Credit Scores table - 信用评分
CREATE TABLE IF NOT EXISTS credit_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL,
  score INTEGER DEFAULT 100,
  level VARCHAR(20) DEFAULT 'silver',
  
  -- 统计
  total_orders INTEGER DEFAULT 0,
  completed_orders INTEGER DEFAULT 0,
  cancelled_orders INTEGER DEFAULT 0,
  disputed_orders INTEGER DEFAULT 0,
  on_time_completion_rate DECIMAL(5, 2) DEFAULT 100.00,
  
  -- 时间戳
  last_order_at TIMESTAMP,
  last_updated TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_score CHECK (score >= -100 AND score <= 300),
  CONSTRAINT valid_level CHECK (level IN ('diamond', 'gold', 'silver', 'bronze', 'restricted'))
);

CREATE INDEX IF NOT EXISTS idx_credit_user ON credit_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_score ON credit_scores(score DESC);

-- Disputes table - 纠纷管理
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  dispute_type VARCHAR(50),
  description TEXT,
  evidence_urls TEXT[],
  
  status VARCHAR(20) DEFAULT 'pending',
  resolution_notes TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_dispute_type CHECK (dispute_type IN ('not_received', 'damaged', 'not_as_described', 'seller_no_show', 'buyer_no_show', 'other')),
  CONSTRAINT valid_dispute_status CHECK (status IN ('pending', 'investigating', 'resolved_buyer', 'resolved_seller', 'resolved_partial', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

-- Stripe Accounts table - 卖家银行账户
CREATE TABLE IF NOT EXISTS stripe_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL,
  stripe_account_id VARCHAR(255) UNIQUE,
  bank_account_last4 VARCHAR(4),
  bank_name VARCHAR(100),
  account_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_user ON stripe_accounts(user_id);

-- RLS Policies

-- Orders policies
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own orders as buyer" ON orders;
CREATE POLICY "Users can view their own orders as buyer"
  ON orders FOR SELECT
  USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Users can view their own orders as seller" ON orders;
CREATE POLICY "Users can view their own orders as seller"
  ON orders FOR SELECT
  USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Users can create orders as buyer" ON orders;
CREATE POLICY "Users can create orders as buyer"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Buyers and sellers can update their orders" ON orders;
CREATE POLICY "Buyers and sellers can update their orders"
  ON orders FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Order Timeline policies
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view timeline for their orders" ON order_timeline;
CREATE POLICY "Users can view timeline for their orders"
  ON order_timeline FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_timeline.order_id 
      AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert timeline for their orders" ON order_timeline;
CREATE POLICY "Users can insert timeline for their orders"
  ON order_timeline FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_timeline.order_id 
      AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    )
  );

-- Credit Scores policies
ALTER TABLE credit_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view credit scores" ON credit_scores;
CREATE POLICY "Anyone can view credit scores"
  ON credit_scores FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update their own credit score" ON credit_scores;
CREATE POLICY "Users can update their own credit score"
  ON credit_scores FOR UPDATE
  USING (auth.uid() = user_id);

-- Disputes policies
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view disputes for their orders" ON disputes;
CREATE POLICY "Users can view disputes for their orders"
  ON disputes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = disputes.order_id 
      AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create disputes for their orders" ON disputes;
CREATE POLICY "Users can create disputes for their orders"
  ON disputes FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = disputes.order_id 
      AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    )
  );

-- Stripe Accounts policies
ALTER TABLE stripe_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own stripe account" ON stripe_accounts;
CREATE POLICY "Users can view their own stripe account"
  ON stripe_accounts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own stripe account" ON stripe_accounts;
CREATE POLICY "Users can manage their own stripe account"
  ON stripe_accounts FOR ALL
  USING (auth.uid() = user_id);

-- Functions

-- 自动更新updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_accounts_updated_at
  BEFORE UPDATE ON stripe_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 自动初始化用户信用分 (需要在用户系统中手动调用)
-- CREATE OR REPLACE FUNCTION init_user_credit_score()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   INSERT INTO credit_scores (user_id, score, level)
--   VALUES (NEW.id, 100, 'silver')
--   ON CONFLICT (user_id) DO NOTHING;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER init_credit_on_user_create
--   AFTER INSERT ON users
--   FOR EACH ROW
--   EXECUTE FUNCTION init_user_credit_score();
