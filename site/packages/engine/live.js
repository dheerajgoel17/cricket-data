// Live score snapshots from Source A: the home list + schedule page (match list, URLs, scores), the match page (current pair, partnership, rates) and the scorecard page (every innings).
// Pure: no fetch, no DOM. Numbers here are "so far", never settlement — VOID rules still apply after the innings qualifies.
import { NO_IDENTITY } from "./identity.js";
import { BOOK_WINDOW_MS as LINE_BOOK_WINDOW, TEST_KEEP_MS, keepMsFor, sameMatchWindow, sameMatchWindowFor } from "./lines.js";
import { SAME_SIDE, norm, surnamesEq } from "./util.js";

export const LIVE_TTL_MS = 15_000;
export const BOOK_WINDOW_MS = LINE_BOOK_WINDOW;
/** A Test is priced and played over several days; the books keep it for 6 days and so must the live feed. */
export const TEST_WINDOW_MS = TEST_KEEP_MS;

export function matchWindow(fmt) {
  return sameMatchWindow(fmt);
}

/** How long the fixture header treats a started match as live on the clock: 4 hours, 6 days for a Test. */
export function clockLiveMs(fmt) {
  return fmt === "Test" || fmt === "FC" ? TEST_WINDOW_MS : 4 * 3600e3;
}

/** An unlisted match is kept when its own page was read, or while it is still being played so a failed page does not hide a Test. */
export function keepGapRow(m, parsed) {
  return !!(parsed || m?.status === "live");
}

/** Short badge the source puts on a card: Stumps, Lunch, Rain delay — not the Live pulse. */
export function sessionLabel(s) {
  const t = String(s || "");
  if (/\bstumps\b|close of (?:play|day)|end of (?:the )?day/i.test(t)) return "Stumps";
  if (/\blunch\b/i.test(t)) return "Lunch";
  if (/\btea\b/i.test(t)) return "Tea";
  if (/\bdinner\b/i.test(t)) return "Dinner";
  if (/\bdrinks\b/i.test(t)) return "Drinks";
  if (/innings break/i.test(t)) return "Innings break";
  if (/team break/i.test(t)) return "Team break";
  if (/\brain\b|wet outfield/i.test(t)) return "Rain delay";
  if (/bad light/i.test(t)) return "Bad light";
  if (/bad weather/i.test(t)) return "Weather";
  if (/\bpaused\b|match delayed|play (?:stopped|suspended)/i.test(t)) return "Paused";
  return "";
}

/** Lunch, tea, stumps, rain delay, paused — a session break, not the end of the match. */
export function isSessionLine(s) {
  return !!sessionLabel(s);
}

/** A real result, not lunch / stumps / a rain delay. */
export function isResultLine(s) {
  const t = String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!t || isSessionLine(t)) return false;
  return /\bwon by\b|\bmatch (drawn|tied|abandoned)\b|\bdrawn\b|\bno result\b|\babandoned\b|\btied\b/.test(t);
}

export function teamKey(n) {
  const k = String(n || "")
    .toLowerCase()
    .replace(/\(w\)|women'?s?|\sw$/g, "")
    .replace(/under-?19s?/g, "u19")
    .replace(/[^a-z0-9]/g, "");
  return SAME_SIDE[k] || k;
}

/** "HC Brook" / "Harry Brook" / "harry brook" — last name plus first initial. Ambiguous surnames stay unmatched. */
export function namesMatch(a, b) {
  const ta = norm(a).split(" ").filter(Boolean), tb = norm(b).split(" ").filter(Boolean);
  if (!ta.length || !tb.length) return false;
  if (ta.join(" ") === tb.join(" ")) return true;
  const sa = ta[ta.length - 1], sb = tb[tb.length - 1];
  if (!surnamesEq(sa, sb)) return false;
  const init = (toks) => toks.slice(0, -1).map((t) => t[0]).join("");
  const ia = init(ta), ib = init(tb);
  if (!ia || !ib) return (ta[0][0] || "") === (tb[0][0] || "");
  if (ia[0] === ib[0]) return true;
  // playing name vs registry surname (Chamari / AC Jayangani): a later initial may be the playing given
  if (sa === sb) return false;
  const blob = (toks) => toks.slice(0, -1).map((t) => (t.length <= 4 ? t : t[0])).join("");
  return blob(ta).includes(ib[0]) || blob(tb).includes(ia[0]);
}

export function oversToBalls(o) {
  const n = Number(o);
  if (!Number.isFinite(n) || n < 0) return null;
  const whole = Math.floor(n + 1e-9), balls = Math.round((n - whole) * 10);
  return whole * 6 + balls;
}

/** Inverse of oversToBalls: 21 balls -> 3.3. */
export function ballsToOvers(b) {
  const n = Number(b);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n / 6) + (n % 6) / 10;
}

/** Score strings: "145/4 (16.2 ov)", "113 & 516", "187/9 (65 ov, target 313)". */
export function parseScore(s) {
  const display = String(s || "").trim();
  if (!display) return { display: "", runs: null, wkts: null, overs: null };
  const last = display.split("&").pop().trim();
  const m = last.match(/^(\d+)(?:\/(\d+))?(?:\s*\(([\d.]+)\s*ov)?/);
  if (!m) return { display, runs: null, wkts: null, overs: null };
  return { display, runs: +m[1], wkts: m[2] != null ? +m[2] : null, overs: m[3] != null ? +m[3] : null };
}

function blankInn(n, team) {
  return { n, team: team || "", batters: [], bowlers: [], yetToBat: [], fow: [], extras: null, runs: null, wkts: null, overs: null };
}

/** Source A / Source B extras order: b, lb, w, nb, pen. */
function extrasOf(parts) {
  const [byes, legByes, wides, noBalls, penalty] = parts.map((x) => nInt(x));
  const total = byes + legByes + wides + noBalls + penalty;
  if (!total && parts.every((x) => !nInt(x))) return null;
  return { byes, legByes, wides, noBalls, penalty, total };
}

export function hasCard(match) {
  return (match?.card || []).some((i) => (i.batters || []).length || (i.bowlers || []).length);
}

/** Innings tables for the scorecard accordion. Prefers a parsed card; otherwise a thin view from so-far players. */
export function liveCard(match) {
  if (hasCard(match)) return match.card;
  const players = match?.players || [];
  if (!players.length) return [];
  const inn0 = (match.innings || [])[0];
  const batTeam = inn0?.team || players.find((p) => p.runs != null)?.team || "";
  const inn = { ...blankInn(1, batTeam), runs: inn0?.runs ?? null, wkts: inn0?.wkts ?? null, overs: inn0?.overs ?? null };
  for (const p of players) {
    if (p.runs != null) {
      inn.batters.push({
        id: p.id, name: p.name, team: p.team, runs: p.runs, balls: p.balls, fours: p.fours, sixes: p.sixes,
        sr: p.sr ?? strikeRate(p.runs, p.balls), out: !!p.out, dismissal: p.out ? (p.dismissal || "out") : "not out",
      });
    }
    if (p.wickets != null || p.conceded != null) {
      inn.bowlers.push({
        id: p.id, name: p.name, team: p.team, wickets: p.wickets, conceded: p.conceded, ballsBowled: p.ballsBowled,
        maidens: p.maidens ?? 0, overs: ballsToOvers(p.ballsBowled), econ: p.econ ?? null,
      });
    }
  }
  return inn.batters.length || inn.bowlers.length ? [inn] : [];
}

/** Rows worth the two page fetches: live ones, plus priced ones within 90 minutes of the start (XIs are out by the toss; Source A's schedule page is cached ~5 min, so a match can be on but still unscored there). */
export function wantsCard(match, now = Date.now()) {
  if (match?.status === "live") return true;
  const t = match?.start ? Date.parse(match.start) : NaN;
  if (match?.status === "final") return Number.isFinite(t) && now - t < keepMsFor(match.fmt); // a finished match keeps its scorecard: the props on it are decided by those numbers
  return match?.status === "upcoming" && Number.isFinite(t) && t - now < 90 * 60e3 && now - t < BOOK_WINDOW_MS;
}

/** Live matches always get a page fetch; finished/upcoming ones fill the remaining slots up to `max`. */
export function cardFetchList(rows, max = 12, now = Date.now()) {
  const rank = { live: 0, upcoming: 1, final: 2 };
  const need = (rows || []).filter((m) => m.url && wantsCard(m, now)).sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
  const live = need.filter((m) => m.status === "live");
  return live.concat(need.filter((m) => m.status !== "live")).slice(0, Math.max(max, live.length));
}

/** Source A format labels ("T20I", "List A", "Youth ODI", "One Day", "First Class", "Multi Day") -> the site's formats. */
export function formatOf(label) {
  const t = String(label || "").toLowerCase();
  if (/\bt10\b/.test(t) || (/\b10[- ]overs?\b/.test(t) && !/t20/.test(t))) return "T10";
  if (t.includes("hundred") || (/\b100\b/.test(t) && /ball/.test(t))) return "Hundred";
  if (/\b60[- ]overs?\b/.test(t)) return "O60";
  if (/\b40[- ]overs?\b/.test(t)) return "O40";
  if (/\bt20/.test(t)) return "T20";
  if (/\bodi\b|list a|one[ -]day|50[- ]over/.test(t)) return "ODI";
  if (/\btest\b|first[ -]class|multi[ -]day/.test(t)) return "Test";
  return "";
}

/** Matches the books actually price: player lines, event markets, or fancy. Unpriced games stay out. */
export function bookFixtures(doc) {
  const seen = new Map();
  for (const l of [...(doc?.events || []), ...(doc?.lines || []), ...(doc?.fancy || [])]) {
    const [a, b] = String(l.match).split(/\s+vs\s+/i);
    if (!b || !l.start_utc) continue;
    const k = `${l.match}|${l.start_utc}`;
    const cur = seen.get(k), fmt = l.fmt || "";
    if (!cur) seen.set(k, { a: teamKey(a), b: teamKey(b), t: Date.parse(l.start_utc), fmt });
    else if (!cur.fmt && fmt) cur.fmt = fmt;
  }
  return [...seen.values()];
}

export function fixtureInBooks(books, fixture) {
  if (!books?.length || !fixture) return false;
  const a = teamKey(fixture.a), b = teamKey(fixture.b), t = fixture.start ? Date.parse(fixture.start) : NaN;
  if (!a || !b) return false;
  return books.some((m) => ((m.a === a && m.b === b) || (m.a === b && m.b === a)) && (!Number.isFinite(t) || Math.abs(m.t - t) < sameMatchWindowFor(fixture.fmt, m.fmt)));
}

/** A comma-separated file with quoted fields (`"a,b"`, `""` for a quote) as one object per row, keyed by the header line. */
export function parseFixtureCsv(text) {
  const rows = [];
  let row = [], cur = "", quoted = false;
  const end = () => { row.push(cur); cur = ""; if (row.length > 1 || row[0]) rows.push(row); row = []; };
  const t = String(text || "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else quoted = false; } else cur += c; }
    else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; end(); }
    else cur += c;
  }
  if (cur || row.length) end();
  const [head = [], ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

/**
 * Priced matches that began in the keep window (24 hours, 6 days for a Test) and are not on the source's schedule page. The page lists live and upcoming games only, so a finished
 * match drops off it soon after the end and its scorecard with it, though the match page itself is still served. A Test at close of play is treated the same way. The rows
 * come from our own schedule file (team names, start and the match page's own path), so that page can still be read and the props on the match settled from the real numbers.
 */
export function unlistedRows(listed, books, schedule, base = "", now = Date.now()) {
  const out = [];
  for (const b of books || []) {
    if (!Number.isFinite(b.t) || b.t > now) continue;
    const there = (listed || []).some((m) => {
      const n = (m.teams || []).map((x) => teamKey(x.name));
      return n.includes(b.a) && n.includes(b.b) && (!m.start || Math.abs(Date.parse(m.start) - b.t) < sameMatchWindowFor(m.fmt, b.fmt));
    });
    if (there) continue;
    const f = (schedule || []).find((r) => r.url && r.start_utc && Math.abs(Date.parse(r.start_utc) - b.t) < sameMatchWindowFor(r.format, b.fmt)
      && ((teamKey(r.team_a) === b.a && teamKey(r.team_b) === b.b) || (teamKey(r.team_a) === b.b && teamKey(r.team_b) === b.a)));
    if (!f || out.some((m) => m.id === f.match_id)) continue;
    if (now - b.t > keepMsFor(f.format || b.fmt)) continue;
    // "Completed" in our file is a guess when it has no result line (a Test that has dropped off the source's page is still being played): only the match page then calls it over
    const result = f.result || "";
    const betweenDays = (f.format === "Test" || f.format === "FC") && f.status === "Completed" && !result;
    const summary = result || (betweenDays ? "Close of play" : "");
    out.push({ id: f.match_id, status: f.status === "Completed" && result ? "final" : "live", fmt: f.format, start: new Date(f.start_utc).toISOString(),
      summary, note: "", session: sessionLabel(summary) || (betweenDays ? "Stumps" : ""),
      url: `${base}${f.url}`, teams: [{ name: f.team_a, abbr: f.team_a }, { name: f.team_b, abbr: f.team_b }], innings: [], players: [] });
  }
  return out;
}

export function pricedLive(matches, books) {
  if (!books?.length) return [];
  return (matches || []).filter((m) => {
    const names = (m.teams || []).map((x) => teamKey(x.name));
    const t = m.start ? Date.parse(m.start) : NaN;
    return books.some((b) => names.includes(b.a) && names.includes(b.b) && (!Number.isFinite(t) || Math.abs(t - b.t) < sameMatchWindowFor(m.fmt, b.fmt)));
  });
}

function unescapeState(s) {
  return String(s || "").replace(/&q;/g, '"').replace(/&a;/g, "&").replace(/&s;/g, "'").replace(/&l;/g, "<").replace(/&g;/g, ">");
}

/** The page's embedded state is keyed by endpoint URL; the host part is not ours to know, so keys are matched by their trailing path. */
export function stateAt(state, suffix) {
  const k = Object.keys(state || {}).find((x) => x.endsWith(suffix));
  return k ? state[k] : undefined;
}

export function pageState(html) {
  const m = String(html || "").match(/<script id="app-root-state"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(unescapeState(m[1])); } catch { return null; }
}

/** Source A writes "119-2"; the site displays "119/2 (17.3 ov)". Toss-time 0/0 (0.0 ov) is not a score. */
function scoreOf(score, overs) {
  const raw = String(score || "").trim().replace(/^(\d+)-(\d+)$/, "$1/$2");
  if (!raw) return parseScore("");
  const ov = String(overs || "").replace(/[^\d.]/g, "");
  const parsed = parseScore(ov ? `${raw} (${ov} ov)` : raw);
  if ((parsed.runs || 0) === 0 && (parsed.wkts || 0) === 0 && !(parsed.overs > 0)) return parseScore("");
  return parsed;
}

function rowScore(row, n) {
  const s = row[`s${n}`] || row[n === 1 ? "team1Score1" : "team2Score1"] || (n === 1 ? row.score1 : row.score2) || "";
  const o = row[`o${n}`] || row[n === 1 ? "team1Over1" : "team2Over1"] || (n === 1 ? row.over1 : row.over2) || "";
  return scoreOf(s, o);
}

/** A side's score on a schedule row: its first innings, and in a multi-day match the second one too ("152 & 112/10 (35.5 ov)"). */
function sideScore(row, n) {
  const first = rowScore(row, n), second = scoreOf(row[`s${n + 2}`], row[`o${n + 2}`]);
  if (!first.display || !second.display) return second.display ? second : first;
  return { ...second, display: `${first.display.replace(/\s*\(.*$/, "").replace(/\/10$/, "")} & ${second.display}` }; // an all-out innings is just its runs
}

function nInt(x) {
  const v = parseInt(String(x ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(v) ? v : 0;
}

function nFloat(x) {
  const s = String(x ?? "").replace(/[^\d.-]/g, "");
  if (!s || s === "-" || s === "." || s === "-.") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** runs / balls × 100, two decimals. 20 off 12 is 166.67. */
export function strikeRate(runs, balls) {
  if (runs == null || balls == null || balls <= 0) return null;
  return Math.round((runs / balls) * 10000) / 100;
}

function overBalls(over) {
  return (over?.overinfo || []).map((x) => String(x || "").trim()).filter(Boolean);
}

/** Source A lastovers as over groups. Delivery-wise; do not flatten across the over break. */
function parseOvers(lastovers) {
  return (lastovers || []).map((o) => ({ balls: overBalls(o) })).filter((o) => o.balls.length);
}

/** Source A schedule page (the schedule page, robots Allow). Every live and upcoming game in one HTML response: URL, format, start, team scores (the page is cached ~5 min). */
export function parseSchedule(html, base = "") {
  const rows = stateAt(pageState(html), "/fixture/getFixture");
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const a = row.team1 || row.t1SName, b = row.team2 || row.t2SName;
    if (!a || !b) return [];
    const t1 = sideScore(row, 1), t2 = sideScore(row, 2);
    const scored = !!t1.display || !!t2.display;
    const fmt = formatOf(row.fo || row.formats);
    const summary = row.result || row.statusText || row.comment1 || "";
    const winner = [row.winningTeam, row.w].some((x) => x != null && x !== "" && x !== -1 && x !== "-1");
    const session = isSessionLine(summary);
    // a finished match: a result line, a winner, or status 2 — except a Test at close of play, or any format on a session break (stumps / rain / paused)
    const done = !!row.result || winner || isResultLine(summary) || (row.status === 2 && !session && fmt !== "Test");
    // `bf` is the side that batted first; once both have a score the other one is in.
    const first = String(row.bf || "") === String(row.t1f || row.team1fkey || "") ? 0 : 1;
    const bat = t1.display && t2.display ? 1 - first : t1.display ? 0 : t2.display ? 1 : -1;
    const link = row.link || "";
    const blurb = summary || (fmt === "Test" && !done && scored && row.status === 2 ? "Close of play" : "");
    return [{
      id: String(row.mf || row.matchFkey || row.id || ""),
      status: done ? "final" : scored ? "live" : "upcoming",
      fmt,
      start: row.t ? new Date(row.t).toISOString() : "",
      summary: blurb,
      note: "",
      url: link.startsWith("/") ? `${base}${link}` : link,
      teams: [
        { name: a, abbr: row.t1SName || a, batting: bat === 0, ...t1 },
        { name: b, abbr: row.t2SName || b, batting: bat === 1, ...t2 },
      ],
      innings: [],
      players: [],
      session: sessionLabel(blurb),
    }];
  });
}

/** Union of the source's home list and schedule page. Same id: prefer live / scored / a session line. */
export function mergeSchedule(a, b) {
  const out = [];
  const ix = new Map();
  const score = (m) => (m?.status === "live" ? 2 : m?.status === "final" ? 1 : 0) + ((m?.teams || []).some((t) => t.display) ? 2 : 0) + (m?.summary ? 1 : 0);
  for (const m of [...(a || []), ...(b || [])]) {
    const k = m?.id || m?.url;
    if (!k) { out.push(m); continue; }
    const i = ix.get(k);
    if (i == null) { ix.set(k, out.length); out.push(m); continue; }
    if (score(m) >= score(out[i])) out[i] = m;
  }
  return out;
}

/** Source A match summary page (`getSV3` in the same app-root-state). Current batters + bowler, not a full card. */
export function parseMatchPage(html) {
  const sv = stateAt(pageState(html), "/v3/getSV3");
  if (!sv || typeof sv !== "object") return null;
  const aName = sv.team1_f_n || sv.rt || sv.team1, bName = sv.team2_f_n || sv.team2;
  if (!aName || !bName) return null;
  const t1 = scoreOf(sv.score1, sv.over1), t2 = scoreOf(sv.score2, sv.over2);
  // team1 / score1 / the two batters are the side batting. `rt` looks like it says so but is empty or the bowling side in some matches.
  const bat = aName, batIsA = true, bowl = bName;
  const strike = Number(sv.os1) === 1 ? 1 : Number(sv.os2) === 1 ? 2 : 0; // os1 / os2: on strike. (`st` is a series-type code, not a batter index)
  const players = [];
  const addBat = (name, runs, balls, fours, sixes, out, onStrike, sr, photo) => {
    if (!name) return;
    const r = nInt(runs), b = nInt(balls);
    players.push({
      id: name, name, team: bat, runs: r, balls: b, fours: nInt(fours), sixes: nInt(sixes),
      sr: nFloat(sr) ?? strikeRate(r, b), wickets: null, conceded: null, ballsBowled: null, out: !!out, strike: !!onStrike,
      photo: photo || "",
    });
  };
  addBat(sv.player_full_name1 || sv.pname1, sv.run1, sv.ball1, sv.four1, sv.six1, false, strike === 1, sv.sr1, sv.b1image);
  addBat(sv.player_full_name2 || sv.pname2, sv.run2, sv.ball2, sv.four2, sv.six2, false, strike === 2, sv.sr2, sv.b2image);
  if (sv.lwname1) addBat(sv.lwname1, sv.lwrun1, sv.lwball1, 0, 0, true, false, null, "");
  if (sv.bowler_full_name || sv.bname) {
    const [wkts, conc] = String(sv.bwr || "").split("-");
    const ballsBowled = oversToBalls(sv.bover) || 0;
    players.push({
      id: sv.bowler_full_name || sv.bname, name: sv.bowler_full_name || sv.bname, team: bowl,
      runs: null, balls: null, fours: null, sixes: null, wickets: nInt(wkts), conceded: nInt(conc),
      ballsBowled, econ: nFloat(sv.beco) ?? (ballsBowled ? Math.round((nInt(conc) / (ballsBowled / 6)) * 100) / 100 : null),
      out: false, current: true, photo: sv.b3image || "",
    });
  }
  const overs = parseOvers(sv.lastovers);
  const thisOver = overs.length ? overs[overs.length - 1].balls : [];
  const inn = batIsA ? t1 : t2;
  const crr = nFloat(sv.crr), rrr = nFloat(sv.rrr);
  const text = (x) => String(x || "").replace(/<[^>]*>/g, "").replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "").replace(/\s+/g, " ").trim();
  // `status` is the schedule's own code (0 not started, 1 in play, 2 finished); `B` is the line the page shows under the score ("Sri Lanka won by 8 wickets")
  // status 2 at stumps / lunch is a session break, not the end of a Test — buildMatch then keeps it live when the row is a Test with no result
  const blurb = text(sv.comment1) || text(sv.B);
  const session = isSessionLine(blurb);
  const done = isResultLine(text(sv.B) || blurb) || (Number(sv.status) === 2 && !session);
  return {
    id: String(sv.mf || ""),
    status: done ? "final" : t1.display || t2.display ? "live" : "upcoming",
    start: "",
    summary: text(sv.comment1) || ((done || session) ? text(sv.B) : ""),
    note: "",
    session: sessionLabel(blurb) || sessionLabel(sv.B),
    url: "",
    teams: [
      { name: aName, abbr: sv.team1short || sv.team1 || "", batting: batIsA, ...t1 },
      { name: bName, abbr: sv.team2short || sv.team2 || "", batting: !batIsA, ...t2 },
    ],
    innings: inn.runs == null ? [] : [{ n: Number(sv.inning) || 1, team: bat, headline: "Batting", fours: nInt(sv.four1) + nInt(sv.four2), sixes: nInt(sv.six1) + nInt(sv.six2), runs: inn.runs, wkts: inn.wkts, overs: inn.overs }],
    players,
    partnership: sv.partnerruns == null && sv.partnerballs == null ? null : { runs: nInt(sv.partnerruns), balls: nInt(sv.partnerballs) },
    crr,
    rrr,
    thisOver,
    overs,
  };
}

/** Source A match-scorecard page (`getSC4` in app-root-state). We fetch the HTML; never `$LIVE_SOURCE_BASE/api`. */
export function cardPageUrl(url) {
  const u = String(url || "").replace(/\/+$/, "");
  if (!u) return "";
  return /match-scorecard/i.test(u) ? u : `${u}/match-scorecard`;
}

const OUT_HOW = { 1: "bowled", 2: "caught", 3: "caught and bowled", 4: "run out", 5: "lbw", 8: "stumped" };

function howOut(code, bowler, fielders) {
  const b = bowler || "", f = (fielders || []).filter(Boolean).join("/");
  if (!code) return "not out";
  if (code === 1) return b ? `b ${b}` : "bowled";
  if (code === 2) return b && f ? `c ${f} b ${b}` : (b ? `c b ${b}` : "caught");
  if (code === 3) return b ? `c & b ${b}` : "caught and bowled";
  if (code === 4) return f ? `run out (${f})` : "run out";
  if (code === 5) return b ? `lbw b ${b}` : "lbw";
  if (code === 8) return b && f ? `st ${f} b ${b}` : (b ? `st b ${b}` : "stumped");
  return OUT_HOW[code] || "out";
}

function idMaps(state) {
  const names = {}, teams = {};
  for (const v of Object.values(state || {})) {
    if (!v || typeof v !== "object") continue;
    for (const p of Array.isArray(v.p) ? v.p : []) {
      if (p && p.f_key && p.n) names[p.f_key] = p.n;
    }
    for (const t of Array.isArray(v.t) ? v.t : []) {
      if (t && t.f_key && t.n) teams[t.f_key] = t.n;
    }
  }
  return { names, teams };
}

function cardBatter(row, names, team) {
  const f = String(row || "").split("/")[0].split(".");
  const id = f[0], name = names[id] || id;
  if (f.length < 5) return { id, name, team, dnb: true };
  const runs = nInt(f[1]), balls = nInt(f[2]), fours = nInt(f[3]), sixes = nInt(f[4]);
  const code = f.length >= 8 ? nInt(f[7]) : 0;
  const rest = f.slice(8).filter(Boolean);
  let bowler = "", fielders = [];
  if (code === 4) fielders = rest;
  else if (code === 2 || code === 8) { bowler = rest[0] || ""; fielders = rest.slice(1, 2); }
  else bowler = rest[0] || "";
  const bowlerName = names[bowler] || bowler, fielderNames = fielders.map((x) => names[x] || x);
  return {
    id, name, team, runs, balls, fours, sixes, sr: strikeRate(runs, balls), out: !!code,
    dismissal: howOut(code, bowlerName, fielderNames),
    how: code, bowlerId: bowler, fielderIds: fielders,
    fowRuns: f.length > 5 ? nInt(f[5]) : null, fowBalls: f.length > 6 ? nInt(f[6]) : null,
  };
}

/** Catches and stumpings from how-out, keyed by the source's player id. A caught-and-bowled is the bowler's catch. */
function fieldingFromCard(inns) {
  const byId = new Map(), teamOf = new Map();
  const add = (id, key, team) => {
    if (!id) return;
    const cur = byId.get(id) || { catches: 0, stumpings: 0 };
    cur[key] += 1;
    byId.set(id, cur);
    if (team && !teamOf.has(id)) teamOf.set(id, team);
  };
  for (const inn of inns || []) {
    const bowlTeam = inn.bowlers?.[0]?.team || "";
    for (const p of inn.batters || []) {
      if (p.how === 2) add(p.fielderIds?.[0], "catches", bowlTeam);
      else if (p.how === 3) add(p.bowlerId, "catches", bowlTeam);
      else if (p.how === 8) add(p.fielderIds?.[0], "stumpings", bowlTeam);
    }
  }
  return { byId, teamOf };
}

function cardBowler(row, names, team) {
  const f = String(row || "").split("/")[0].split(".");
  const id = f[0], conceded = nInt(f[1]), ballsBowled = nInt(f[2]), maidens = nInt(f[3]), wickets = nInt(f[4]);
  return {
    id, name: names[id] || id, team, conceded, ballsBowled, maidens, wickets,
    overs: ballsToOvers(ballsBowled), econ: ballsBowled ? Math.round((conceded / (ballsBowled / 6)) * 100) / 100 : null,
  };
}

/** Full Source A scorecard: batting (how-out, R, B, 4s, 6s, SR), extras, FOW, yet-to-bat, bowling (O, M, R, W, Econ). */
export function parseCardPage(html) {
  const state = pageState(html);
  const rows = stateAt(state, "/v3/getSC4");
  if (!Array.isArray(rows) || !rows.length) return null;
  const { names, teams } = idMaps(state);
  const teamName = (id) => teams[id] || id || "";
  const ids = rows.map((r) => r.c).filter(Boolean);
  const otherId = (id) => ids.find((x) => x !== id) || Object.keys(teams).find((x) => x !== id) || "";
  const card = rows.map((row, i) => {
    const batId = row.c || "", bowlId = otherId(batId);
    const batTeam = teamName(batId), bowlTeam = teamName(bowlId);
    const tot = String(row.d || "").match(/^(\d+)\/(\d+)\((\d+)/);
    const balls = tot ? +tot[3] : null;
    const batters = [], yetToBat = [], fow = [], xi = []; // xi: the side's eleven as the source lists them, with the source's own player ids
    for (const raw of row.b || []) {
      const p = cardBatter(raw, names, batTeam);
      if (p.dnb) { if (names[p.id]) { yetToBat.push(p.name); xi.push({ id: p.id, name: p.name }); } continue; }
      batters.push(p);
      xi.push({ id: p.id, name: p.name });
      if (p.out && p.fowRuns != null) fow.push({ name: p.name, runs: p.fowRuns, balls: p.fowBalls, wkts: fow.length + 1 });
    }
    fow.sort((x, y) => x.runs - y.runs || (x.balls ?? 0) - (y.balls ?? 0)).forEach((w, k) => { w.wkts = k + 1; }); // the card lists batters in order, wickets fell in another
    const extras = extrasOf(String(row.e || "").split("."));
    return {
      n: i + 1, team: batTeam, batters, bowlers: (row.a || []).map((raw) => cardBowler(raw, names, bowlTeam)),
      yetToBat, xi, fow, extras, runs: tot ? +tot[1] : null, wkts: tot ? +tot[2] : null, overs: balls != null ? ballsToOvers(balls) : null,
    };
  });
  const shown = card.filter((i) => i.batters.length || i.bowlers.length || i.runs != null || i.yetToBat.length); // before the first ball a card is the batting XI, all yet to bat
  const { byId: field, teamOf } = fieldingFromCard(shown);
  const credit = (id) => field.get(id) || { catches: 0, stumpings: 0 };
  const players = [];
  for (const inn of shown) {
    for (const p of inn.batters) players.push({ id: p.id, name: p.name, team: p.team, runs: p.runs, balls: p.balls, fours: p.fours, sixes: p.sixes, sr: p.sr, wickets: null, conceded: null, ballsBowled: null, out: p.out, dismissal: p.dismissal, ...credit(p.id) });
    for (const p of inn.bowlers) players.push({ id: p.id, name: p.name, team: p.team, runs: null, balls: null, fours: null, sixes: null, wickets: p.wickets, conceded: p.conceded, ballsBowled: p.ballsBowled, maidens: p.maidens, econ: p.econ, out: false, ...credit(p.id) });
  }
  const seen = new Set(players.map((p) => p.id).filter(Boolean));
  for (const [id, f] of field) {
    if (!id || seen.has(id) || !names[id]) continue;
    players.push({ id, name: names[id], team: teamOf.get(id) || "", runs: null, balls: null, fours: null, sixes: null, wickets: null, conceded: null, ballsBowled: null, out: false, ...f });
  }
  const teamList = [...new Set(card.map((i) => i.team).filter(Boolean))];
  for (const n of Object.values(teams)) if (n && !teamList.includes(n)) teamList.push(n);
  return {
    id: "", status: "live", start: "", summary: "", note: "", url: "",
    teams: teamList.slice(0, 2).map((name) => ({ name, abbr: name, batting: false, display: "", runs: null, wkts: null, overs: null })),
    innings: shown.filter((i) => i.runs != null).map((i) => ({ n: i.n, team: i.team, headline: "Batting", fours: i.batters.reduce((a, p) => a + (p.fours || 0), 0), sixes: i.batters.reduce((a, p) => a + (p.sixes || 0), 0), runs: i.runs, wkts: i.wkts, overs: i.overs })),
    players, card: shown,
  };
}

/** Not-out batters and the current bowler from the match page, copied onto the scorecard rows (strike, current bowler, photo, the page's fresher numbers). Rows the card lacks are appended. */
function flagLive(players, flags) {
  const out = players.map((p) => ({ ...p }));
  for (const f of flags) {
    if (f.out) continue; // dismissed batters are already in the card in full
    const bat = f.runs != null;
    const hit = out.find((p) => (bat ? p.runs != null && !p.out : p.wickets != null) && namesMatch(p.name, f.name));
    if (hit) Object.assign(hit, { ...f, id: hit.id, team: hit.team, maidens: hit.maidens ?? f.maidens, catches: hit.catches, stumpings: hit.stumpings });
    else if (!(bat && out.some((p) => p.runs != null && p.out && namesMatch(p.name, f.name)))) out.push(f); // the card has him out: trust it
  }
  return out;
}

/**
 * One live row from the three Source A pages. `row` is the schedule entry (id, URL, format, start; scores up to ~5 min old), `live` the match page
 * (fresh scores, current pair, partnership, run rates), `card` the scorecard (every innings). Either page may be null: the row then keeps what it has.
 */
export function buildMatch(row, live, card) {
  const same = (a, b) => teamKey(a.name) === teamKey(b.name) || (!!a.abbr && teamKey(a.abbr) === teamKey(b.abbr));
  const teams = (row.teams || []).map((t) => {
    const o = (live?.teams || []).find((x) => same(x, t));
    if (!o) return t;
    return { ...t, ...(o.display ? { display: o.display, runs: o.runs, wkts: o.wkts, overs: o.overs } : {}), batting: o.batting };
  });
  const innings = [...(card?.innings || [])];
  for (const i of live?.innings || []) if (!innings.some((x) => teamKey(x.team) === teamKey(i.team))) innings.push(i); // a scorecard page cached a beat behind
  const cardPlayers = card?.players || [];
  // Pages give a side one innings; a side that has batted twice, or batted with no score shown, gets its line from the card ("152 & 112/10 (35.5 ov)")
  const ovText = (o) => (o == null ? "" : ` (${Number.isInteger(o) ? o.toFixed(1) : o} ov)`);
  const lined = teams.map((t) => {
    const mine = (card?.innings || []).filter((i) => teamKey(i.team) === teamKey(t.name) && i.runs != null);
    if (!mine.length || (mine.length === 1 && (t.display || !mine[0].runs))) return t;
    const last = mine[mine.length - 1];
    const display = [...mine.slice(0, -1).map((i) => (i.wkts != null && i.wkts < 10 ? `${i.runs}/${i.wkts}` : `${i.runs}`)), `${last.runs}${last.wkts != null ? `/${last.wkts}` : ""}${ovText(last.overs)}`].join(" & ");
    return { ...t, display, runs: last.runs, wkts: last.wkts, overs: last.overs };
  });
  const scored = lined.some((t) => t.display);
  const session = isSessionLine(live?.summary) || isSessionLine(row.summary);
  const over = isResultLine(live?.summary) || isResultLine(row.summary) || ((row.status === "final" || live?.status === "final") && row.fmt !== "Test" && !session);
  const status = over ? "final" : scored ? "live" : "upcoming";
  const rawLive = String(live?.summary || "").trim();
  const rawRow = String(row.summary || "").trim();
  const raw = rawLive && !/^live$/i.test(rawLive) ? rawLive : rawRow;
  const summary = raw && !/^live$/i.test(raw) ? raw
    : (status === "live" && row.fmt === "Test" && (live?.status === "final" || row.status === "final") ? "Close of play" : raw);
  const badge = sessionLabel(rawLive) || sessionLabel(rawRow) || (status === "live" && row.fmt === "Test" && (live?.status === "final" || row.status === "final" || /close of play/i.test(summary)) ? "Stumps" : "");
  return {
    ...row,
    status,
    summary,
    session: badge,
    teams: lined,
    innings,
    players: cardPlayers.length ? flagLive(cardPlayers, live?.players || []) : (live?.players || []),
    card: card?.card || [],
    partnership: live?.partnership ?? null,
    crr: live?.crr ?? null,
    rrr: live?.rrr ?? null,
    thisOver: live?.thisOver || [],
    overs: live?.overs || [],
  };
}

export function liveForFixture(doc, fixture) {
  const matches = doc?.matches || [];
  const a = teamKey(fixture?.a), b = teamKey(fixture?.b);
  if (!a || !b) return null;
  const t = fixture?.start ? Date.parse(fixture.start) : NaN;
  let fallback = null;
  for (const m of matches) {
    const names = (m.teams || []).map((x) => teamKey(x.name));
    if (!(names.includes(a) && names.includes(b))) continue;
    if (!Number.isFinite(t) || !m.start) { if (m.status === "live") return m; fallback = fallback || m; continue; }
    if (Math.abs(Date.parse(m.start) - t) < sameMatchWindowFor(fixture.fmt, m.fmt)) return m;
    if (m.status === "live") fallback = fallback || m;
  }
  return fallback;
}

export function teamScore(match, teamName) {
  const k = teamKey(teamName);
  return (match?.teams || []).find((t) => teamKey(t.name) === k || teamKey(t.abbr) === k) || null;
}

/** What the card prints for a side: one innings as runs/wkts, a Test as "152 & 112". Overs stay a separate span. */
export function scoreLabel(s) {
  if (!s?.display) return "";
  const innings = String(s.display).replace(/\s*\(.*$/, "").replace(/\s*,\s*target.*$/i, "").trim();
  if (/&/.test(innings)) return innings;
  if (s.runs != null && s.wkts != null) return `${s.runs}/${s.wkts}`;
  if (s.runs != null) return String(s.runs);
  return innings;
}

/** The status line Source A gives: "IND need 179 runs in 115 balls", "OMA opt to Bowl", "Stumps - Day 3". Bare "Live" says nothing the badge doesn't. */
export function liveBlurb(match) {
  for (const x of [match?.summary, match?.note]) {
    const t = String(x || "").trim();
    if (t && !/^live$/i.test(t)) return t;
  }
  return "";
}

const BAT_STATS = new Set(["runs", "balls", "fours", "sixes"]);
const BOWL_STATS = new Set(["wickets", "runs_conceded", "balls_bowled"]);

const nameSet = (x) => [].concat(x || []).map(norm).filter(Boolean);

/** Same person: one source id, or the same name on the same side (a bat row and a bowl row; the match page may have used the name as id). */
function onePerson(rows) {
  if (rows.length <= 1) return rows;
  const ids = [...new Set(rows.map((p) => p.id).filter(Boolean))];
  if (ids.length === 1) return rows;
  return [...new Set(rows.map((p) => `${norm(p.name)}|${teamKey(p.team || "")}`))].length === 1 ? rows : [];
}

/** Sum batting and bowling; fielding is already the match total copied onto each role row, so it is taken once. */
function mergePointsRows(rows) {
  const out = { name: rows[0].name, team: rows[0].team, id: rows[0].id || "", out: false, catches: null, stumpings: null };
  for (const p of rows) {
    if (p.id) out.id = p.id;
    if (p.team) out.team = p.team;
    if (p.runs != null) {
      out.runs = (out.runs || 0) + p.runs;
      out.balls = (out.balls || 0) + (p.balls || 0);
      out.fours = (out.fours || 0) + (p.fours || 0);
      out.sixes = (out.sixes || 0) + (p.sixes || 0);
      if (p.out) out.out = true;
    }
    if (p.wickets != null) {
      out.wickets = (out.wickets || 0) + p.wickets;
      out.conceded = (out.conceded || 0) + (p.conceded || 0);
      out.ballsBowled = (out.ballsBowled || 0) + (p.ballsBowled || 0);
    }
    if (p.catches != null) out.catches = p.catches;
    if (p.stumpings != null) out.stumpings = p.stumpings;
  }
  return out;
}

function takeRows(rows, stat) {
  if (rows.length === 1) return rows[0];
  if (stat === "points") {
    const same = onePerson(rows);
    return same.length ? mergePointsRows(same) : null;
  }
  return null;
}

/**
 * The player's row for this stat: a scorecard has one row per role, so an all-rounder's batting and bowling rows are told apart by the stat.
 * Points merge those rows (runs + wickets + fielding). With the source's own id for him (`sourceId`, from the identity table) the row is found by that id and no name is consulted. Otherwise names decide, and a row that
 * belongs to a different player the table knows (`isLinked(row id)`, only asked once he is linked himself) is never taken for him. Ambiguous names stay unmatched.
 * @param {string | string[]} [commonName] the name(s) the books use for him
 * @param {((sourceId: string) => boolean) | null} [isLinked]
 */
export function livePlayer(match, name, stat, commonName = "", sourceId = "", isLinked = null) {
  const role = BAT_STATS.has(stat) ? "runs" : BOWL_STATS.has(stat) ? "wickets" : null;
  let rows = (match?.players || []).filter((p) => !role || p[role] != null);
  if (sourceId) {
    const byId = rows.filter((p) => p.id === sourceId);
    if (byId.length) {
      // Points need both roles. The match page sometimes stamps the printed name as id on the other row, so pull that in too.
      if (stat === "points") {
        const names = new Set(byId.map((p) => norm(p.name)));
        const team = teamKey(byId[0].team || "");
        const extra = rows.filter((p) => names.has(norm(p.name)) && teamKey(p.team || "") === team);
        return takeRows(extra.length ? extra : byId, stat);
      }
      return takeRows(byId, stat); // two rows with his id: a Test's two innings, or bat + bowl
    }
    if (isLinked) rows = rows.filter((p) => !isLinked(p.id));
  }
  // The books call a player what the live source calls him ("Kusal Mendis"); the data has initials ("BKG Mendis"), and "K" would match every Mendis with a K.
  // So the books' own name (the line's, else the identity table's), when there is one, is tried first and exactly.
  const books = nameSet(commonName);
  const exact = books.length ? rows.filter((p) => books.includes(norm(p.name))) : [];
  if (exact.length) return takeRows(exact, stat);
  const hits = rows.filter((p) => namesMatch(p.name, name));
  return takeRows(hits, stat);
}

function withSr(p) {
  if (!p || p.sr != null) return p;
  const sr = strikeRate(p.runs, p.balls);
  return sr == null ? p : { ...p, sr };
}

function withEcon(p) {
  if (!p || p.econ != null || !p.ballsBowled) return p;
  return { ...p, econ: Math.round((p.conceded / (p.ballsBowled / 6)) * 100) / 100 };
}

/** Compact scoreboard: the batting side's not-out pair, last wicket, current bowler. A finished innings' not-out batters never show as the pair. */
export function liveBoard(match) {
  const players = match?.players || [];
  if (!players.length) return null;
  const bat = (match.teams || []).find((t) => t.batting);
  const onBat = (team) => !bat || teamKey(team) === teamKey(bat.name) || (!!bat.abbr && teamKey(team) === teamKey(bat.abbr));
  const raw = players.filter((p) => p.runs != null && !p.out && onBat(p.team)).map(withSr);
  const strike = raw.find((p) => p.strike);
  const batters = strike ? [strike, ...raw.filter((p) => p !== strike)] : raw;
  const outs = players.filter((p) => p.out && p.runs != null && onBat(p.team)).map(withSr);
  const falls = [...(match.card || [])].reverse().find((i) => i.fow?.length && onBat(i.team))?.fow || [];
  const last = falls.length ? falls[falls.length - 1] : null; // fall of wickets is chronological; the batters list is in batting order
  const lastWicket = (last && outs.find((p) => namesMatch(p.name, last.name))) || (outs.length ? outs[outs.length - 1] : null);
  const bowling = players.filter((p) => p.wickets != null || p.conceded != null);
  const bowler = withEcon(bowling.find((p) => p.current) || (bowling.length === 1 ? bowling[0] : null));
  if (!batters.length && !outs.length && !bowler) return null;
  const pr = match.partnership;
  const overs = Array.isArray(match.overs) && match.overs.length
    ? match.overs
    : (Array.isArray(match.thisOver) && match.thisOver.length ? [{ balls: match.thisOver }] : []);
  return {
    batters,
    lastWicket,
    bowler,
    partnership: pr && (pr.runs != null || pr.balls != null) ? pr : null,
    crr: Number.isFinite(match.crr) ? match.crr : null,
    rrr: Number.isFinite(match.rrr) ? match.rrr : null,
    thisOver: Array.isArray(match.thisOver) ? match.thisOver : [],
    overs,
  };
}

const STAT_FIELD = { runs: "runs", balls: "balls", fours: "fours", sixes: "sixes", wickets: "wickets", runs_conceded: "conceded", balls_bowled: "ballsBowled" };

/** Live so-far for a priced line. Points = runs + 20×wickets + 10×catches + 25×stumpings; a missing credit is 0 so far (the total can still rise). */
export function liveStat(player, stat) {
  if (!player) return null;
  if (stat === "points") {
    const r = player.runs, w = player.wickets, ct = player.catches, st = player.stumpings;
    if (r == null && w == null && !ct && !st) return null;
    return (r || 0) + 20 * (w || 0) + 10 * (ct || 0) + 25 * (st || 0);
  }
  const k = STAT_FIELD[stat];
  if (!k || player[k] == null) return null;
  return player[k];
}

const MAX_OVERS = { T20: 20, ODI: 50, T10: 10, O60: 60 };
const SPELL_BALLS = { T20: 24, ODI: 60, T10: 12, O60: 72 };

/** Has this side's innings ended? All out, its overs used, the other side now batting, or the match over. */
function inningsOver(match, team) {
  if (match?.status === "final") return true;
  const inns = match?.innings || [];
  const mine = [...inns].reverse().find((i) => teamKey(i.team) === teamKey(team));
  if (!mine) return false;
  const max = MAX_OVERS[match.fmt];
  return mine.wkts === 10 || (max != null && mine.overs != null && mine.overs >= max) || inns.some((i) => i.n > mine.n);
}

/**
 * Can this so-far number still move? "out": the batter is dismissed; "final": the innings or the spell is over (batter not out when it ended, bowler's quota used
 * or the batting side finished); "live": it can still change. One innings a side only, so Tests stay "live" until the match ends.
 */
export function liveState(match, player, stat) {
  if (!match || !player) return "live";
  if (match.status === "final") return "final";
  if (!["T20", "ODI", "Hundred", "T10", "O60"].includes(match.fmt)) return "live";
  if (BAT_STATS.has(stat)) return player.out ? "out" : inningsOver(match, player.team) ? "final" : "live";
  if (BOWL_STATS.has(stat)) {
    const quota = SPELL_BALLS[match.fmt];
    const opp = (match.teams || []).find((t) => teamKey(t.name) !== teamKey(player.team))?.name;
    return (quota != null && (player.ballsBowled || 0) >= quota) || (opp && inningsOver(match, opp)) ? "final" : "live";
  }
  return "live";
}

/**
 * What a so-far number already says about an over line. Counts only go up, so passing the line is final the moment it happens: "cleared". A miss (or a push on
 * a whole-number line) is only known once the count can no longer move (`state` "out" or "final"). Otherwise null: still to play for.
 */
export function lineVerdict(value, line, state = "live") {
  if (value == null || line == null) return null;
  if (value > line) return "cleared";
  if (state === "live") return null;
  return value < line ? "missed" : "push";
}

/**
 * A Test batter's innings of his own side's `inn`-th turn (1 = first, 2 = second) off the card, as `{p, state}` (his row in it, and "live" / "out" / "final") or null when the side has not had that turn or he did
 * not bat in it. The card lists the match's innings in batting order, so the side's turns are the entries with its name. The innings is over, and what he made in it
 * cannot move, once the side's next one (or the other side's) has begun or the match is over; before that it is "out" when he is dismissed and "live" when he is not.
 */
function inningsRow(match, l, idn, books, sid) {
  const card = match?.card || [];
  const turn = card.filter((i) => teamKey(i.team) === teamKey(l.team))[l.inn - 1];
  if (!turn) return null;
  const p = livePlayer({ players: (turn.batters || []).map((b) => ({ ...b, team: turn.team })) }, l.player, l.stat, books, sid, idn.isLinked);
  if (!p) return null;
  const over = match.status === "final" || card.some((i) => i.n > turn.n);
  return { p, state: over ? "final" : p.out ? "out" : "live" };
}

/** One priced line read off the match's card, by the player's id through the identity table (names only for a player it does not know): `{value, state, verdict}`; a player the named XI rules out is `{value: null, notInXI: true}`; null when he has no row (he may not have batted yet). `l`: {pid, player, book_name, team, stat, line, inn?}; with `inn` it is the Test innings's own number. */
function readLine(match, l, idn) {
  const sid = idn.sourceOf(l.pid), books = [l.book_name, ...idn.bookNames(l.pid)].filter(Boolean);
  const got = l.inn ? inningsRow(match, l, idn, books, sid) : null;
  const p = l.inn ? got?.p : livePlayer(match, l.player, l.stat, books, sid, idn.isLinked), value = liveStat(p, l.stat);
  if (value != null) { const state = l.inn ? got.state : liveState(match, p, l.stat); return { value, state, verdict: lineVerdict(value, l.line, state) }; }
  return notInXI(match, l.player, l.team, sid, books) ? { value: null, state: "live", verdict: null, notInXI: true } : null;
}

/**
 * Where every line the books priced for this match stands, settled on the server so the browser does no name matching of its own: one entry per priced line,
 * `{pid, stat, line, value, state, verdict}` with `state` and `verdict` as `liveState` and `lineVerdict` give them (and `inn` on a Test's first- or second-innings line, whose
 * value is what he made in that innings of his side's, not the match total). A player the match's XI rules out is
 * `{notInXI: true, value: null}`: the bet is void, nothing was counted. A line whose player has no row yet has no entry. `lines` are the book file's player lines;
 * the match is the one with the same two sides and a start within 14 hours (6 days for a Test). Still "so far" while the match is on: only `state: "final"` in a `status: "final"`
 * match is a result (a Test's innings line is one as soon as that innings is over).
 */
export function settleLines(match, lines, idn = NO_IDENTITY) {
  const sides = new Set((match?.teams || []).map((t) => teamKey(t.name)));
  const t = match?.start ? Date.parse(match.start) : NaN;
  const out = [];
  if (sides.size !== 2) return out;
  for (const l of lines || []) {
    const [a, b] = String(l.match).split(/\s+vs\s+/i);
    if (!b || !l.pid || !sides.has(teamKey(a)) || !sides.has(teamKey(b))) continue;
    if (Number.isFinite(t) && l.start_utc && Math.abs(Date.parse(l.start_utc) - t) >= sameMatchWindowFor(match?.fmt, l.fmt)) continue;
    const got = readLine(match, l, idn);
    if (got) out.push({ pid: l.pid, stat: l.stat, line: l.line, ...(l.inn ? { inn: l.inn } : {}), ...got });
  }
  return out;
}

const settledEntry = (match, l) => (match?.lines || []).find((x) => x.pid === l.pid && x.stat === l.stat && x.line === l.line && (x.inn || 0) === (l.inn || 0));

/**
 * What the page shows for a priced line, `{v, state, verdict}` or null. In order: the server's settled entry on the live match (`match.lines`); the result stored in the
 * match's archive file (`stored`); the browser's own reading of the card, kept for a live body from before the server settled lines and for a player it could not place;
 * and the player's game as the data records it (`settled`).
 * @param {{pid: string, player: string, book_name?: string, team?: string, stat: string, line: number}} l
 * @param {{stored?: number | null, settled?: number | null}} [known] `stored`: the archive file's result for him; `settled`: his game as the data records it
 */
export function lineStanding(match, l, idn = NO_IDENTITY, known = {}) {
  const { stored = null, settled = null } = known;
  const s = settledEntry(match, l);
  if (s?.value != null) return { v: s.value, state: s.state, verdict: s.verdict ?? null };
  const done = (v) => ({ v, state: "final", verdict: lineVerdict(v, l.line, "final") });
  if (stored != null) return done(stored);
  const own = readLine(match, l, idn);
  if (own?.value != null) return { v: own.value, state: own.state, verdict: own.verdict };
  return settled != null ? done(settled) : null;
}

/** Is the line's player ruled out of the XI? The server's word when it settled him; otherwise the browser's own reading of the card. */
export function lineNotIn(match, l, idn = NO_IDENTITY) {
  const s = settledEntry(match, l);
  if (s) return !!s.notInXI;
  return notInXI(match, l.player, l.team, idn.sourceOf(l.pid), [l.book_name, ...idn.bookNames(l.pid)].filter(Boolean));
}

/** So-far for a fancy market. `inn` 1 or 2 is that side's own first or second innings (a Test); 0 sums every innings they have batted. */
export function liveMarket(match, key, team, inn = 0) {
  if (!match) return null;
  const all = match.innings || [];
  const src = team ? all.filter((i) => teamKey(i.team) === teamKey(team)) : all;
  const rows = inn > 0 ? src.slice(inn - 1, inn) : src;
  if (!rows.length && !["top_score"].includes(key)) return null;
  const sum = (k) => rows.reduce((a, i) => a + (i[k] || 0), 0);
  if (key === "match_runs" || key === "team_total_runs") return sum("runs");
  if (key === "first_innings_runs") return (team ? src : all).find((i) => i.n === 1)?.runs ?? null;
  if (key === "match_sixes" || key === "team_total_sixes") return sum("sixes");
  if (key === "match_fours" || key === "team_total_fours") return sum("fours");
  if (key === "match_boundaries" || key === "team_total_boundaries") return sum("fours") + sum("sixes");
  if (key === "match_wickets" || key === "team_total_wickets") return sum("wkts");
  if (key === "top_score") {
    const xs = (match.players || []).map((p) => p.runs).filter((x) => x != null);
    return xs.length ? Math.max(...xs) : null;
  }
  if (key === "match_50s") return (match.players || []).filter((p) => (p.runs || 0) >= 50 && (p.runs || 0) < 100).length;
  if (key === "match_30s") return (match.players || []).filter((p) => (p.runs || 0) >= 30 && (p.runs || 0) < 50).length;
  return null;
}

/**
 * Can this fancy so-far still move? A side's own 1st/2nd innings is final once that turn is over (the other side has begun, they are all out, or the overs are used);
 * a limited-overs team total is final with that innings; a Test match total and a whole-match market stay live until the match ends.
 */
export function fancyState(match, { key, team, inn = 0 } = {}) {
  if (!match) return "live";
  if (match.status === "final") return "final";
  const inns = match.innings || [];
  if (inn > 0 && team) {
    const src = inns.filter((i) => teamKey(i.team) === teamKey(team));
    const row = src[inn - 1];
    if (!row) return "live";
    if (src.length > inn || inns.some((i) => i.n > row.n)) return "final";
    const max = MAX_OVERS[match.fmt];
    if (row.wkts === 10 || (max != null && row.overs != null && row.overs >= max)) return "final";
    return "live";
  }
  if (key === "first_innings_runs") {
    const first = inns.find((i) => i.n === 1);
    if (!first) return "live";
    const max = MAX_OVERS[match.fmt];
    if (inns.some((i) => i.n > 1) || first.wkts === 10 || (max != null && first.overs != null && first.overs >= max)) return "final";
    return "live";
  }
  if (team && String(key || "").startsWith("team_total_")) {
    if (!MAX_OVERS[match.fmt]) return "live";
    return inningsOver(match, team) ? "final" : "live";
  }
  return "live";
}

/**
 * Where a fancy market stands on the live snapshot, `{v, state, verdict}` or null: the same shape `lineStanding` gives a player prop, from the innings totals
 * (`liveMarket`) and `lineVerdict`. Overlay this at view time from the 15 s poll; do not bake it into the scored history.
 */
export function fancyStanding(match, row) {
  if (!match || !row?.key) return null;
  const v = liveMarket(match, row.key, row.team, row.inn || 0);
  if (v == null) return null;
  const state = fancyState(match, row);
  return { v, state, verdict: lineVerdict(v, row.line, state) };
}

/**
 * Each side's XI as far as the card shows it: the batters and yet-to-bat of an innings the side has batted in (the card lists all eleven, even before the first
 * ball). `complete` once eleven names are there. A side that has not batted yet is not known, so nobody on it is called out of the XI.
 */
export function playingXI(match) {
  const out = new Map();
  for (const inn of match?.card || []) {
    const list = inn.xi?.length ? inn.xi : [...(inn.batters || []).map((p) => ({ id: p.id, name: p.name })), ...(inn.yetToBat || []).map((n) => ({ id: "", name: n }))];
    const k = teamKey(inn.team);
    if (list.length && (!out.has(k) || list.length > out.get(k).names.length)) out.set(k, { names: list.map((x) => x.name), ids: new Set(list.map((x) => x.id).filter(Boolean)), complete: list.length >= 11 });
  }
  return out;
}

const surname = (n) => norm(n).split(" ").filter(Boolean).pop() || "";

/**
 * True only when the side's XI is fully known and the player is not in it. With the source's own id for the player the answer is exact. Without one it goes by name,
 * and a name is not enough to say "not in": the source gives the common name ("Kusal Mendis") where the data has initials ("BKG Mendis"), so anyone in the XI
 * who shares his surname might be him, and he is left unmarked. (Better a missed mark than a wrong one.)
 * @param {string | string[]} [commonName] the name(s) the books use for him
 */
export function notInXI(match, name, team, sourceId = "", commonName = "") {
  const xi = playingXI(match).get(teamKey(team));
  if (!xi?.complete) return false;
  if (sourceId && xi.ids.size) return !xi.ids.has(sourceId);
  if (nameSet(commonName).some((c) => xi.names.some((n) => norm(n) === c))) return false;
  if (xi.names.some((n) => namesMatch(n, name))) return false;
  const sur = surname(name);
  return !xi.names.some((n) => surname(n) === sur);
}
