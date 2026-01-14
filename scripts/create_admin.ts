
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars manually since we are running with tsx
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createAdmin() {
    console.log('Creating user xmiosmx@gmail.com...');

    // 1. Sign Up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: 'xmiosmx@gmail.com',
        password: '123456',
        options: {
            data: {
                full_name: 'Admin User',
                role: 'admin', // Trying to set it initially, though RLS might ignore it
                permissions: ['all']
            }
        }
    });

    if (signUpError) {
        console.error('Error creating user:', signUpError.message);
        return;
    }

    console.log('User created successfully:', signUpData.user?.id);
    console.log('Wait... updating metadata requires SQL usually.');
    console.log('Please run the SQL provided by the assistant to Ensure admin role is set if "role: admin" was ignored.');
}

createAdmin();
