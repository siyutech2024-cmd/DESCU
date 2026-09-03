-- Admin Feature Expansion Migration
-- Run this in Supabase SQL Editor

-- 1. System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT -- Admin Email
);

COMMENT ON TABLE system_settings IS 'Global system configuration';

-- Insert default settings
INSERT INTO system_settings (key, value, description) 
VALUES 
  ('site_maintenance', '{"enabled": false, "message": "System is under maintenance."}', 'Maintenance mode toggle'),
  ('signup_enabled', '{"enabled": true}', 'Allow new user registration'),
  ('banner_announcement', '{"text": "", "active": false}', 'Global banner message')
ON CONFLICT (key) DO NOTHING;

-- 2. User Reports Table (Detailed reporting)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id TEXT NOT NULL, -- User who reported
  target_type TEXT NOT NULL, -- 'product', 'user', 'message'
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
  admin_notes TEXT, -- Notes from admin
  resolved_by TEXT, -- Admin Email
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);

COMMENT ON TABLE reports IS 'User reporting system';

-- 3. RLS Policies
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Allow Admins full access to settings
CREATE POLICY "Admins can manage settings" ON system_settings
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
  );

-- Allow Public read for settings (restricted in API logic usually, but here we allow public read for frontend config)
CREATE POLICY "Public can view settings" ON system_settings
  FOR SELECT USING (true);


-- Reports: Users can create, Admins can manage
CREATE POLICY "Users can create reports" ON reports
  FOR INSERT WITH CHECK (auth.uid()::text = reporter_id);

CREATE POLICY "Admins can manage reports" ON reports
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
  );

-- Function to ban user (Helper for User Management)
CREATE OR REPLACE FUNCTION admin_ban_user(target_user_id UUID, ban_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update user metadata to set 'banned: true'
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('banned', true, 'ban_reason', ban_reason, 'banned_at', now())
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to unban user
CREATE OR REPLACE FUNCTION admin_unban_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data - 'banned' - 'ban_reason' - 'banned_at'
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
