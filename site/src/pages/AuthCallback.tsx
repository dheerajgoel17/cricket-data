import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSupabase } from "@/lib/supabase";
import { EmptyState } from "@/components/app/empty-state";

/** Finishes the OAuth / email-confirm redirect, then returns to the path stored before sign-in (or Saved). */
export function AuthCallbackPage() {
  const nav = useNavigate();
  const { search } = useLocation();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setErr("Sign-in is not configured for this build."); return; }
    let alive = true;
    (async () => {
      const params = new URLSearchParams(search);
      const code = params.get("code");
      const result = code
        ? await sb.auth.exchangeCodeForSession(code)
        : await sb.auth.getSession();
      if (!alive) return;
      if (!result || typeof result !== "object") { setErr("No session after sign-in."); return; }
      if ("error" in result && result.error) { setErr((result.error as { message: string }).message); return; }
      const session = "data" in result ? (result.data as { session: unknown }).session : null;
      if (!session && code) { setErr("No session after sign-in."); return; }
      if (!session) {
        const { data } = await sb.auth.getSession();
        if (!data.session) { setErr("No session after sign-in."); return; }
      }
      // Prefer ?next= (design-host OAuth finishes on the product origin); else the pre-sign-in path.
      const fromQuery = params.get("next");
      const stored = sessionStorage.getItem("cph-auth-next");
      sessionStorage.removeItem("cph-auth-next");
      const next = (fromQuery && fromQuery.startsWith("/") ? fromQuery : null) || stored || "/saved";
      nav(next.startsWith("/") ? next : "/saved", { replace: true });
    })();
    return () => { alive = false; };
  }, [nav, search]);

  if (err) return <EmptyState title="Sign-in failed" body={err} />;
  return <EmptyState title="Signing you in…" body="One moment." />;
}
