// In-play lines: what the price feed lists once a match has started, as plain functions (no fetch, no DOM). The feed is one JSON of matches with quotes;
// a quote is `{ group_name, label, side, line, handicap, odds_dec, n2 }`. Every market it lists is kept (names seen on a started match, probed from a workflow run):
//   "<player> Innings Runs"        player_runs: Over / Under a line on that batter's runs in his current innings
//   "<team> 1st Inns Runs"         team_runs: Over / Under a line on that side's innings total (1st .. 4th)
//   any other Over / Under line    ou: the market's own name ("Runs in First 20 Overs", "Runs at Fall of 3rd Wicket", "Wickets Lost for 100 Runs", the next over's runs ...)
//   everything else                pick: the market's name and its outcomes with their prices (top batter, method of dismissal, milestones, match winner, ...)
// A price is decimal, back only, exactly as listed. The first two kinds feed the existing player and fancy tables (`liveMerge`); `ou` and `pick` are shown as live rows of their own.
import { namesMatch, teamKey } from "./live.js";

const PLAYER = /^(.+?)\s+Innings Runs$/i;
const TEAM = /^(.+?)\s+(1st|2nd|3rd|4th)\s+Inns(?:ings)?\s+Runs$/i;
/** The price feed's book, as the site publishes it (the same name its pre-match lines carry). */
export const FEED_BOOK = "bet365";
/** Most lines kept for one match, and outcomes for one pick market. */
export const MAX_LINES = 160, MAX_OUTCOMES = 12;

const sideOf = (q) => {
  const s = String(q.side || q.label || "").trim().toLowerCase();
  return s.startsWith("over") ? "over" : s.startsWith("under") ? "under" : null;
};
const price = (v) => (Number.isFinite(+v) && +v > 1 ? Math.round(+v * 1000) / 1000 : null);
const KIND_ORDER = { team_runs: 0, player_runs: 1, ou: 2, pick: 3 };
/** Match winner style markets are not props or fancy: left out whichever book lists them. */
export const SKIP_MARKET = /^(match winner|match odds|match betting|2-way match|draw no bet|double chance|to win the match|team to lead)/i;

/**
 * The lines of one match's quotes, one row per market and line with the best (highest) price per side:
 * `{ kind: "player_runs", player, line, over, under }`, `{ kind: "team_runs", team, inn, line, over, under }`, `{ kind: "ou", market, line, over, under }`
 * and `{ kind: "pick", market, outcomes: [{ label, price, sub? }] }`. A line with a price on one side only is kept with the other null.
 */
export function parseQuotes(quotes) {
  const rows = new Map(), picks = new Map();
  for (const q of quotes || []) {
    const g = String(q.group_name || "").trim(), p = price(q.odds_dec);
    if (!g || p == null || SKIP_MARKET.test(g)) continue;
    const side = sideOf(q), raw = q.handicap ?? q.line, line = raw == null || raw === "" ? NaN : Number(raw);
    if (side && Number.isFinite(line)) {
      let base = null;
      const t = TEAM.exec(g), pl = t ? null : PLAYER.exec(g);
      if (t) base = { kind: "team_runs", team: t[1].trim(), inn: Number(t[2][0]) };
      else if (pl) base = { kind: "player_runs", player: pl[1].trim() };
      else base = { kind: "ou", market: g };
      const key = `${base.kind}|${base.team || base.player || base.market}|${base.inn || 0}|${line}`;
      const row = rows.get(key) || { ...base, line, over: null, under: null };
      if (row[side] == null || p > row[side]) row[side] = p;
      rows.set(key, row);
      continue;
    }
    const label = String(q.label ?? "").trim();
    if (!label) continue;
    const pick = picks.get(g) || { kind: "pick", market: g, outcomes: [] };
    const sub = String(q.n2 ?? "").trim();
    const have = pick.outcomes.find((o) => o.label === label && (o.sub || "") === sub);
    if (have) { if (p > have.price) have.price = p; } else if (pick.outcomes.length < MAX_OUTCOMES) pick.outcomes.push({ label, price: p, ...(sub ? { sub } : {}) });
    picks.set(g, pick);
  }
  return [...rows.values(), ...picks.values()]
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || String(a.market || a.team || a.player || "").localeCompare(String(b.market || b.team || b.player || "")) || (a.line ?? 0) - (b.line ?? 0))
    .slice(0, MAX_LINES);
}

/** The feed's matches that have started: `{ home, away, league, kickoff, lines }`. Matches with no line read here are dropped. */
export function parseInplayFeed(doc) {
  return (doc?.matches || []).filter((m) => m.in_play).map((m) => ({
    home: String(m.home || ""), away: String(m.away || ""), league: String(m.league || ""), kickoff: m.kickoff_utc || null, lines: parseQuotes(m.quotes),
  })).filter((m) => m.lines.length);
}

const splitMatch = (s) => String(s || "").split(/\s+vs\.?\s+/i);
const pairOf = (a, b) => [teamKey(a), teamKey(b)].filter(Boolean).sort().join("|");
const matchPair = (e) => (e.home ? pairOf(e.home, e.away) : pairOf(...splitMatch(e.match)));

/** A level the books often leave off a side's name ("Bangladesh" for "Bangladesh U19", "India" for "India A"). */
const LEVEL = /\s+(?:u-?\d{2}|a|xi|ii|women|w)$/i;
const core = (n) => teamKey(String(n || "").replace(LEVEL, ""));
/** The same side, spelled alike or one with a level the other leaves off. */
export const sameTeam = (a, b) => { const x = teamKey(a), y = teamKey(b); return !!x && !!y && (x === y || (core(a) === core(b) && (core(a) === x || core(b) === y))); };
const HOURS_3 = 3 * 3600e3;
const near = (a, b) => { const x = Date.parse(a), y = Date.parse(b); return !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x - y) <= HOURS_3; };
/** Does an entry (`home`/`away` or `match: "A vs B"`) with this start belong to the match `m` (home, away, kickoff)? Spelled alike first; else a level left off a side, and then the start must be within 3 hours. */
function samePair(e, m, startOf = e.start_utc) {
  const [eh, ea] = e.home ? [e.home, e.away] : splitMatch(e.match);
  if (pairOf(eh, ea) === pairOf(m.home, m.away)) return true;
  return ((sameTeam(eh, m.home) && sameTeam(ea, m.away)) || (sameTeam(eh, m.away) && sameTeam(ea, m.home))) && near(startOf, m.kickoff);
}

const overProb = (o, u) => (o > 1 && u > 1 ? 1 / o / (1 / o + 1 / u) : null);
/** The line a market opened at: of the earlier entries (each with books), the one whose best-priced book is nearest evens, as `{ line, over, under }`; null when there is none. */
function openedOf(entries) {
  let best = null;
  for (const e of entries) {
    for (const b of e.books || [e]) {
      const p = overProb(b.over, b.under), far = p == null ? 1 : Math.abs(p - 0.5);
      if (!best || far < best.far) best = { far, line: e.line, over: b.over ?? null, under: b.under ?? null };
    }
  }
  return best ? { line: best.line, over: best.over, under: best.under } : null;
}

/**
 * The lines data (`{ lines, fancy }`, what the tables read) with the live lines of started matches folded in, so the existing tables show them with their own history figures and no table of their own:
 * - a batter's innings-runs line becomes a `lines` entry (stat "runs", the book's name, `live: true` on its quote) and replaces every earlier line for that player's runs in that match;
 * - a side's innings-total line becomes a `fancy` entry (`team_total_runs`, its `inn`) and replaces the earlier ones for that side and innings;
 * - every other line (over / under or pick), and a batter who cannot be linked, goes to `live`: `[{ home, away, start_utc, fmt, markets }]`, shown as live rows.
 * `resolve(name, [home, away])` links a book's player name to `{ pid, name, team }` (or null). A match the books never priced before it started (no entry in `doc`) is left out. Returns `doc` itself when there is nothing live.
 */
export function liveMerge(doc, inplay, resolve, fixtures = []) {
  const started = inplay?.matches || [];
  if (!doc || !started.length) return doc;
  let lines = [...(doc.lines || [])], fancy = [...(doc.fancy || [])];
  const live = [];
  for (const m of started) {
    // the match as the books priced it before the start; else the site's own fixture for it (a match no book priced still gets its live lines)
    let ref = lines.find((x) => samePair(x, m)) || fancy.find((x) => samePair(x, m));
    if (!ref) {
      const fx = (fixtures || []).find((f) => samePair({ home: f.a, away: f.b }, m, f.start));
      if (fx) ref = { match: `${fx.a} vs ${fx.b}`, home: fx.a, away: fx.b, start_utc: fx.start, fmt: fx.fmt, competition: fx.series || "", fromFixture: true };
    }
    if (!ref) continue;
    const pair = matchPair(ref), [refHome, refAway] = ref.home ? [ref.home, ref.away] : splitMatch(ref.match);
    const info = { home: refHome, away: refAway, start_utc: ref.start_utc, fmt: ref.fmt, competition: ref.competition };
    const label = ref.match || `${refHome} vs ${refAway}`, markets = [], dropLines = new Set(), dropFancy = new Set(), addLines = [], addFancy = [];
    // a batter the books priced before the start is linked through those lines (the same book spells him the same way: "M Taha"); anyone else through `resolve`
    const known = lines.filter((x) => matchPair(x) === pair && x.pid);
    const link = (name, sides) => {
      const hit = known.find((x) => namesMatch(x.book_name || x.player, name) || namesMatch(x.player, name));
      return hit ? { pid: hit.pid, name: hit.player, team: hit.team } : (resolve ? resolve(name, sides) : null);
    };
    for (const l of m.lines || []) {
      if (l.kind === "player_runs") {
        const who = link(l.player, [refHome, refAway]);
        if (who?.pid) {
          dropLines.add(who.pid);
          const opened = openedOf(lines.filter((x) => matchPair(x) === pair && x.stat === "runs" && x.pid === who.pid && !x.books?.every((b) => b.live)));
          const quote = { source: l.book || FEED_BOOK, kind: "bookmaker", over: l.over, under: l.under, live: true, ...(opened ? { opened: opened.line } : {}) }, at = addLines.find((x) => x.pid === who.pid && x.line === l.line);
          if (at) at.books.push(quote); // the same line from another book: one entry with both
          else addLines.push({ pid: who.pid, player: who.name || l.player, book_name: l.player, team: who.team || "", fmt: ref.fmt, stat: "runs", line: l.line, match: label, competition: ref.competition, start_utc: ref.start_utc, books: [quote] });
          continue;
        }
        markets.push({ kind: "ou", market: `${l.player} innings runs`, line: l.line, over: l.over, under: l.under, book: l.book || FEED_BOOK });
      } else if (l.kind === "team_runs") {
        const team = [refHome, refAway].find((t) => sameTeam(t, l.team)) || l.team;
        dropFancy.add(`${teamKey(team)}|${l.inn}`);
        const opened = openedOf(fancy.filter((x) => matchPair(x) === pair && x.key === "team_total_runs" && teamKey(x.team) === teamKey(team) && (x.inn || 1) === l.inn));
        addFancy.push({ match: label, home: refHome, away: refAway, start_utc: ref.start_utc, fmt: ref.fmt, competition: ref.competition, key: "team_total_runs", scope: "team", team, inn: l.inn, line: l.line, over: l.over, under: l.under, source: l.book || FEED_BOOK, kind: "bookmaker", live: true, ...(opened ? { opened: opened.line } : {}) });
      } else markets.push({ ...l, book: l.book || FEED_BOOK });
    }
    // the match's "1st innings score" is the same bet as the side's 1st-innings total while only one side has a 1st-innings line (the one batting): it takes the live line too
    const firstSides = new Set(addFancy.filter((f) => f.inn === 1).map((f) => teamKey(f.team)));
    const firstKey = firstSides.size === 1;
    if (firstKey) {
      const was = openedOf(fancy.filter((x) => matchPair(x) === pair && x.key === "first_innings_runs"));
      for (const f of addFancy.filter((x) => x.inn === 1)) addFancy.push({ ...f, key: "first_innings_runs", scope: "match", team: null, inn: undefined, ...(was ? { opened: was.line } : {}) });
    }
    lines = lines.filter((x) => !(matchPair(x) === pair && x.stat === "runs" && dropLines.has(x.pid))).concat(addLines);
    fancy = fancy.filter((x) => !(matchPair(x) === pair && ((x.key === "team_total_runs" && dropFancy.has(`${teamKey(x.team)}|${x.inn || 1}`)) || (firstKey && x.key === "first_innings_runs")))).concat(addFancy);
    if (markets.length) live.push({ ...info, markets });
  }
  // what a cache keyed on the lines file's own timestamp must also see: which live player lines there are, and the minute they were read (a row is scored again at most once a minute while a match is on)
  const sig = lines.filter((l) => l.books?.some((b) => b.live)).map((l) => `${l.pid}|${l.stat}|${l.line}`).sort().join(",") + `@${Math.floor((Date.parse(inplay?.asOf) || 0) / 60000)}`;
  return { ...doc, lines, fancy, live, live_sig: sig };
}

/** The other live markets (over / under lines and picks) of a fixture, from `liveMerge`'s `doc.live`: the list for the two sides, either way round; [] when there are none. */
export function liveRows(doc, fixture) {
  if (!fixture?.a || !fixture?.b) return [];
  const same = (m) => (sameTeam(m.home, fixture.a) && sameTeam(m.away, fixture.b)) || (sameTeam(m.home, fixture.b) && sameTeam(m.away, fixture.a));
  return (doc?.live || []).find(same)?.markets || [];
}

const lineId = (l) => [l.kind, l.player || "", l.team || "", l.market || "", l.inn || 0, l.line ?? "", l.book || ""].join("|");

/** The matches of several readers (the price feed and the books that list started matches) as one list, a match once: its lines are joined, the same line from the same book kept once. */
export function mergeMatches(...lists) {
  const all = [];
  for (const m of lists.flat()) {
    if (!pairOf(m?.home, m?.away)) continue;
    const cur = all.find((x) => samePair(x, m, x.kickoff));
    if (!cur) { all.push({ home: m.home, away: m.away, league: m.league || "", kickoff: m.kickoff || null, lines: [...(m.lines || [])] }); continue; }
    const seen = new Set(cur.lines.map(lineId));
    for (const l of m.lines || []) { const id = lineId(l); if (!seen.has(id)) { seen.add(id); cur.lines.push(l); } }
    if (!cur.league && m.league) cur.league = m.league;
  }
  return all;
}
