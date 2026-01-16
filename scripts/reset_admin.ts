
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from server/.env
const envPath = path.resolve(process.cwd(), 'server/.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase env vars in server/.env');
    process.exit(1);
}

// Create client with SERVICE ROLE key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function resetAdmin() {
    const email = 'xmiosmx@gmail.com';
    const newPassword = '123456';

    console.log(`Resetting user ${email}...`);

    // 1. Get User ID
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('Error listing users:', listError.message);
        // Fallback: This usually means the key is NOT a service role key.
        if (listError.message.includes('authorization') || listError.status === 401) {
            console.error('CRITICAL: The SUPABASE_SERVICE_ROLE_KEY appears invalid or insufficient permissions.');
        }
        return;
    }

    const user = (users as any[]).find(u => u.email === email);
    if (!user) {
        console.error('User not found.');
        return;
    }

    // 2. Update User (Password + Email Confirm + Metadata)
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        {
            password: newPassword,
            email_confirm: true,
            user_metadata: {
                role: 'admin',
                permissions: ['all']
            }
        }
    );

    if (updateError) {
        console.error('Error updating user:', updateError.message);
        return;
    }

    console.log('User updated successfully!');
    console.log(`ID: ${updateData.user.id}`);
    console.log('✅ Email confirmed');
    console.log('✅ Password reset to 123456');
    console.log('✅ Role set to admin');
}

resetAdmin();
