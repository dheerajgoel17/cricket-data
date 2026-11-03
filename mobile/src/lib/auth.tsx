import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { authConfigured, getSupabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signInOpen: boolean;
  openSignIn: () => void;
  closeSignIn: () => void;
  requireSignIn: () => boolean;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const redirectTo = makeRedirectUri({ scheme: "fancycash", path: "auth/callback" });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(authConfigured());
  const [signInOpen, setSignInOpen] = useState(false);
  const configured = authConfigured();

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    let alive = true;
    sb.auth.getSession().then(({ data }) => { if (alive) { setSession(data.session); setLoading(false); } });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { if (alive) { setSession(s); setLoading(false); } });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const openSignIn = useCallback(() => setSignInOpen(true), []);
  const closeSignIn = useCallback(() => setSignInOpen(false), []);
  const requireSignIn = useCallback(() => {
    if (session?.user) return true;
    setSignInOpen(true);
    return false;
  }, [session]);

  const signInWithGoogle = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return { error: "Sign-in is not configured for this build." };
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return { error: error.message };
    if (!data.url) return { error: "No Google sign-in URL." };
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success" || !result.url) return { error: result.type === "cancel" ? null : "Google sign-in did not finish." };
    const url = new URL(result.url);
    const code = url.searchParams.get("code");
    if (code) {
      const { error: ex } = await sb.auth.exchangeCodeForSession(code);
      if (ex) return { error: ex.message };
    } else {
      const hash = url.hash.replace(/^#/, "");
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        const { error: setErr } = await sb.auth.setSession({ access_token, refresh_token });
        if (setErr) return { error: setErr.message };
      } else return { error: "No session in Google redirect." };
    }
    setSignInOpen(false);
    return { error: null };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return { error: "Sign-in is not configured for this build." };
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (!error) setSignInOpen(false);
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return { error: "Sign-in is not configured for this build." };
    const { error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo } });
    if (!error) setSignInOpen(false);
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    user: session?.user ?? null, session, loading, configured, signInOpen,
    openSignIn, closeSignIn, requireSignIn, signInWithGoogle, signInWithPassword, signUp, signOut,
  }), [session, loading, configured, signInOpen, openSignIn, closeSignIn, requireSignIn, signInWithGoogle, signInWithPassword, signUp, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth needs AuthProvider");
  return v;
}
