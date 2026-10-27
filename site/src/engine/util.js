// Small shared helpers (pure, no DOM).
export const FORMATS = ["T20", "ODI", "Test", "Hundred"];
export const fmtIndex = (name) => FORMATS.findIndex((f) => f.toLowerCase() === String(name).toLowerCase());

/** A side the books and the schedule name differently ("Auckland Aces" / "Auckland"), reduced to one team key. Kept equal to `SAME_SIDE` in src/value_bets/archive.py. */
export const SAME_SIDE = { aucklandaces: "auckland", canterburykings: "canterbury", wellingtonfirebirds: "wellington", otagovolts: "otago", northerndistricts: "northernbrave" };

export function norm(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function lev(a, b, max = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

export const round = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
export const pct = (x, d = 1) => (x == null ? null : round(x * 100, d));

export function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function todayISO(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
