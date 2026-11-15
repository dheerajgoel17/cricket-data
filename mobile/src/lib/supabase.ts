import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const memory = new Map<string, string>();

const storage = {
  getItem: async (key: string) => {
    if (Platform.OS === "web") return memory.get(key) ?? (typeof localStorage !== "undefined" ? localStorage.getItem(key) : null);
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      memory.set(key, value);
      try { localStorage.setItem(key, value); } catch { /* ignore */ }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      memory.delete(key);
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

let client: SupabaseClient | null | undefined;

/** Browser/native Supabase client (anon key). Null when `EXPO_PUBLIC_SUPABASE_*` are unset. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  client = url && key
    ? createClient(url, key, { auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })
    : null;
  return client;
}

export const authConfigured = () => !!getSupabase();

let authSettings: Promise<{ google: boolean }> | null = null;

/** Which social providers the project has turned on (from `/auth/v1/settings`). */
export function getAuthProviderFlags(): Promise<{ google: boolean }> {
  if (authSettings) return authSettings;
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "").trim();
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
