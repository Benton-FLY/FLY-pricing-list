import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'missing-anon-key'
export const supabase = createClient(url, key)
export const adminHeaders = async () => { const { data } = await supabase.auth.getSession(); return { Authorization: `Bearer ${data.session?.access_token ?? ''}`, 'Content-Type': 'application/json' } }
