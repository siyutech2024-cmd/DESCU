
-- Create ratings table
CREATE TABLE IF NOT EXISTS public.ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rater_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rated_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL, -- Optional linking to product
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public ratings are viewable by everyone" 
ON public.ratings FOR SELECT 
USING (true);

CREATE POLICY "Users can create ratings" 
ON public.ratings FOR INSERT 
WITH CHECK (auth.uid() = rater_id);

CREATE POLICY "Users can update their own ratings" 
ON public.ratings FOR UPDATE 
USING (auth.uid() = rater_id);

-- Add average rating to profiles? 
-- Better to compute it on the fly or use a view, but for performance, a materialized view or just querying is fine.
-- We can add a function to get user rating.

CREATE OR REPLACE FUNCTION get_user_rating(user_uuid UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    avg_score NUMERIC;
    count_ratings INTEGER;
BEGIN
    SELECT AVG(score)::NUMERIC(2,1), COUNT(*)
    INTO avg_score, count_ratings
    FROM public.ratings
    WHERE rated_id = user_uuid;
    
    RETURN json_build_object(
        'average', COALESCE(avg_score, 0),
        'count', count_ratings
    );
END;
$$;
