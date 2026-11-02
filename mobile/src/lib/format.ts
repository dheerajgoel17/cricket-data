/* eslint-disable @typescript-eslint/no-explicit-any */
// Display helpers the fixture card shares with the site (site/src/components/app/fixture-card.tsx, site/src/lib/format.ts).

export const pretty = (s: string) => (s || "").replace(/-/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** The series a fixture belongs to; with none named, "Men's cricket" / "Women's cricket". */
export const seriesName = (f: any) => (f.series ? (f.series.includes(" ") ? f.series : pretty(f.series.replace(/-\d{4}$/, ""))) : `${f.gender === "female" ? "Women's" : "Men's"} cricket`);

/** Short chip label: drops the year, "in <place>" and "tour of <host>" tails so names are not cut mid-word. */
export const shortSeries = (n: string) => {
  const t = n.replace(/\s+\d{4}([-/]\d{2,4})?$/, "").replace(/\s+in\s+[A-Z][\w ]*$/, "").replace(/\s+tour of\s.*$/i, " tour").trim();
  return t.length > 30 ? `${t.slice(0, 29)}…` : t;
};

export const city = (venue: string) => (venue || "").split(",")[0].replace(/\(.*\)/, "").trim();

/** A start with a clock time ("2026-11-01T07:00Z"), not just a date. */
export const hasTime = (f: { start: string }) => f.start.length > 10;

export function startsIn(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000)), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d >= 1) return `Starts in ${d} day${d > 1 ? "s" : ""}`;
  return h >= 1 ? `Starts in ${h}h${m % 60 ? ` ${m % 60}m` : ""}` : `Starts in ${m}m`;
}

export const localTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Today", "Tomorrow", else "Sun, Nov 1". */
export function dayLabel(d: Date, now = Date.now()) {
  const diff = Math.round((dayStart(d) - dayStart(new Date(now))) / 864e5);
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export const initials = (name: string) => String(name).replace(/\(W\)|\bWomen\b(?!['’]s)/gi, "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** "12:13:42", or "2d 03:10:05" a day or more out: the time left to the start, to the second. */
export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60, x = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d ? `${d}d ` : ""}${p(h)}:${p(m)}:${p(x)}`;
}
