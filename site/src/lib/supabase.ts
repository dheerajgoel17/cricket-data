import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Browser Supabase client (anon key). Null when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are unset (local builds without accounts). */
let client: SupabaseClient | null | undefined;
let authSettings: Promise<{ google: boolean }> | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  client = url && key
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } })
    : null;
  return client;
}

export const authConfigured = () => !!getSupabase();

/** Which social providers the project has turned on (from `/auth/v1/settings`). */
export function getAuthProviderFlags(): Promise<{ google: boolean }> {
  if (authSettings) return authSettings;
  const url = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!url || !key) {
    authSettings = Promise.resolve({ google: false });
    return authSettings;
  }
  authSettings = fetch(`${url}/auth/v1/settings`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    .then(async (r) => {
      if (!r.ok) return { google: false };
      const j = await r.json() as { external?: { google?: boolean } };
      return { google: !!j.external?.google };
    })
    .catch(() => ({ google: false }));
  return authSettings;
}