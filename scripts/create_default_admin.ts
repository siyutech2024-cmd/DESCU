
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

async function createDefaultAdmin() {
    const email = 'admin@descu.ai';
    const password = '123456';

    console.log(`Creating/Updating default admin user: ${email}...`);

    // 1. Check if user exists
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    const existingUser = users.find(u => u.email === email);

    if (existingUser) {
        // Update existing
        console.log('User exists. Updating password and role...');
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            {
                password: password,
                email_confirm: true,
                user_metadata: {
                    role: 'admin',
                    permissions: ['all']
                }
            }
        );
        if (updateError) {
            console.error('Error updating user:', updateError);
        } else {
            console.log('✅ User updated successfully!');
        }
    } else {
        // Create new
        console.log('User does not exist. Creating...');
        const { data: createData, error: createError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
                role: 'admin',
                permissions: ['all']
            }
        });

        if (createError) {
            console.error('Error creating user:', createError);
        } else {
            console.log('✅ User created successfully!');
            console.log(`ID: ${createData.user.id}`);
        }
    }
}

createDefaultAdmin();
