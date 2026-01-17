-- 创建评分表
CREATE TABLE IF NOT EXISTS ratings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    rater_id UUID REFERENCES auth.users(id) NOT NULL,
    target_user_id UUID REFERENCES auth.users(id) NOT NULL,
    score INTEGER CHECK (score >= 1 AND score <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(rater_id, target_user_id) -- Prevent multiple ratings
);

-- RLS
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ratings" 
ON ratings FOR SELECT 
USING (true);

CREATE POLICY "Users can rate others" 
ON ratings FOR INSERT 
WITH CHECK (auth.uid() = rater_id);

-- Create view for user stats
CREATE OR REPLACE VIEW user_rating_stats AS
SELECT 
    target_user_id,
    COUNT(*) as total_reviews,
    AVG(score) as average_rating
FROM ratings
GROUP BY target_user_id;
