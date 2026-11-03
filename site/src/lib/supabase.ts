import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Browser Supabase client (anon key). Null when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are unset (local builds without accounts). */
let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  client = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
  return client;
}

export const authConfigured = () => !!getSupabase();
