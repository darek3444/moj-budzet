import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// TUTAJ JEST KLUCZ DO SUKCESU: musi być "export const supabase"
export const supabase = createClient(supabaseUrl, supabaseKey);