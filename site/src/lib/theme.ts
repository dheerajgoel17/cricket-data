/** Appearance: light, dark, or follow the OS. Default is dark (the current look) until the visitor picks one. */

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "fc-theme";

export function parsePref(raw: string | null | undefined): ThemePref {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "dark";
}

export function resolvedTheme(pref: ThemePref, systemDark = true): ResolvedTheme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

export function readPref(): ThemePref {
  try { return parsePref(typeof localStorage === "undefined" ? null : localStorage.getItem(THEME_KEY)); }
  catch { return "dark"; }
}

export function savePref(pref: ThemePref) {
  try { localStorage.setItem(THEME_KEY, pref); } catch { /* private mode */ }
}

/** Paint the document from a resolved theme. Does not write storage (the header does that on a tap). */
export function paintTheme(resolved: ResolvedTheme, doc: Document = document) {
  const dark = resolved === "dark";
  doc.documentElement.classList.toggle("dark", dark);
  doc.body?.classList.toggle("dark", dark);
  doc.documentElement.style.colorScheme = resolved;
  const meta = doc.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute("content", resolved);
}
