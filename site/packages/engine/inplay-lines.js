// In-play lines: what the price feed lists once a match has started, as plain functions (no fetch, no DOM). The feed is one JSON of matches with quotes;
// a quote is `{ group_name, label, side, line, handicap, odds_dec }`. Only the markets read here are kept (names seen on a started match, probed from a workflow run):
//   "<player> Innings Runs"        Over / Under a line on that batter's runs in his current innings
//   "<team> 1st Inns Runs"         Over / Under a line on that side's innings total (1st .. 4th)
// Everything else the feed lists (milestones, next wicket, the next delivery) is left out. A price is decimal, back only, exactly as listed.
import { namesMatch, teamKey } from "./live.js";

const PLAYER = /^(.+?)\s+Innings Runs$/i;
const TEAM = /^(.+?)\s+(1st|2nd|3rd|4th)\s+Inns(?:ings)?\s+Runs$/i;

const sideOf = (q) => {
  const s = String(q.side || q.label || "").trim().toLowerCase();
  return s.startsWith("over") ? "over" : s.startsWith("under") ? "under" : null;
};
const price = (v) => (Number.isFinite(+v) && +v > 1 ? Math.round(+v * 1000) / 1000 : null);

/** The lines of one match's quotes: `{ kind: "player_runs", player, line, over, under }` and `{ kind: "team_runs", team, inn, line, over, under }`, one row per market and line with the best (highest) price per side. */
export function parseQuotes(quotes) {
  const rows = new Map();
  for (const q of quotes || []) {
    const g = String(q.group_name || "").trim(), side = sideOf(q), raw = q.handicap ?? q.line, line = raw == null || raw === "" ? NaN : Number(raw), p = price(q.odds_dec);
    if (!side || !Number.isFinite(line) || p == null) continue;
    let base = null;
    const t = TEAM.exec(g), pl = t ? null : PLAYER.exec(g);
    if (t) base = { kind: "team_runs", team: t[1].trim(), inn: Number(t[2][0]) };
    else if (pl) base = { kind: "player_runs", player: pl[1].trim() };
    if (!base) continue;
    const key = `${base.kind}|${base.team || base.player}|${base.inn || 0}|${line}`;
    const row = rows.get(key) || { ...base, line, over: null, under: null };
    if (row[side] == null || p > row[side]) row[side] = p;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => (a.kind < b.kind ? 1 : a.kind > b.kind ? -1 : 0) || a.line - b.line);
}

/** The feed's matches that have started: `{ home, away, league, kickoff, lines }`. Matches with no line read here are dropped. */
export function parseInplayFeed(doc) {
  return (doc?.matches || []).filter((m) => m.in_play).map((m) => ({
    home: String(m.home || ""), away: String(m.away || ""), league: String(m.league || ""), kickoff: m.kickoff_utc || null, lines: parseQuotes(m.quotes),
  })).filter((m) => m.lines.length);
}

/** The listed in-play match of a fixture (the two sides, either way round), or null. `doc` is the route's body. */
export function inplayFor(doc, fixture) {
  const a = teamKey(fixture?.a), b = teamKey(fixture?.b);
  if (!a || !b) return null;
  return (doc?.matches || []).find((m) => { const h = teamKey(m.home), w = teamKey(m.away); return (h === a && w === b) || (h === b && w === a); }) || null;
}

/** A side's listed innings-total line in a match: the one for `inn` (1 batting first, 2 chasing), the line closest to even money when several are listed. */
export function teamLine(match, team, inn) {
  const rows = (match?.lines || []).filter((l) => l.kind === "team_runs" && teamKey(l.team) === teamKey(team) && l.inn === inn && l.over != null && l.under != null);
  return rows.sort((x, y) => Math.abs(x.over - x.under) - Math.abs(y.over - y.under))[0] || null;
}

/** A batter's listed innings-runs line in a match (names as the book spells them: "M Rahim" is Mushfiqur Rahim), the one closest to even money. */
export function playerLine(match, name) {
  const rows = (match?.lines || []).filter((l) => l.kind === "player_runs" && l.over != null && l.under != null && namesMatch(l.player, name));
  return rows.sort((x, y) => Math.abs(x.over - x.under) - Math.abs(y.over - y.under))[0] || null;
}

const pairKey = (m) => [teamKey(m?.home), teamKey(m?.away)].filter(Boolean).sort().join("|");
const lineId = (l) => [l.kind, l.player || "", l.team || "", l.inn || 0, l.line, l.book || ""].join("|");

/** The price feed's matches plus another book's, one row per fixture. The same line from two books stays as two rows (`book` is the published name). */
export function mergeMatches(primary, extra) {
  const by = new Map();
  for (const m of [...(primary || []), ...(extra || [])]) {
    const k = pairKey(m);
    if (!k) continue;
    const cur = by.get(k);
    if (!cur) { by.set(k, { home: m.home, away: m.away, league: m.league || "", kickoff: m.kickoff || null, lines: [...(m.lines || [])] }); continue; }
    const seen = new Set(cur.lines.map(lineId));
    for (const l of m.lines || []) {
      const id = lineId(l);
      if (seen.has(id)) continue;
      seen.add(id);
      cur.lines.push(l);
    }
  }
  return [...by.values()];
}

/** One even-money line per book for the rows `pred` keeps. A line with no `book` is the price feed's. */
export function bookLines(match, pred) {
  const by = new Map();
  for (const l of (match?.lines || []).filter((l) => pred(l) && l.over != null && l.under != null)) {
    const k = l.book || "";
    const cur = by.get(k);
    if (!cur || Math.abs(l.over - l.under) < Math.abs(cur.over - cur.under)) by.set(k, l);
  }
  return [...by.values()];
}
