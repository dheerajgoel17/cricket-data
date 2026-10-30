// Live score snapshots from ESPN's public cricket JSON (header + match summary).
// Pure: no fetch, no DOM. Numbers here are "so far", never settlement — VOID rules still apply after the innings qualifies.
import { norm, surnamesEq } from "./util.js";

export const LIVE_TTL_MS = 15_000;
const WINDOW_MS = 36 * 3600e3;
export const BOOK_WINDOW_MS = 14 * 3600e3;

export function teamKey(n) {
  return String(n || "")
    .toLowerCase()
    .replace(/\(w\)|women'?s?/g, "")
    .replace(/under-?19s?/g, "u19")
    .replace(/[^a-z0-9]/g, "");
}

/** "HC Brook" / "Harry Brook" / "harry brook" — last name plus first initial. Ambiguous surnames stay unmatched. */
export function namesMatch(a, b) {
  const ta = norm(a).split(" ").filter(Boolean), tb = norm(b).split(" ").filter(Boolean);
  if (!ta.length || !tb.length) return false;
  if (ta.join(" ") === tb.join(" ")) return true;
  if (ta[ta.length - 1] !== tb[tb.length - 1] && !surnamesEq(ta[ta.length - 1], tb[tb.length - 1])) return false;
  const init = (toks) => toks.slice(0, -1).map((t) => t[0]).join("");
  const ia = init(ta), ib = init(tb);
  if (!ia || !ib) return (ta[0][0] || "") === (tb[0][0] || "");
  return ia[0] === ib[0];
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

/** ESPN competitor.score: "145/4 (16.2 ov)", "113 & 516", "187/9 (65 ov, target 313)". */
export function parseScore(s) {
  const display = String(s || "").trim();
  if (!display) return { display: "", runs: null, wkts: null, overs: null };
  const last = display.split("&").pop().trim();
  const m = last.match(/^(\d+)(?:\/(\d+))?(?:\s*\(([\d.]+)\s*ov)?/);
  if (!m) return { display, runs: null, wkts: null, overs: null };
  return { display, runs: +m[1], wkts: m[2] != null ? +m[2] : null, overs: m[3] != null ? +m[3] : null };
}

function fmtOf(ev, cls = {}) {
  const t = `${ev?.eventType || ""} ${cls.eventType || ""} ${cls.generalClassCard || ""} ${cls.name || ""}`.toLowerCase();
  if (/\bt10\b/.test(t) || (/\b10[- ]overs?\b/.test(t) && !/t20/.test(t))) return "T10";
  if ((/\b100\b/.test(t) && /ball|hundred/.test(t)) || /\bthe hundred\b/.test(t)) return "Hundred";
  if (/\b60[- ]overs?\b/.test(t)) return "O60";
  if (/\b40[- ]overs?\b/.test(t)) return "O40";
  if (/\bt20\b/.test(t)) return "T20";
  if (/\bodi\b/.test(t) || t.includes("list a") || t.includes("one-day") || t.includes("one day") || /\b50[- ]over/.test(t)) return "ODI";
  if (t.includes("first-class") || t.includes("first class") || /\btest\b/.test(t)) return "Test";
  return "";
}

function stateOf(ev) {
  const st = ev?.fullStatus?.type?.state || ev?.status || "";
  if (st === "in") return "live";
  if (st === "post") return "final";
  return "upcoming";
}

function parseTotal(total, runs) {
  const t = String(total || "");
  const wkts = /\((\d+)\s*wkts?/.exec(t);
  const ovs = /(\d+(?:\.\d+)?)\s*ovs?/.exec(t);
  const r = runs === "" || runs == null ? null : Number(runs);
  return { runs: Number.isFinite(r) ? r : null, wkts: wkts ? +wkts[1] : null, overs: ovs ? +ovs[1] : null };
}

export function parseHeader(doc) {
  const out = [];
  for (const sport of doc?.sports || []) {
    for (const lg of sport.leagues || []) {
      for (const ev of lg.events || []) {
        const cls = ev.class || {};
        const fs = ev.fullStatus || {};
        const teams = (ev.competitors || []).map((c) => {
          const sc = parseScore(c.score);
          return { name: c.displayName || c.name || "", abbr: c.abbreviation || c.name || "", batting: fs.battingTeamId != null && String(fs.battingTeamId) === String(c.id), ...sc };
        });
        if (teams.length < 2) continue;
        out.push({
          id: String(ev.id || ""),
          leagueId: String(lg.id || ""),
          status: stateOf(ev),
          fmt: fmtOf(ev, cls),
          start: ev.date || "",
          summary: fs.summary || ev.summary || "",
          note: fs.type?.description || ev.summary || "",
          session: fs.session || "",
          teams,
          innings: [],
          players: [],
        });
      }
    }
  }
  return out;
}

function n(x) { const v = Number(x); return Number.isFinite(v) ? v : 0; }

function blankInn(n, team) {
  return { n, team: team || "", batters: [], bowlers: [], yetToBat: [], fow: [], extras: null, runs: null, wkts: null, overs: null };
}

function espnOut(dismissal) {
  const d = String(dismissal || "").trim().toLowerCase();
  if (!d || d === "not out" || d === "notout") return false;
  if (/did not bat|dnb/.test(d)) return false;
  return true;
}

function espnHow(dismissal) {
  const d = String(dismissal || "").trim();
  if (!d || /^not\s*out$/i.test(d)) return "not out";
  return d;
}

/** CREX / Cricinfo extras order: b, lb, w, nb, pen. */
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

export function parseSummary(doc) {
  const cards = doc?.matchcards || [];
  const players = new Map();
  const innings = [];
  const byInn = new Map();
  const innOf = (innNo, team) => {
    if (!byInn.has(innNo)) byInn.set(innNo, blankInn(innNo, team));
    const row = byInn.get(innNo);
    if (team && !row.team) row.team = team;
    return row;
  };
  const bump = (id, name, team, patch) => {
    const p = players.get(id) || { id, name, team, runs: null, balls: null, fours: null, sixes: null, wickets: null, conceded: null, ballsBowled: null, out: false };
    for (const [k, v] of Object.entries(patch)) {
      if (k === "out") p.out = p.out || !!v;
      else if (v == null) continue;
      else p[k] = (p[k] == null ? 0 : p[k]) + v;
    }
    players.set(id, p);
  };
  for (const card of cards) {
    const headline = String(card.headline || "");
    const team = card.teamName || "";
    const innNo = Number(card.inningsNumber) || innings.length + 1;
    if (headline === "Batting" || card.typeID === "11" || card.typeID === 11) {
      const tot = parseTotal(card.total, card.runs);
      let fours = 0, sixes = 0;
      const inn = innOf(innNo, team);
      Object.assign(inn, tot);
      for (const p of card.playerDetails || []) {
        fours += n(p.fours); sixes += n(p.sixes);
        const dismiss = String(p.dismissal || "");
        const dnb = /did not bat|\bdnb\b/i.test(dismiss) || (p.runs == null && p.ballsFaced == null && !dismiss);
        const out = espnOut(dismiss);
        const runs = n(p.runs), balls = n(p.ballsFaced);
        if (dnb) { inn.yetToBat.push(p.playerName); continue; }
        inn.batters.push({
          id: String(p.playerID || p.playerName), name: p.playerName, team, runs, balls,
          fours: n(p.fours), sixes: n(p.sixes), sr: nFloat(p.strikeRate) ?? strikeRate(runs, balls),
          out, dismissal: espnHow(dismiss),
        });
        bump(String(p.playerID || p.playerName), p.playerName, team, {
          runs, balls, fours: n(p.fours), sixes: n(p.sixes), out,
        });
      }
      innings.push({ n: innNo, team, headline: "Batting", fours, sixes, ...tot });
    } else if (headline === "Bowling" || card.typeID === "12" || card.typeID === 12) {
      const inn = innOf(innNo, "");
      for (const p of card.playerDetails || []) {
        const ballsBowled = oversToBalls(p.overs) || 0, conceded = n(p.conceded), wickets = n(p.wickets);
        inn.bowlers.push({
          id: String(p.playerID || p.playerName), name: p.playerName, team, wickets, conceded, ballsBowled,
          maidens: n(p.maidens), overs: nFloat(p.overs) ?? ballsToOvers(ballsBowled),
          econ: nFloat(p.economyRate || p.economy) ?? (ballsBowled ? Math.round((conceded / (ballsBowled / 6)) * 100) / 100 : null),
        });
        bump(String(p.playerID || p.playerName), p.playerName, team, { wickets, conceded, ballsBowled });
      }
    }
  }
  return { innings, players: [...players.values()], card: [...byInn.values()] };
}

export function attachSummary(match, summary) {
  if (!match || !summary) return match;
  return { ...match, innings: summary.innings, players: summary.players, card: summary.card || [] };
}

export function wantsCard(match) {
  return match?.status === "live";
}

/** Matches the books actually price: player lines, event markets, or fancy. Empty ESPN games stay out. */
export function bookFixtures(doc) {
  const seen = new Map();
  for (const l of [...(doc?.events || []), ...(doc?.lines || []), ...(doc?.fancy || [])]) {
    const [a, b] = String(l.match).split(/\s+vs\s+/i);
    if (!b || !l.start_utc) continue;
    const k = `${l.match}|${l.start_utc}`;
    if (!seen.has(k)) seen.set(k, { a: teamKey(a), b: teamKey(b), t: Date.parse(l.start_utc) });
  }
  return [...seen.values()];
}

export function fixtureInBooks(books, fixture) {
  if (!books?.length || !fixture) return false;
  const a = teamKey(fixture.a), b = teamKey(fixture.b), t = fixture.start ? Date.parse(fixture.start) : NaN;
  if (!a || !b) return false;
  return books.some((m) => ((m.a === a && m.b === b) || (m.a === b && m.b === a)) && (!Number.isFinite(t) || Math.abs(m.t - t) < BOOK_WINDOW_MS));
}

export function pricedLive(matches, books) {
  if (!books?.length) return [];
  return (matches || []).filter((m) => {
    const names = (m.teams || []).map((x) => teamKey(x.name));
    const t = m.start ? Date.parse(m.start) : NaN;
    return books.some((b) => names.includes(b.a) && names.includes(b.b) && (!Number.isFinite(t) || Math.abs(t - b.t) < BOOK_WINDOW_MS));
  });
}

function unescapeCrex(s) {
  return String(s || "").replace(/&q;/g, '"').replace(/&a;/g, "&").replace(/&s;/g, "'").replace(/&l;/g, "<").replace(/&g;/g, ">");
}

export function crexState(html) {
  const m = String(html || "").match(/<script id="app-root-state"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(unescapeCrex(m[1])); } catch { return null; }
}

/** CREX writes "119-2"; the site displays "119/2 (17.3 ov)". Toss-time 0/0 (0.0 ov) is not a score. */
function crexDisplay(score, overs) {
  const raw = String(score || "").trim().replace(/^(\d+)-(\d+)$/, "$1/$2");
  if (!raw) return parseScore("");
  const ov = String(overs || "").trim();
  const parsed = parseScore(ov ? `${raw} (${ov} ov)` : raw);
  if ((parsed.runs || 0) === 0 && (parsed.wkts || 0) === 0 && !(parsed.overs > 0)) return parseScore("");
  return parsed;
}

function crexInn(row, n) {
  const s = row[`s${n}`] || row[n === 1 ? "team1Score1" : "team2Score1"] || (n === 1 ? row.score1 : row.score2) || "";
  const o = row[`o${n}`] || row[n === 1 ? "team1Over1" : "team2Over1"] || (n === 1 ? row.over1 : row.over2) || "";
  return crexDisplay(s, o);
}

function sameSides(a, b) {
  const an = (a?.teams || []).map((t) => teamKey(t.name)), bn = (b?.teams || []).map((t) => teamKey(t.name));
  return an.length >= 2 && bn.includes(an[0]) && bn.includes(an[1]);
}

function sameTime(a, b) {
  const ta = a?.start ? Date.parse(a.start) : NaN, tb = b?.start ? Date.parse(b.start) : NaN;
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return true;
  return Math.abs(ta - tb) < WINDOW_MS;
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

/** CREX lastovers as over groups. Delivery-wise; do not flatten across the over break. */
function parseOvers(lastovers) {
  return (lastovers || []).map((o) => ({ balls: overBalls(o) })).filter((o) => o.balls.length);
}

/** CREX schedule page (`crex.com/schedule`, robots Allow). Team scores for every live game in one HTML response. */
export function parseCrexSchedule(html) {
  const rows = crexState(html)?.["https://stats.crickapi.com/fixture/getFixture"];
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const a = row.team1 || row.t1SName, b = row.team2 || row.t2SName;
    if (!a || !b) return [];
    const t1 = crexInn(row, 1), t2 = crexInn(row, 2);
    const live = !!t1.display || !!t2.display;
    const link = row.link || "";
    return [{
      id: String(row.mf || row.matchFkey || row.id || ""),
      status: live ? "live" : "upcoming",
      start: row.t ? new Date(row.t).toISOString() : "",
      summary: row.statusText || row.comment1 || "",
      note: "",
      url: link.startsWith("/") ? `https://crex.com${link}` : link,
      teams: [
        { name: a, abbr: row.t1SName || a, batting: String(row.bf || "") === String(row.t1f || row.team1fkey || ""), ...t1 },
        { name: b, abbr: row.t2SName || b, batting: String(row.bf || "") === String(row.t2f || row.team2fkey || ""), ...t2 },
      ],
      innings: [],
      players: [],
    }];
  });
}

/** CREX match summary page (`getSV3` in the same app-root-state). Current batters + bowler, not a full card. */
export function parseCrexLive(html) {
  const sv = crexState(html)?.["https://api.goscorer.com/api/v3/getSV3"];
  if (!sv || typeof sv !== "object") return null;
  const aName = sv.team1_f_n || sv.rt || sv.team1, bName = sv.team2_f_n || sv.team2;
  if (!aName || !bName) return null;
  const t1 = crexDisplay(sv.score1, sv.over1), t2 = crexDisplay(sv.score2, sv.over2);
  const bat = sv.rt || aName, bowl = teamKey(bat) === teamKey(aName) ? bName : aName;
  const strike = Number(sv.st);
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
  const inn = t1.display ? t1 : t2;
  const crr = nFloat(sv.crr), rrr = nFloat(sv.rrr);
  return {
    id: String(sv.mf || ""),
    status: sv.status === 1 || t1.display || t2.display ? "live" : "upcoming",
    start: "",
    summary: sv.comment1 || "",
    note: "",
    url: "",
    teams: [
      { name: aName, abbr: sv.team1short || sv.team1 || "", batting: teamKey(bat) === teamKey(aName), ...t1 },
      { name: bName, abbr: sv.team2short || sv.team2 || "", batting: teamKey(bat) === teamKey(bName), ...t2 },
    ],
    innings: inn.runs == null ? [] : [{ n: 1, team: bat, headline: "Batting", fours: nInt(sv.four1) + nInt(sv.four2), sixes: nInt(sv.six1) + nInt(sv.six2), runs: inn.runs, wkts: inn.wkts, overs: inn.overs }],
    players,
    partnership: sv.partnerruns == null && sv.partnerballs == null ? null : { runs: nInt(sv.partnerruns), balls: nInt(sv.partnerballs) },
    crr,
    rrr,
    thisOver,
    overs,
  };
}

/** Copy CREX match-page URLs onto ESPN rows. Schedule scores stay off: that HTML is cached ~5 min. */
export function attachCrexUrls(matches, crexList) {
  if (!crexList?.length) return matches || [];
  return (matches || []).map((m) => {
    if (m.url) return m;
    const c = crexList.find((x) => x?.url && sameSides(m, x) && sameTime(m, x));
    return c ? { ...m, url: c.url } : m;
  });
}

/** CREX match-scorecard page (`getSC4` in app-root-state). We fetch the HTML; never `crex.com/api`. */
export function crexScorecardUrl(url) {
  const u = String(url || "").replace(/\/+$/, "");
  if (!u) return "";
  return /match-scorecard/i.test(u) ? u : `${u}/match-scorecard`;
}

const CREX_OUT = { 1: "bowled", 2: "caught", 3: "caught and bowled", 4: "run out", 5: "lbw", 8: "stumped" };

function crexHow(code, bowler, fielders) {
  const b = bowler || "", f = (fielders || []).filter(Boolean).join("/");
  if (!code) return "not out";
  if (code === 1) return b ? `b ${b}` : "bowled";
  if (code === 2) return b && f ? `c ${f} b ${b}` : (b ? `c b ${b}` : "caught");
  if (code === 3) return b ? `c & b ${b}` : "caught and bowled";
  if (code === 4) return f ? `run out (${f})` : "run out";
  if (code === 5) return b ? `lbw b ${b}` : "lbw";
  if (code === 8) return b && f ? `st ${f} b ${b}` : (b ? `st b ${b}` : "stumped");
  return CREX_OUT[code] || "out";
}

function crexMaps(state) {
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

function crexBatter(row, names, team) {
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
    dismissal: crexHow(code, bowlerName, fielderNames),
    fowRuns: f.length > 5 ? nInt(f[5]) : null, fowBalls: f.length > 6 ? nInt(f[6]) : null,
  };
}

function crexBowler(row, names, team) {
  const f = String(row || "").split("/")[0].split(".");
  const id = f[0], conceded = nInt(f[1]), ballsBowled = nInt(f[2]), maidens = nInt(f[3]), wickets = nInt(f[4]);
  return {
    id, name: names[id] || id, team, conceded, ballsBowled, maidens, wickets,
    overs: ballsToOvers(ballsBowled), econ: ballsBowled ? Math.round((conceded / (ballsBowled / 6)) * 100) / 100 : null,
  };
}

/** Full CREX scorecard: batting (how-out, R, B, 4s, 6s, SR), extras, FOW, yet-to-bat, bowling (O, M, R, W, Econ). */
export function parseCrexScorecard(html) {
  const state = crexState(html);
  const rows = state?.["https://api.goscorer.com/api/v3/getSC4"];
  if (!Array.isArray(rows) || !rows.length) return null;
  const { names, teams } = crexMaps(state);
  const teamName = (id) => teams[id] || id || "";
  const ids = rows.map((r) => r.c).filter(Boolean);
  const otherId = (id) => ids.find((x) => x !== id) || Object.keys(teams).find((x) => x !== id) || "";
  const card = rows.map((row, i) => {
    const batId = row.c || "", bowlId = otherId(batId);
    const batTeam = teamName(batId), bowlTeam = teamName(bowlId);
    const tot = String(row.d || "").match(/^(\d+)\/(\d+)\((\d+)/);
    const balls = tot ? +tot[3] : null;
    const batters = [], yetToBat = [], fow = [];
    for (const raw of row.b || []) {
      const p = crexBatter(raw, names, batTeam);
      if (p.dnb) { if (names[p.id]) yetToBat.push(p.name); continue; }
      batters.push(p);
      if (p.out && p.fowRuns != null) fow.push({ name: p.name, runs: p.fowRuns, balls: p.fowBalls, wkts: fow.length + 1 });
    }
    const extras = extrasOf(String(row.e || "").split("."));
    return {
      n: i + 1, team: batTeam, batters, bowlers: (row.a || []).map((raw) => crexBowler(raw, names, bowlTeam)),
      yetToBat, fow, extras, runs: tot ? +tot[1] : null, wkts: tot ? +tot[2] : null, overs: balls != null ? ballsToOvers(balls) : null,
    };
  });
  const shown = card.filter((i) => i.batters.length || i.bowlers.length || i.runs != null);
  const players = [];
  for (const inn of shown) {
    for (const p of inn.batters) players.push({ id: p.id, name: p.name, team: p.team, runs: p.runs, balls: p.balls, fours: p.fours, sixes: p.sixes, sr: p.sr, wickets: null, conceded: null, ballsBowled: null, out: p.out, dismissal: p.dismissal });
    for (const p of inn.bowlers) players.push({ id: p.id, name: p.name, team: p.team, runs: null, balls: null, fours: null, sixes: null, wickets: p.wickets, conceded: p.conceded, ballsBowled: p.ballsBowled, maidens: p.maidens, econ: p.econ, out: false });
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

/** Fill empty ESPN team scores / so-far from a CREX snapshot. Never overwrites a number ESPN already has. */
export function overlayCrex(matches, crexList) {
  if (!crexList?.length) return matches || [];
  return (matches || []).map((m) => {
    const c = crexList.find((x) => x && sameSides(m, x) && sameTime(m, x));
    if (!c) return m;
    const teams = (m.teams || []).map((t) => {
      const o = (c.teams || []).find((x) => teamKey(x.name) === teamKey(t.name) || teamKey(x.abbr) === teamKey(t.name) || teamKey(x.name) === teamKey(t.abbr));
      if (!o || t.display) return t;
      return { ...t, display: o.display, runs: o.runs, wkts: o.wkts, overs: o.overs, batting: t.batting || o.batting };
    });
    const junk = /starts at|\blocal time\b/i;
    return {
      ...m,
      teams,
      summary: m.summary && !junk.test(m.summary) ? m.summary : (c.summary || m.summary),
      players: (m.players || []).length ? m.players : (c.players || []),
      innings: (m.innings || []).length ? m.innings : (c.innings || []),
      card: hasCard(m) ? m.card : (c.card || m.card || []),
      partnership: m.partnership || c.partnership || null,
      crr: m.crr ?? c.crr ?? null,
      rrr: m.rrr ?? c.rrr ?? null,
      thisOver: (m.thisOver || []).length ? m.thisOver : (c.thisOver || []),
      overs: (m.overs || []).length ? m.overs : (c.overs || []),
      status: m.status === "live" || (c.status === "live" && (c.teams || []).some((t) => t.display)) ? "live" : m.status,
      url: m.url || c.url,
    };
  });
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
    if (Math.abs(Date.parse(m.start) - t) < WINDOW_MS) return m;
    if (m.status === "live") fallback = fallback || m;
  }
  return fallback;
}

export function teamScore(match, teamName) {
  const k = teamKey(teamName);
  return (match?.teams || []).find((t) => teamKey(t.name) === k || teamKey(t.abbr) === k) || null;
}

/** ESPN kick-off lines are the ground's clock ("Starts at 09:30 local time"). The site only shows the viewer's zone. */
export function liveBlurb(match) {
  for (const s of [match?.summary, match?.note]) {
    const t = String(s || "").trim();
    if (!t || /^live$/i.test(t) || /starts at|\blocal time\b/i.test(t)) continue;
    return t;
  }
  return "";
}

export function livePlayer(match, name) {
  const hits = (match?.players || []).filter((p) => namesMatch(p.name, name));
  return hits.length === 1 ? hits[0] : null;
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

/** Compact scoreboard: current not-out batters, last wicket, current bowler. ESPN full cards only mark current when CREX did. */
export function liveBoard(match) {
  const players = match?.players || [];
  if (!players.length) return null;
  const raw = players.filter((p) => p.runs != null && !p.out).map(withSr);
  const strike = raw.find((p) => p.strike);
  const batters = strike ? [strike, ...raw.filter((p) => p !== strike)] : raw;
  const outs = players.filter((p) => p.out && p.runs != null).map(withSr);
  const bowling = players.filter((p) => p.wickets != null || p.conceded != null);
  const bowler = withEcon(bowling.find((p) => p.current) || (bowling.length === 1 ? bowling[0] : null));
  if (!batters.length && !outs.length && !bowler) return null;
  const pr = match.partnership;
  const overs = Array.isArray(match.overs) && match.overs.length
    ? match.overs
    : (Array.isArray(match.thisOver) && match.thisOver.length ? [{ balls: match.thisOver }] : []);
  return {
    batters,
    lastWicket: outs.length ? outs[outs.length - 1] : null,
    bowler,
    partnership: pr && (pr.runs != null || pr.balls != null) ? pr : null,
    crr: Number.isFinite(match.crr) ? match.crr : null,
    rrr: Number.isFinite(match.rrr) ? match.rrr : null,
    thisOver: Array.isArray(match.thisOver) ? match.thisOver : [],
    overs,
  };
}

const STAT_FIELD = { runs: "runs", balls: "balls", fours: "fours", sixes: "sixes", wickets: "wickets", runs_conceded: "conceded", balls_bowled: "ballsBowled" };

export function liveStat(player, stat) {
  if (!player) return null;
  const k = STAT_FIELD[stat];
  if (!k || player[k] == null) return null;
  return player[k];
}

export function liveMarket(match, key, team) {
  if (!match) return null;
  const inn = match.innings || [];
  const src = team ? inn.filter((i) => teamKey(i.team) === teamKey(team)) : inn;
  if (!src.length && !["top_score"].includes(key)) return null;
  const sum = (k) => src.reduce((a, i) => a + (i[k] || 0), 0);
  if (key === "match_runs" || key === "team_total_runs") return sum("runs");
  if (key === "first_innings_runs") return (team ? src : inn).find((i) => i.n === 1)?.runs ?? null;
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

/** Snapshot the site stores / serves. `summaries` is {eventId: summaryDoc}. */
export function buildLive(header, summaries = {}, asOf = new Date().toISOString()) {
  const matches = parseHeader(header).map((m) => attachSummary(m, summaries[m.id] ? parseSummary(summaries[m.id]) : null));
  return { asOf, source: "espn", delaySec: LIVE_TTL_MS / 1000, matches };
}
