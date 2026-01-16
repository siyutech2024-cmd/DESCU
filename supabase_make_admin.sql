-- Make admin@descu.ai an Admin
UPDATE auth.users
SET raw_user_meta_data = '{"role": "admin", "permissions": ["all"]}'::jsonb
WHERE email = 'admin@descu.ai';

-- Confirm it worked
SELECT email, raw_user_meta_data FROM auth.users WHERE email = 'admin@descu.ai';
