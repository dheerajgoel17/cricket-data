import { useCallback, useEffect, useMemo, useRef, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type Q = Record<string, string>;

/** The page's query string as an object, plus a setter that merges (empty values are dropped). */
export function useQ(): [Q, (patch: Record<string, unknown>, opts?: { replace?: boolean }) => void] {
  const [sp, setSp] = useSearchParams();
  const q = useMemo(() => Object.fromEntries(sp.entries()), [sp]);
  const set = useCallback((patch: Record<string, unknown>, opts: { replace?: boolean } = {}) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") next.delete(k); else next.set(k, String(v)); }
    setSp(next, { replace: opts.replace ?? true });
  }, [sp, setSp]);
  return [q, set];
}

export const useGo = () => { const nav = useNavigate(); return (path: string, q: Record<string, unknown> = {}) => { const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)])).toString(); nav(`/${path}${qs ? `?${qs}` : ""}`); }; };

export const Field = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
  <div className={cn("grid gap-1.5", className)}><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>
);

/** Filters apply as you change them (no Update button): selects, checkboxes and dates on change, typed fields shortly after you stop. */
export function LiveForm({ onValues, children, className, delay = 350 }: { onValues: (v: Record<string, string>) => void; children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLFormElement>(null);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fire = useCallback(() => { if (ref.current) { const fd = new FormData(ref.current); onValues(Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]))); } }, [onValues]);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <form ref={ref} className={cn("flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4", className)} onSubmit={(e: FormEvent) => { e.preventDefault(); fire(); }}
      onChange={(e) => { const el = e.target as HTMLElement; if (el.matches("select, input[type=checkbox], input[type=date]")) fire(); }}
      onInput={(e) => { const el = e.target as HTMLElement; if (el.matches("input[type=number], input[type=search], input[type=text]")) { clearTimeout(t.current); t.current = setTimeout(fire, delay); } }}>
      {children}
    </form>
  );
}

/** Native select styled like shadcn's Input (keeps FormData-based live forms trivial and accessible). */
export function NativeSelect({ name, options, defaultValue, className, ...rest }: { name: string; options: [string | number, string][]; defaultValue?: string | number; className?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select name={name} defaultValue={String(defaultValue ?? "")} className={cn("h-10 rounded-md border border-input bg-input px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} {...rest}>
      {options.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
    </select>
  );
}

export const HOME_AWAY: [string, string][] = [["", "any"], ["home", "home"], ["away", "away"], ["neutral", "neutral"]];
