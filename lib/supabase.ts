import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://akbwzlkavuznkwreeerh.supabase.co';
const supabasePublishableKey = 'sb_publishable_bvcsfstTUqpjEgO28wNN-g_6nIVwDth';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
