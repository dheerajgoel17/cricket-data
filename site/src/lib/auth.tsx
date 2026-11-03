import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { authConfigured, getSupabase } from "@/lib/supabase";

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

const nextPath = () => `${location.pathname}${location.search}${location.hash}` || "/";

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
    sessionStorage.setItem("cph-auth-next", nextPath());
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    return { error: error?.message ?? null };
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
    const { error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (!error) setSignInOpen(false);
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    user: session?.user ?? null,
    session,
    loading,
    configured,
    signInOpen,
    openSignIn,
    closeSignIn,
    requireSignIn,
    signInWithGoogle,
    signInWithPassword,
    signUp,
    signOut,
  }), [session, loading, configured, signInOpen, openSignIn, closeSignIn, requireSignIn, signInWithGoogle, signInWithPassword, signUp, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth needs AuthProvider");
  return v;
}

/** Soft hook for tests / optional trees: returns null outside the provider. */
export function useAuthMaybe(): AuthCtx | null {
  return useContext(Ctx);
}
