-- 创建收藏表
CREATE TABLE IF NOT EXISTS favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- 添加 RLS 策略
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites" 
ON favorites FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorites" 
ON favorites FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own favorites" 
ON favorites FOR DELETE 
USING (auth.uid() = user_id);
