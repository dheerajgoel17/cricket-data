// What goes to the Telegram channel, as plain functions of the data (no I/O, no clock reads of their own): a high-odds line that has cleared, and a model-edge alert from the
// hourly pipeline. The wording is stats, not advice: no stake sizes and no "bet" or "tip" language, because the site's Terms say it does not offer, promote or encourage gambling.
// Numbers are the live feed's settled lines (`lines` of each match, `fancyStanding`) and the pipeline's own alert file; nothing is worked out by a model here.
import { cardPath } from "./card-path.js";
import { fancyStanding, lineBelongs } from "./live.js";
import { bookName } from "./lines.js";
import { MATCH_MARKETS, TEAM_TOTAL_MARKETS, oversLabel, oversN } from "./markets.js";
import { STATS } from "./rules.js";
import { stateRow } from "./state.js";
import { HIGH_ODDS } from "./tape.js";

export const NEW_ALERTS_URL = "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/value_bets/out/new_alerts.json";
export const FANCY_ALERTS_URL = "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/value_bets/out/fancy_alerts.json";
/** The fancy alert file is rewritten every hour, round the clock; a file older than this (two missed runs) means the step has stopped, so its prices are not posted. */
export const FANCY_MAX_AGE_MS = 3 * 3600e3;
/** Lines of one match in a single message (the rest follow in the next one, so a long list never hits Telegram's 4096 character limit). */
export const MAX_LINES = 8;
/** Candidates looked at per run: a backlog is posted a few messages a minute, never all at once. */
export const MAX_HITS = 16, MAX_PROPS = 4, MAX_FANCY = 24; // fancy edges are capped per match in the file (3), and a long list only drips out at `MAX_MESSAGES` a run: a small cap here would keep the same top few claimed in the window for good

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const price = (x) => Number(x).toFixed(2);
const INN = ["", "1st innings", "2nd innings"];
const statWord = (stat) => (STATS[stat]?.label || stat).toLowerCase();

/** The friendliest over price any book lists for a row, `{over, source}` or null. */
function bestOver(books) {
  let best = null;
  for (const b of books || []) if (b?.over > 1 && (!best || b.over > best.over)) best = { over: b.over, source: b.source };
  return best;
}

/** A fancy market in words: "Match sixes", "Australia first 6 overs runs", "India team fours (1st innings)". */
export function fancyWords(f) {
  const n = oversN(f.key);
  const label = n ? `${oversLabel(n).replace(/^(\d+) overs$/, "first $1 overs")} runs` : (MATCH_MARKETS[f.key] || TEAM_TOTAL_MARKETS[f.key])?.label || String(f.key).replace(/_/g, " ");
  const named = f.team ? (/^Team /.test(label) ? `${f.team} ${label.slice(5).toLowerCase()}` : `${f.team} ${label.toLowerCase()}`) : label;
  return `${named}${f.inn ? ` (${INN[f.inn] || `innings ${f.inn}`})` : ""}`;
}

/**
 * Lines that have cleared at a long price: for each live-feed match (`matches[]` of /api/live), a priced player line whose settled verdict is "cleared" and a fancy line whose
 * so-far (`fancyStanding`) has passed the line, where the best over price any book lists is `minOdds` or longer (the site's "High odds hits", `HIGH_ODDS` in tape.js).
 * Longest price first. `key` is stable for the life of the line, so a line is announced once however long it stays cleared.
 */
export function clearedHits(matches, booksDoc, { minOdds = HIGH_ODDS } = {}) {
  const out = [];
  for (const m of matches || []) {
    const row = stateRow(m);
    if (!row) continue;
    const where = { matchKey: row.match_key, match: `${row.a} v ${row.b}`, fmt: row.fmt, series: row.series };
    for (const s of m.lines || []) {
      if (s.verdict !== "cleared" || s.value == null) continue;
      const rows = (booksDoc?.lines || []).filter((l) => l.pid === s.pid && l.stat === s.stat && l.line === s.line && (l.inn || 0) === (s.inn || 0) && lineBelongs(m, l));
      const best = bestOver(rows.flatMap((l) => l.books || []));
      if (!best || best.over < minOdds) continue;
      out.push({ ...where, kind: "hit", key: `hit|${row.match_key}|p|${s.pid}|${s.stat}|${s.line}|${s.inn || 0}`, what: `${rows[0].player} over ${s.line} ${statWord(s.stat)}${s.inn ? ` (${INN[s.inn]})` : ""}`,
        so: s.value, final: s.state === "final", over: best.over, book: bookName(best.source), ...(s.inn || !STATS[s.stat] ? {} : { image: { pid: s.pid, stat: s.stat, line: s.line } }) });
    }
    const fancy = new Map();
    for (const f of booksDoc?.fancy || []) {
      if (!(f.over > 1) || !lineBelongs(m, f)) continue;
      const k = `${f.key}|${f.team || ""}|${f.inn || 0}|${f.line}`, cur = fancy.get(k);
      if (!cur || f.over > cur.over) fancy.set(k, f);
    }
    for (const [k, f] of fancy) {
      if (f.over < minOdds) continue;
      const st = fancyStanding(m, f);
      if (st?.verdict !== "cleared") continue;
      out.push({ ...where, kind: "hit", key: `hit|${row.match_key}|f|${k}`, what: `${fancyWords(f)} over ${f.line}`, so: st.v, final: st.state === "final", over: f.over, book: bookName(f.source) });
    }
  }
  return out.sort((a, b) => b.over - a.over || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

const OU_STAT = { batter_runs: "runs", batter_sixes: "sixes", batter_fours: "fours", bowler_wickets: "wickets" };

/** The share card for a model-edge alert: his id is found in the book file by name, line and stat (the alert carries a name only). `{}` when he is not found: the alert goes out as text. */
function propImage(a, booksDoc) {
  const stat = OU_STAT[a.market_type], name = a.player_matched_as || "";
  if (!stat || !name) return {};
  const rows = (booksDoc?.lines || []).filter((l) => l.pid && l.player === name && l.stat === stat && Math.abs(l.line - a.line) < 0.01 && !l.inn && lineBelongs({ teams: String(a.match || "").split(/\s+vs\s+/i).map((n) => ({ name: n })), start: a.start_utc, fmt: a.format }, l));
  return rows.length ? { image: { pid: rows[0].pid, stat, line: a.line } } : {};
}

/**
 * Model-edge alerts from the hourly pipeline's file (`value_bets/out/new_alerts.json`, only bets it had not raised before, each with a stable `alert_id`). Only pre-match ones
 * (the match has not started), the biggest edge first. The text is finished here: edge, the price a book lists and the model's own fair price, with no stake advice.
 */
export function propAlerts(doc, now = Date.now(), booksDoc = null) {
  const out = [];
  for (const a of doc?.alerts || []) {
    const start = Date.parse(a.start_utc);
    if (!a.alert_id || !(start > now) || !(a.best_odds > 1)) continue;
    const stat = /over\/under\s+[\d.]+\s+(.+)$/i.exec(String(a.market || ""))?.[1];
    const book = Object.entries({ bet365: "bet365", smarkets: "Smarkets", betfair: "Betfair", matchbook: "Matchbook" }).find(([k]) => String(a.best_source || "").toLowerCase().includes(k))?.[1];
    const why = String(a.why || "").trim(), cut = why.length > 220 ? `${why.slice(0, 220).replace(/\s+\S*$/, "")}…` : why;
    const text = [
      `📊 <b>${a.realert ? "Edge grew to" : "Model edge"} ${a.edge_pct >= 0 ? "+" : ""}${Number(a.edge_pct).toFixed(1)}%</b>`,
      esc(`${a.selection}${stat ? ` ${stat.toLowerCase()}` : ""}`),
      esc([String(a.match || "").replace(/\s+vs\s+/i, " v "), a.format, a.start_ist].filter(Boolean).join(" · ")),
      `Listed ${price(a.best_odds)}${book ? ` (${esc(book)})` : ""}${a.fair_odds > 1 ? ` · model fair price ${price(a.fair_odds)}` : ""}`,
      ...(cut ? [esc(cut)] : []),
    ].join("\n");
    out.push({ kind: "prop", key: `prop|${a.alert_id}`, edge: Number(a.edge_pct) || 0, text, ...propImage(a, booksDoc) });
  }
  return out.sort((a, b) => b.edge - a.edge);
}

/**
 * Pre-match fancy edges from `value_bets/out/fancy_alerts.json` (written hourly by site/scripts/fancy-alerts.mjs from the engine's Match Fancy scoring, each with a stable `alert_id`):
 * a line whose last-matches record, pulled toward the market's chance, beats the best listed price. Only a file written within `FANCY_MAX_AGE_MS` and only a match that has not started,
 * the biggest edge first. The numbers are the file's (the engine's); the text is stats, with no stake advice.
 */
export function fancyAlerts(doc, now = Date.now()) {
  if (!(Date.parse(doc?.generated_at_utc) > now - FANCY_MAX_AGE_MS)) return [];
  const out = [];
  for (const a of doc?.alerts || []) {
    if (!a?.alert_id || !(Date.parse(a.start_utc) > now) || !(a.best_odds > 1) || !(a.edge > 0) || !(a.side === "over" || a.side === "under") || !Number.isFinite(a.line)) continue;
    const book = a.best_source ? bookName(a.best_source) : "";
    const text = [
      `📊 <b>History edge +${Number(a.edge_pct).toFixed(1)}%</b>`,
      esc(`${fancyWords(a)}: ${a.side} ${a.line}`),
      esc([String(a.match || "").replace(/\s+vs\s+/i, " v "), a.format, a.start_ist].filter(Boolean).join(" · ")),
      `Listed ${price(a.best_odds)}${book ? ` (${esc(book)})` : ""} · ${a.side} in ${a.hits} of ${a.played} recent matches${a.bat_first ? " batting first" : ""} · history chance ${Math.round(a.chance * 100)}%`,
    ].join("\n");
    out.push({ kind: "fancy", key: `fancy|${a.alert_id}`, edge: Number(a.edge) || 0, text });
  }
  return out.sort((a, b) => b.edge - a.edge);
}

/** `items` (cleared hits, prop alerts and fancy edges) as messages `{keys, text, image}` (`image` is the share card's address when the site address is known and a player line is in the message, else ""): one message per match for hits (several when a match has more than `MAX_LINES`), one per prop alert and per fancy edge. Hits first. */
export function messages(items, { siteUrl = "" } = {}) {
  const foot = siteUrl ? `\n<a href="${esc(siteUrl)}">Open the site</a>` : "";
  const site = String(siteUrl || "").replace(/\/+$/, ""), pic = (i) => (site && i ? `${site}${cardPath(i)}` : "");
  const out = [], by = new Map();
  for (const h of items.filter((i) => i.kind === "hit")) by.set(h.matchKey, [...(by.get(h.matchKey) || []), h]);
  for (const group of by.values()) {
    for (let i = 0; i < group.length; i += MAX_LINES) {
      const part = group.slice(i, i + MAX_LINES), head = part[0];
      const text = [
        `✅ <b>High-odds ${part.length > 1 ? "lines" : "line"} cleared</b>`,
        esc([head.match, head.fmt, head.series].filter(Boolean).join(" · ")),
        "",
        ...part.map((h) => `• ${esc(h.what)}: ${h.so} ${h.final ? "final" : "so far"} · listed ${price(h.over)}${h.book ? ` (${esc(h.book)})` : ""}`),
        "",
        "Cricket stats from the live scorecard, not advice.",
      ].join("\n") + foot;
      out.push({ keys: part.map((h) => h.key), text, image: pic(part.find((h) => h.image)?.image) }); // the picture is the longest-priced player line's card
    }
  }
  for (const p of items.filter((i) => i.kind === "prop")) out.push({ keys: [p.key], text: `${p.text}\n\nModel output from past data, not advice.${foot}`, image: pic(p.image) });
  for (const p of items.filter((i) => i.kind === "fancy")) out.push({ keys: [p.key], text: `${p.text}\n\nHit rate over recent matches, pulled toward the market price. Past data, not advice.${foot}`, image: "" });
  return out;
}
