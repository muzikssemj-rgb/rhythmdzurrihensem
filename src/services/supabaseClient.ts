import type { SupabaseClient } from '@supabase/supabase-js';

// Hanya URL projek dan kunci anon/publishable digunakan di frontend.
// Kunci service_role TIDAK boleh diletakkan di sini.
const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const isSupabaseConfigured = URL_.startsWith('https://') && KEY.length > 20;

let client: SupabaseClient | null = null;
let loading: Promise<SupabaseClient | null> | null = null;

/** Dimuatkan secara malas — bundle Supabase hanya dimuat jika backend dikonfigurasikan. */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  if (client) return Promise.resolve(client);
  if (!loading) {
    loading = import('@supabase/supabase-js').then(({ createClient }) => {
      client = createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
      return client;
    });
  }
  return loading;
}
