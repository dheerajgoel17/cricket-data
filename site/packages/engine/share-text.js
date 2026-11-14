// The words that go with a shared player prop (the card already shows the pick, so these are the numbers behind it).
// Every figure comes from the chart entries (oldest -> newest, one format, DNP / VOID never count), never from a model. Lines with no data are left out.
import { atGround, vsSide } from "./next-match.js";
import { fairOdds } from "./stats.js";
import { windowRate } from "./windows.js";

const avg = (n) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1));
const played = (es) => es.filter((e) => e.value != null).map((e) => e.value);
const ground = (g) => String(g || "").split(",")[0].trim();

/** `{ entries, line, side, fmt, price, ground, opp, url }` -> the text (a few short lines, then the link). Null without a line or any innings. */
export function shareText({ entries, line, side = "over", fmt = "", price, ground: gName = "", opp = "", url = "" }) {
  if (line == null || line === "" || !Number.isFinite(Number(line))) return null;
  const all = (entries || []).filter((e) => e && e.value != null); // played innings only, as the card counts its last five
  const verb = side === "under" ? "Under" : "Over";
  const out = [];
  const l5 = windowRate(all, 5, line, side);
  if (l5.played) {
    const vals = played(all).slice(-5);
    out.push(`📊 Last ${vals.length}${fmt ? ` (${fmt})` : ""}: ${vals.join(" | ")}`);
    out.push(`✅ ${verb} ${line} in ${l5.hits} of ${l5.played} (${Math.round(l5.p * 100)}%), avg ${avg(l5.mean)}`);
  }
  const here = atGround(all, gName), hr = windowRate(here, 0, line, side);
  if (hr.played) out.push(`📍 ${ground(gName)}: ${played(here).join(" | ")} · ${hr.hits} of ${hr.played}`);
  const vs = vsSide(all, opp), vr = windowRate(vs, 0, line, side);
  if (vr.played) out.push(`🆚 ${opp}: ${played(vs).join(" | ")} · ${vr.hits} of ${vr.played}`);
  const fair = l5.played >= 3 ? fairOdds(l5.p) : null;
  if (fair && price > 1) out.push(`⚖️ Fair ${fair.toFixed(2)} vs ${Number(price).toFixed(2)} listed`);
  if (!out.length) return null;
  if (url) out.push("", url);
  return out.join("\n");
}

const FLAGS = {
  india: "🇮🇳", australia: "🇦🇺", england: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", pakistan: "🇵🇰", "south africa": "🇿🇦", "new zealand": "🇳🇿", "west indies": "🏴‍☠️", "sri lanka": "🇱🇰", bangladesh: "🇧🇩", afghanistan: "🇦🇫",
  zimbabwe: "🇿🇼", ireland: "🇮🇪", netherlands: "🇳🇱", namibia: "🇳🇦", scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", uae: "🇦🇪", "united arab emirates": "🇦🇪", nepal: "🇳🇵", oman: "🇴🇲",
  usa: "🇺🇸", "united states": "🇺🇸", "united states of america": "🇺🇸", canada: "🇨🇦", kenya: "🇰🇪", "papua new guinea": "🇵🇬", "hong kong": "🇭🇰", singapore: "🇸🇬", qatar: "🇶🇦",
};
const flag = (n) => {
  let s = String(n || "").toLowerCase().replace(/\s*\(?\bwomen\b\)?|\s*\(w\)/g, "").replace(/\s+u19(?:[\s-]*women)?$/i, "").replace(/\s+champions$/i, "").replace(/\s+a$/i, "").replace(/\s+/g, " ").trim();
  return FLAGS[s] || "";
};
const side = (n) => `${String(n || "").toUpperCase()}${flag(n) ? ` ${flag(n)}` : ""}`;
/** "🏏 NEW ZEALAND 🇳🇿 vs INDIA 🇮🇳" (a flag only for a national side; clubs go without). */
export const matchTitle = (a, b) => `🏏 ${side(a)} vs ${side(b)}`;

/** A shared match: who plays, when and where; the numbers are on the page behind the link. */
export function matchShareText({ a, b, when = "", venue = "", series = "", url = "" }) {
  if (!a || !b) return null;
  const out = [matchTitle(a, b)];
  const where = [when, String(venue || "").trim()].filter(Boolean).join(" · ");
  if (where) out.push(`🗓 ${where}`);
  if (series) out.push(`🏆 ${series}`);
  out.push("📊 Props, hit rates and fancy lines, free");
  if (url) out.push("", url);
  return out.join("\n");
}

/**
 * A shared fancy (match or team market) line: the pick, how the ground has gone and the recent matches, all from the market's own values (oldest -> newest).
 * `side` is the lean (the side with the better hit rate) or null; `price` its best listed price.
 */
export function fancyShareText({ a, b, label, line, side: lean, price, values = [], ground = "", groundValues = [], url = "" }) {
  if (!a || !b || !label || line == null || !Number.isFinite(Number(line))) return null;
  const hits = (vs) => vs.filter((v) => (lean === "under" ? v < line : v > line)).length;
  const out = [matchTitle(a, b), `🎯 ${String(label).toUpperCase()}${lean ? `: ${lean.toUpperCase()} ${line}` : ` ${line}`}${price > 1 ? ` @ ${Number(price).toFixed(2)}` : ""}`];
  const rec = (title, vs) => {
    const last = vs.slice(-7);
    if (!last.length) return;
    out.push(`${title}: ${last.join(" | ")}${lean ? ` · ${lean} ${hits(last)} of ${last.length}` : ""}`);
  };
  if (groundValues.length >= 3) rec(`📍 ${ground ? String(ground).split(",")[0].trim() : "Venue"}`, groundValues);
  if (values.length) rec(`📊 Last ${Math.min(values.length, 7)} matches`, values);
  if (url) out.push("", url);
  return out.join("\n");
}
