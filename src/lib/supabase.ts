/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminClient: SupabaseClient | null = null;
let supabaseClient: SupabaseClient | null = null;

/**
 * Backend-only: Get Supabase Admin client using Service Role Key
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (typeof process === 'undefined') return null;

  if (!supabaseAdminClient) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.warn('Supabase Admin: Missing environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
      return null;
    }

    supabaseAdminClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
  }
  return supabaseAdminClient;
}

/**
 * Frontend: Get Supabase Anon client
 */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;

  if (!supabaseClient) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) {
      console.warn('Supabase Frontend: Missing environment variables (VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY)');
      return null;
    }

    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}
