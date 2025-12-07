import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file manually
const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL || 'https://hiedpvhkkhcwxihpgrig.supabase.co';

// You need to provide the service role key
console.log('To reset the password, you need the Supabase Service Role Key.');
console.log('You can find it in your Supabase Dashboard:');
console.log('1. Go to: https://supabase.com/dashboard/project/hiedpvhkkhcwxihpgrig/settings/api');
console.log('2. Copy the "service_role" secret key');
console.log('3. Run this script with: SUPABASE_SERVICE_KEY=your_key node reset-admin-password.js');
console.log('');

const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.log('Alternatively, you can reset the password through the Supabase Dashboard:');
  console.log('1. Go to: https://supabase.com/dashboard/project/hiedpvhkkhcwxihpgrig/auth/users');
  console.log('2. Find user: alphonsoashe@gmail.com');
  console.log('3. Click the three dots menu > Reset Password');
  console.log('4. Set new password directly');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const userId = 'a88784a9-6a2b-4b7b-8beb-f85bbf470362';
const newPassword = 'admin12345';

console.log('Resetting password for superadmin...');

const { data, error } = await supabase.auth.admin.updateUserById(
  userId,
  { password: newPassword }
);

if (error) {
  console.error('Error resetting password:', error.message);
  process.exit(1);
}

console.log('\n✅ Password reset successfully!');
console.log('\nLogin credentials:');
console.log('Email: alphonsoashe@gmail.com');
console.log('Password: admin12345');
console.log('\n⚠️  Please change this password after logging in!');
