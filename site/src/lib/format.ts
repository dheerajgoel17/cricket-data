/** Number and time formatting shared by every page. Times are shown in the viewer's own time zone. */
export const odds = (x: number | null | undefined) => (x == null ? "–" : x.toFixed(2));
export const pc = (x: number | null | undefined) => (x == null ? "–" : `${(x * 100).toFixed(1)}%`);
export const num = (x: number | null | undefined) => (x == null ? "–" : Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100));

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
/** 12-hour clock for Indian viewers (IST zone or an -IN locale); everyone else gets their locale default. */
export const H12: { hour12?: boolean } = /^Asia\/(Kolkata|Calcutta)$/.test(TZ) || /-IN$/.test(navigator.language || "") ? { hour12: true } : {};
export const tzName = () => TZ;

const DEFAULT_WHEN: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
export const localWhen = (d?: string | number | Date | null, opts: Intl.DateTimeFormatOptions = DEFAULT_WHEN) => (d ? new Date(d).toLocaleString(undefined, { ...opts, ...H12 }) : "");
export const localTime = (d?: string | number | Date | null) => (d ? new Date(d).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", ...H12 }) : "");

/** "2026-10-23 17:00 IST" (the value-bets feed) -> a Date. */
export function fromIst(str?: string | null) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) IST$/.exec(str || "");
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 330 * 60000) : null;
}

export const initials = (n: string) => String(n).replace(/\(W\)/, "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
export const abbr = (n: string) => { const w = String(n).replace(/\(W\)/, "").trim().split(/\s+/); return (w.length > 1 ? w.map((x) => x[0]).join("") : w[0]).slice(0, 3).toUpperCase(); };
export const shortDate = (d: string) => d.slice(5).split("-").reverse().join("/");
export const pretty = (s: string) => (s || "").replace(/-/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());
export const fixtureStart = (f: { start: string }) => (f.start.length > 10 ? new Date(f.start) : new Date(`${f.start}T12:00:00`));
export const dayKey = (f: { start: string }) => fixtureStart(f).toLocaleDateString("en-CA");
export function dayLabel(k: string) {
  const d = new Date(`${k}T12:00:00`), t = new Date();
  const diff = Math.round((d.getTime() - new Date(`${t.toLocaleDateString("en-CA")}T12:00:00`).getTime()) / 864e5);
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
