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
      if (code) {
        const { data, error } = await sb.auth.exchangeCodeForSession(code);
        if (!alive) return;
        if (error) {
          // detectSessionInUrl / StrictMode may have already consumed the code — fall back to a live session.
          const { data: cur } = await sb.auth.getSession();
          if (!cur.session) { setErr(error.message); return; }
        } else if (!data.session) {
          const { data: cur } = await sb.auth.getSession();
          if (!cur.session) { setErr("No session after sign-in."); return; }
        }
      } else {
        const { data } = await sb.auth.getSession();
        if (!alive) return;
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
