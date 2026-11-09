// In-play lines: what the price feed lists once a match has started, as plain functions (no fetch, no DOM). The feed is one JSON of matches with quotes;
// a quote is `{ group_name, label, side, line, handicap, odds_dec, n2 }`. Every market it lists is kept (names seen on a started match, probed from a workflow run):
//   "<player> Innings Runs"        player_runs: Over / Under a line on that batter's runs in his current innings
//   "<team> 1st Inns Runs"         team_runs: Over / Under a line on that side's innings total (1st .. 4th)
//   any other Over / Under line    ou: the market's own name ("Runs in First 20 Overs", "Runs at Fall of 3rd Wicket", "Wickets Lost for 100 Runs", the next over's runs ...)
//   everything else                pick: the market's name and its outcomes with their prices (top batter, method of dismissal, milestones, match winner, ...)
// A price is decimal, back only, exactly as listed. The first two kinds feed the existing player and fancy tables (`liveMerge`). Of the rest only what can be judged is shown: over / under runs over a stretch of overs (`keepLiveOu`) as a live row,
// and a batter's milestone ("to score 50") as a line of his own in the props (`milestoneRows`); a single over or delivery, the fall of a wicket, wickets lost, method of dismissal and the other picks are not shown.
import { namesMatch, teamKey } from "./live.js";

/** The scope of a line (as `lines.js` `lineScope`): 0 the whole match, 1 or 2 the batter's own side's innings of a Test. */
const lineScope = (l) => l?.inn || 0;
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

/** Markets nothing on our live feed can settle (one over or delivery, the fall of a wicket, wickets lost, how a wicket falls, who is next, odd / even): never shown, whatever else the name says. */
const NOT_SETTLEABLE = /fall of|wickets?\b|dismissal|how out|\bdeliver|\bballs?\b|next (?:over|batt|bowl|wicket)|\b(?:in|of|for|off)\s+(?:the\s+)?over\s+\d|\b(?:odd|even)\b|single over/i;
/** Runs over a stretch of overs: "Runs in First 20 Overs", "Overs 0-10 ...", "6 Over Runs", "Powerplay". A single over ("Runs in over 3") is not one. */
const OVER_RANGE = /\b(?:first|1st|opening)\s+\d+\s+overs?\b|\bovers?\s+\d+\s*-\s*\d+|\b\d+\s*-\s*\d+\s+overs?\b|\b\d+\s+overs?\s+(?:runs?|session)|\bpowerplay\b/i;
/** Does an over / under market over a stretch of overs belong on the site (the others are dropped)? */
export const keepLiveOu = (market) => OVER_RANGE.test(String(market || "")) && !NOT_SETTLEABLE.test(String(market || ""));

const MILESTONE = /milestone|to score (?:a |an |at least )?(?:\d+|fifty|half[- ]?century|hundred|century)|\b\d+\+\s*runs?\b|\b(?:half[- ]?century|century|fifty|hundred)\b/i;
const NOT_PLAYER_MILESTONE = /most runs|top (?:bat|bowl)|team|partnership|fastest|highest|first (?:wicket|innings)|total/i;
const rungOf = (s) => {
  const t = String(s || ""), m = /(\d{1,3})\s*\+/.exec(t) || /(?:score|reach|make|get|at least)\s+(?:a |an )?(\d{1,3})\b/i.exec(t) || /\b(\d{1,3})\s+runs?\b/i.exec(t);
  if (m) return +m[1];
  return /half[- ]?century|fifty/i.test(t) ? 50 : /century|hundred/i.test(t) ? 100 : null;
};
const GENERIC = /^(?:to|any|a|an|batter|batsman|player|runs?)$/i;
/**
 * A batter's milestone picks (a pick market from the feed) as `{ player, rung, line, over, under }` rows: "<player> To Score 50+" with Yes / No, or "To Score a Century" / "Batter Milestones" with the batters as outcomes
 * ("<player>", "<player> 50+"). `line` is the rung less a half (50 runs is 49.5, as the books list a half-century), `over` the Yes price, `under` the No price when there is one. Anything else gives [].
 */
export function milestoneRows(pick) {
  const name = String(pick?.market || "");
  if (!MILESTONE.test(name) || NOT_PLAYER_MILESTONE.test(name)) return [];
  const head = /^(.+?)\s+(?:milestones?|to score\b|\d+\+|(?:half[- ]?century|century|fifty|hundred)\b)/i.exec(name)?.[1]?.trim();
  const named = head && !GENERIC.test(head) && !/^(?:to|batter|batsman|player)\b/i.test(head) ? head : null;
  const rows = new Map();
  const put = (player, rung, side, p) => {
    if (!player || !Number.isFinite(rung) || rung < 5 || rung > 300) return;
    const k = `${player}|${rung}`, r = rows.get(k) || { player, rung, line: rung - 0.5, over: null, under: null };
    if (side === "no") r.under = Math.max(r.under ?? 0, p) || null; else r.over = Math.max(r.over ?? 0, p) || null;
    rows.set(k, r);
  };
  for (const o of pick.outcomes || []) {
    const label = String(o.label || "").trim(), p = o.price;
    if (/^no$/i.test(label)) { if (named) put(named, rungOf(name), "no", p); continue; }
    if (named) { if (/^yes$/i.test(label) || rungOf(label) != null) put(named, rungOf(label) ?? rungOf(name), "yes", p); continue; }
    const who = label.replace(/\s*[-–(]?\s*\d{1,3}\s*\+?\s*\)?\s*$/, "").replace(/\s+yes$/i, "").trim(), rung = rungOf(label.slice(who.length)) ?? rungOf(o.sub) ?? rungOf(name);
    if (who && !/^(?:yes|no|any other|none|field)$/i.test(who)) put(who, rung, "yes", p);
  }
  return [...rows.values()];
}

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
 * The lines data (`{ lines, fancy }`, what the tables read) with the live lines of started matches added, so the existing tables show them with their own history figures and no table of their own. Live lines are ADDED beside the pre-match ones, never in place of them (the pre-match line is the bet we track and settle):
 * - a batter's innings-runs line becomes a `lines` entry (stat "runs", the book's name, `live: true` on its quote, `opened` the pre-match line nearest evens);
 * - a side's innings-total line becomes a `fancy` entry (`team_total_runs`, its `inn`, `live: true`);
 * - every other line (over / under or pick), and a batter who cannot be linked, goes to `live`: `[{ home, away, start_utc, fmt, markets }]`, shown as live rows.
 * `resolve(name, [home, away])` links a book's player name to `{ pid, name, team }` (or null). A Test's "Innings Runs" is the batter's current innings, not the match: `innOf(team, [home, away])` says which of his side's innings that is (1 or 2, or null when the live match is not known), so the live line is his 1st / 2nd innings line (`inn`) and `opened` comes from that scope's pre-match lines only. While a batter has pre-match lines in that scope, the live line is added only once his runs so far (`soFarOf(name, [home, away])`, null when unknown) are past the main one (the line nearest evens, `openedOf`: a stray high line cannot hold it back). A batter with no pre-match line in that scope (a debutant nobody priced, a 2nd innings) shows the live line at once. The same holds for a batter's milestone at a rung he was priced at before the start (added once his runs are past the rung) and, with `teamRunsOf(team, inn, [home, away], fmt)`, for a side's innings total (added once the side's runs in that innings are past its main pre-match line). With no callback the live line is always added. A match the books never priced before it started (no entry in `doc`) takes its fixture from `fixtures`. Returns `doc` itself when there is nothing live.
 * @param {any} doc
 * @param {any} inplay
 * @param {any} [resolve]
 * @param {any[]} [fixtures]
 * @param {((team: string, sides: string[]) => number | null) | null} [innOf]
 * @param {((name: string, sides: string[]) => number | null) | null} [soFarOf]
 * @param {((team: string, inn: number, sides: string[], fmt: string) => number | null) | null} [teamRunsOf]
 */
export function liveMerge(doc, inplay, resolve, fixtures = [], innOf = null, soFarOf = null, teamRunsOf = null) {
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
    const label = ref.match || `${refHome} vs ${refAway}`, markets = [], addLines = [], addFancy = [];
    // a batter the books priced before the start is linked through those lines (the same book spells him the same way: "M Taha"); anyone else through `resolve`
    const innsOf = (team) => (ref.fmt === "Test" && innOf ? innOf(team || "", [refHome, refAway]) || 0 : 0);
    const known = lines.filter((x) => matchPair(x) === pair && x.pid);
    const link = (name, sides) => {
      const hit = known.find((x) => namesMatch(x.book_name || x.player, name) || namesMatch(x.player, name));
      return hit ? { pid: hit.pid, name: hit.player, team: hit.team } : (resolve ? resolve(name, sides) : null);
    };
    for (const l of m.lines || []) {
      if (l.kind === "player_runs") {
        const who = link(l.player, [refHome, refAway]);
        if (who?.pid) {
          const inn = innsOf(who.team);
          const pre = lines.filter((x) => matchPair(x) === pair && x.stat === "runs" && x.pid === who.pid && lineScope(x) === inn && !x.books?.every((b) => b.live));
          if (pre.length && soFarOf) {
            const runs = soFarOf(who.name || l.player, [refHome, refAway]);
            if (!(runs != null && runs > openedOf(pre).line)) continue; // the main pre-match line is still open: his row stays pre-match
          }
          const opened = openedOf(pre);
          const quote = { source: l.book || FEED_BOOK, kind: "bookmaker", over: l.over, under: l.under, live: true, ...(opened ? { opened: opened.line } : {}) }, at = addLines.find((x) => x.pid === who.pid && x.line === l.line && lineScope(x) === inn);
          if (at) at.books.push(quote); // the same line from another book: one entry with both
          else addLines.push({ pid: who.pid, player: who.name || l.player, book_name: l.player, team: who.team || "", fmt: ref.fmt, stat: "runs", ...(inn ? { inn } : {}), line: l.line, match: label, competition: ref.competition, start_utc: ref.start_utc, books: [quote] });
          continue;
        }
        markets.push({ kind: "ou", market: `${l.player} innings runs`, line: l.line, over: l.over, under: l.under, book: l.book || FEED_BOOK });
      } else if (l.kind === "team_runs") {
        const team = [refHome, refAway].find((t) => sameTeam(t, l.team)) || l.team;
        const pre = fancy.filter((x) => matchPair(x) === pair && x.key === "team_total_runs" && teamKey(x.team) === teamKey(team) && (x.inn || 1) === l.inn && !x.live);
        if (pre.length && teamRunsOf) {
          const runs = teamRunsOf(team, l.inn, [refHome, refAway], ref.fmt);
          if (!(runs != null && runs > openedOf(pre).line)) continue; // the side's main pre-match line is still open: it stays
        }
        const opened = openedOf(pre);
        addFancy.push({ match: label, home: refHome, away: refAway, start_utc: ref.start_utc, fmt: ref.fmt, competition: ref.competition, key: "team_total_runs", scope: "team", team, inn: l.inn, line: l.line, over: l.over, under: l.under, source: l.book || FEED_BOOK, kind: "bookmaker", live: true, ...(opened ? { opened: opened.line } : {}) });
      } else if (l.kind === "pick") {
        // a batter's milestone is a line of his own in the props (replacing the earlier one at that line); every other pick has nothing to be judged by and is not shown
        for (const ms of milestoneRows(l)) {
          const who = link(ms.player, [refHome, refAway]);
          if (!who?.pid) continue;
          const inn = innsOf(who.team);
          if (soFarOf && lines.some((x) => matchPair(x) === pair && x.stat === "runs" && x.pid === who.pid && lineScope(x) === inn && x.line === ms.line && !x.books?.every((b) => b.live))) {
            const runs = soFarOf(who.name || ms.player, [refHome, refAway]);
            if (!(runs != null && runs > ms.line)) continue; // priced before the start at this rung and still open: the pre-match row stays
          }
          const quote = { source: l.book || FEED_BOOK, kind: "bookmaker", over: ms.over, under: ms.under, live: true }, at = addLines.find((x) => x.pid === who.pid && x.line === ms.line && lineScope(x) === inn);
          if (at) at.books.push(quote);
          else addLines.push({ pid: who.pid, player: who.name || ms.player, book_name: ms.player, team: who.team || "", fmt: ref.fmt, stat: "runs", ...(inn ? { inn } : {}), line: ms.line, match: label, competition: ref.competition, start_utc: ref.start_utc, books: [quote] });
        }
      } else if (keepLiveOu(l.market)) markets.push({ ...l, book: l.book || FEED_BOOK });
    }
    // the match's "1st innings score" is the same bet as the side's 1st-innings total while only one side has a 1st-innings line (the one batting): it takes the live line too
    const firstSides = new Set(addFancy.filter((f) => f.inn === 1).map((f) => teamKey(f.team)));
    const firstKey = firstSides.size === 1;
    if (firstKey) {
      const was = openedOf(fancy.filter((x) => matchPair(x) === pair && x.key === "first_innings_runs"));
      for (const f of addFancy.filter((x) => x.inn === 1)) addFancy.push({ ...f, key: "first_innings_runs", scope: "match", team: null, inn: undefined, ...(was ? { opened: was.line } : {}) });
    }
    lines = lines.concat(addLines);
    fancy = fancy.concat(addFancy);
    if (markets.length) live.push({ ...info, markets });
  }
  // what a cache keyed on the lines file's own timestamp must also see: which live player lines there are, and the minute they were read (a row is scored again at most once a minute while a match is on)
  const sig = lines.filter((l) => l.books?.some((b) => b.live)).map((l) => `${l.pid}|${l.stat}|${lineScope(l)}|${l.line}`).sort().join(",") + `@${Math.floor((Date.parse(inplay?.asOf) || 0) / 60000)}`;
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
