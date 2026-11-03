import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabase } from "@/lib/supabase";
import { EmptyState } from "@/components/app/empty-state";

/** Finishes the OAuth / email-confirm redirect, then returns to the path stored before sign-in (or Saved). */
export function AuthCallbackPage() {
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setErr("Sign-in is not configured for this build."); return; }
    let alive = true;
    (async () => {
      const code = new URLSearchParams(location.search).get("code");
      const result = code
        ? await sb.auth.exchangeCodeForSession(code)
        : await sb.auth.getSession();
      if (!alive) return;
      if ("error" in result && result.error) { setErr(result.error.message); return; }
      const session = "data" in result ? result.data.session : null;
      if (!session && code) { setErr("No session after sign-in."); return; }
      if (!session) {
        const { data } = await sb.auth.getSession();
        if (!data.session) { setErr("No session after sign-in."); return; }
      }
      const next = sessionStorage.getItem("cph-auth-next") || "/saved";
      sessionStorage.removeItem("cph-auth-next");
      nav(next.startsWith("/") ? next : "/saved", { replace: true });
    })();
    return () => { alive = false; };
  }, [nav]);

  if (err) return <EmptyState title="Sign-in failed" body={err} />;
  return <EmptyState title="Signing you in…" body="One moment." />;
}
