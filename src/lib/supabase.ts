import { createClient } from '@supabase/supabase-js';

// We use the "!" operator to tell TypeScript that we guarantee 
// these environment variables are defined in our .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Export the Supabase client so it can be used anywhere in the application
export const supabase = createClient(supabaseUrl, supabaseKey);