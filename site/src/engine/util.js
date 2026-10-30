// Small shared helpers (pure, no DOM).
export const FORMATS = ["T20", "ODI", "Test", "Hundred", "T10", "O60"];
export const fmtIndex = (name) => FORMATS.findIndex((f) => f.toLowerCase() === String(name).toLowerCase());

/** Site format names. T10/O60/O40/FC stay distinct from T20/ODI/Test. The pipeline calls a multi-day match MULTI. */
export function canonFmt(f) {
  const s = String(f || "");
  if (!s) return "";
  if (s === "MULTI" || /^test$/i.test(s)) return "Test";
  const t = s.toLowerCase();
  if (/\bt10\b/.test(t) || (/\b10[- ]overs?\b/.test(t) && !/t20/.test(t))) return "T10";
  if (t === "hundred" || /\bthe hundred\b|\b100[- ]?balls?\b/.test(t)) return "Hundred";
  if (/\b60[- ]overs?\b/.test(t) || t === "o60") return "O60";
  if (/\b40[- ]overs?\b/.test(t) || t === "o40") return "O40";
  if (/t20|twenty20/i.test(s)) return "T20";
  if (/odi|one.?day|list a|50[- ]over/i.test(s)) return "ODI";
  if (t === "fc" || /first.?class/.test(t)) return "FC";
  return FORMATS.includes(s) ? s : s;
}

/** Playing name vs registry surname (Chamari Athapaththu is AC Jayangani). */
export const SURNAME_ALIAS = {
  athapaththu: ["jayangani"],
  jayangani: ["athapaththu"],
};

export const surnamesEq = (a, b) => a === b || (SURNAME_ALIAS[a] || []).includes(b);

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
