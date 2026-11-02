// Tournament stats: the editions of an event (one season of a league, one series) and the leaderboards of one edition ("most runs", "best figures", ...),
// computed from the same batting, bowling and fielding rows the player pages read. Pure arithmetic over rows; the page only draws what comes back.
import { FORMATS, norm, round } from "./util.js";

/** More than this many days between two matches of an event starts a new edition (IPL 2024 and 2025 are 11 months apart; a Big Bash season runs December to February). */
export const EDITION_GAP_DAYS = 120;
/** A pause inside one calendar year may be longer: IPL 2021, paused in May and resumed 138 days later, is one edition, while IPL 2020 and 2021 (150 days apart, across New Year) are two. */
export const PAUSE_GAP_DAYS = 150;
/** Balls a batter must face (or a bowler bowl) in an edition to be ranked on an average, strike-rate or economy list. */
export const MIN_BALLS = { T20: 60, ODI: 120, Test: 300, Hundred: 60, T10: 30, O60: 120 };
/** Fewer ranked players than this and the minimum is dropped (a three-match series), which the board says. */
export const MIN_RANKED = 5;
export const BOARD_LIMIT = 25;
/** An edition needs this many counted matches to be a point on the season-by-season trend. */
export const TREND_MIN_MATCHES = 3;

const [IT, IR, IW, IB, IF4, IF6] = [0, 1, 2, 3, 4, 5]; // innings array layout of matches.json
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayGap = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;
const newEdition = (a, b) => { const g = dayGap(a, b); return g > PAUSE_GAP_DAYS || (g > EDITION_GAP_DAYS && a.slice(0, 4) !== b.slice(0, 4)); };
const seasonLabel = (from, to) => {
  const a = +from.slice(0, 4), b = +to.slice(0, 4);
  return a === b ? String(a) : b - a === 1 ? `${a}/${String(b).slice(2)}` : `${a}–${String(b).slice(2)}`;
};

// ------------------------------------------------------------------ editions
/**
 * The editions of event `e`, newest first: its matches grouped by gender and format (formats are never mixed), then split wherever the calendar has a gap (see
 * EDITION_GAP_DAYS and PAUSE_GAP_DAYS). `key` is the season in a link (unique within the event), `label` the season ("2025", "2024/25"), `name` the label with whatever tells two editions apart.
 * `ms` is the event's match indexes when the caller already has them; else they are found.
 */
export function editionsOf(store, e, ms) {
  const M = store.M, groups = new Map();
  const take = (m) => {
    const k = M.g[m] * 16 + M.f[m];
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  };
  if (ms) ms.forEach(take);
  else for (let m = 0; m < store.n; m++) if (M.e[m] === e) take(m);
  const eds = [];
  for (const all of groups.values()) {
    all.sort((x, y) => (M.d[x] < M.d[y] ? -1 : M.d[x] > M.d[y] ? 1 : x - y));
    let cur = [];
    const close = () => {
      if (!cur.length) return;
      const from = M.d[cur[0]], to = M.d[cur[cur.length - 1]], f = M.f[cur[0]];
      eds.push({ g: M.g[cur[0]], f, fmt: FORMATS[f], from, to, label: seasonLabel(from, to), n: cur.length, ms: cur });
      cur = [];
    };
    for (const m of all) { if (cur.length && newEdition(M.d[cur[cur.length - 1]], M.d[m])) close(); cur.push(m); }
    close();
  }
  eds.sort((x, y) => (x.from < y.from ? 1 : x.from > y.from ? -1 : x.g - y.g || x.f - y.f));
  const mixedG = new Set(eds.map((x) => x.g)).size > 1, multiFmt = new Set(eds.map((x) => x.f)).size > 1;
  const names = new Map();
  for (const ed of eds) {
    ed.name = `${ed.label}${mixedG && ed.g ? " (W)" : ""}${multiFmt ? ` ${ed.fmt}` : ""}`;
    names.set(ed.name, (names.get(ed.name) || 0) + 1);
  }
  for (const ed of eds) if (names.get(ed.name) > 1) ed.name += ` ${MONTHS[+ed.from.slice(5, 7) - 1]}`; // two seasons in one year: the month tells them apart
  // keys are given oldest first, so the first edition of a year keeps the plain year when a later one arrives (a shared link keeps pointing at the same season)
  const seen = new Set();
  for (const ed of [...eds].reverse()) {
    const base = `${ed.from.slice(0, 4)}${mixedG && ed.g ? "w" : ""}`, mm = ed.from.slice(5, 7);
    let key = base;
    if (seen.has(key) && multiFmt) key = `${base}-${ed.fmt.toLowerCase()}`;
    if (seen.has(key)) key = `${base}-${mm}`;
    for (let i = 2; seen.has(key); i++) key = `${base}-${mm}-${i}`;
    seen.add(key);
    ed.key = key;
  }
  return eds;
}

// ------------------------------------------------------------------ rows
async function readShard(store, n) {
  try { return await store.shard(n); } catch { return await store.shard(n); } // the store forgets a failed read, so this is a second try
}

/**
 * Every batting innings, bowling spell and fielding credit of the matches `ms`, oldest first. A player lives in one shard, so this reads all of them (`concurrency` at a time);
 * `onProgress(done, total)` is called as each lands.
 * @param {any} store
 * @param {number[]} ms
 * @param {{ onProgress?: (done: number, total: number) => void, concurrency?: number }} [opts]
 */
export async function editionRows(store, ms, { onProgress, concurrency = 8 } = {}) {
  const want = new Uint8Array(store.n);
  for (const m of ms) want[m] = 1;
  const bat = [], bowl = [], fld = [];
  const take = (d) => {
    const b = d.bat || {}, w = d.bowl || {}, f = d.fld || {};
    for (let k = 0; k < (b.p?.length || 0); k++) if (want[b.m[k]]) bat.push({ p: b.p[k], m: b.m[k], i: b.i[k], t: b.t[k], q: b.q[k], r: b.r[k], b: b.b[k], f: b.f[k], s: b.s[k], k: b.k[k] });
    for (let k = 0; k < (w.p?.length || 0); k++) if (want[w.m[k]]) bowl.push({ p: w.p[k], m: w.m[k], i: w.i[k], t: w.t[k], q: w.q[k], w: w.w[k], c: w.c[k], n: w.n[k] });
    for (let k = 0; k < (f.p?.length || 0); k++) if (want[f.m[k]]) fld.push({ p: f.p[k], m: f.m[k], i: f.i[k], t: f.t[k], q: f.q[k], ct: f.ct[k], st: f.st[k] });
  };
  const todo = Array.from({ length: store.nshard }, (_, s) => s);
  let done = 0;
  const worker = async () => {
    for (let s = todo.shift(); s !== undefined; s = todo.shift()) { take(await readShard(store, s)); onProgress?.(++done, store.nshard); }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, store.nshard) }, worker));
  const ord = (x, y) => x.m - y.m || x.i - y.i || x.p - y.p; // shards land in any order: sort so ties and "latest team" never depend on it
  return { bat: bat.sort(ord), bowl: bowl.sort(ord), fld: fld.sort(ord) };
}

// ------------------------------------------------------------------ totals per player
const betterScore = (x, y) => (x.r !== y.r ? x.r > y.r : x.no !== y.no ? x.no : x.b < y.b); // higher, then not out, then fewer balls

/** Batting totals per player. `retired` is the dismissal-kind code of "retired hurt" (not an out); a kind below 0 is a scraped match with no dismissal detail. */
export function battingTotals(bat, retired = -9) {
  const by = new Map();
  for (const r of bat) {
    let x = by.get(r.p);
    if (!x) by.set(r.p, x = { p: r.p, t: r.t, last: r.m, ms: new Set(), inns: 0, no: 0, outs: 0, unk: 0, runs: 0, balls: 0, f4: 0, f6: 0, h50: 0, h100: 0, ducks: 0, hs: null });
    x.t = r.t; x.last = r.m;
    x.ms.add(r.m); x.inns++; x.runs += r.r; x.balls += r.b; x.f4 += r.f; x.f6 += r.s;
    const out = r.k > 0 && r.k !== retired;
    if (r.k < 0) x.unk++; else if (out) x.outs++; else x.no++;
    if (r.r >= 100) x.h100++; else if (r.r >= 50) x.h50++;
    if (out && r.r === 0) x.ducks++;
    const cand = { r: r.r, b: r.b, no: r.k >= 0 && !out, m: r.m, q: r.q };
    if (!x.hs || betterScore(cand, x.hs)) x.hs = cand;
  }
  for (const x of by.values()) {
    x.matches = x.ms.size; delete x.ms;
    x.avg = x.unk === 0 && x.outs > 0 ? x.runs / x.outs : null; // a batter with a scraped innings has no known number of outs
    x.sr = x.balls > 0 ? (100 * x.runs) / x.balls : null;
  }
  return by;
}

/** Bowling totals per player; wickets exclude run outs (as in the data), `w4` counts spells of four or more wickets, `w5` of five or more. */
export function bowlingTotals(bowl) {
  const by = new Map();
  for (const r of bowl) {
    let x = by.get(r.p);
    if (!x) by.set(r.p, x = { p: r.p, t: r.t, last: r.m, ms: new Set(), inns: 0, balls: 0, runs: 0, wkts: 0, w4: 0, w5: 0, best: null });
    x.t = r.t; x.last = r.m;
    x.ms.add(r.m); x.inns++; x.balls += r.n; x.runs += r.c; x.wkts += r.w;
    if (r.w >= 4) x.w4++;
    if (r.w >= 5) x.w5++;
    if (!x.best || r.w > x.best.w || (r.w === x.best.w && (r.c < x.best.c || (r.c === x.best.c && r.n < x.best.n)))) x.best = { w: r.w, c: r.c, n: r.n };
  }
  for (const x of by.values()) {
    x.matches = x.ms.size; delete x.ms;
    x.avg = x.wkts > 0 ? x.runs / x.wkts : null;
    x.econ = x.balls > 0 ? (6 * x.runs) / x.balls : null;
    x.sr = x.wkts > 0 ? x.balls / x.wkts : null;
  }
  return by;
}

/** Performance points per player, the scoring the site's player-performance market uses: 1 per run, 20 per wicket, 10 per catch, 25 per stumping. */
export function pointsTotals(bats, bowls, fld) {
  const by = new Map();
  const slot = (p, t, last) => {
    let x = by.get(p);
    if (!x) by.set(p, x = { p, t, last, runs: 0, wkts: 0, ct: 0, st: 0, pts: 0 });
    if (last >= x.last) { x.t = t; x.last = last; }
    return x;
  };
  for (const b of bats.values()) slot(b.p, b.t, b.last).runs = b.runs;
  for (const w of bowls.values()) slot(w.p, w.t, w.last).wkts = w.wkts;
  for (const f of fld) { const x = slot(f.p, f.t, f.m); x.ct += f.ct; x.st += f.st; }
  for (const x of by.values()) x.pts = x.runs + 20 * x.wkts + 10 * x.ct + 25 * x.st;
  return by;
}

// ------------------------------------------------------------------ boards
const hi = (f) => (x, y) => f(y) - f(x);
const lo = (f) => (x, y) => f(x) - f(y);
const chain = (...cs) => (x, y) => { for (const c of cs) { const d = c(x, y); if (d) return d; } return (x.p ?? 0) - (y.p ?? 0) || (x.m ?? 0) - (y.m ?? 0); };
const dec = (x, d) => x.toFixed(d);
export const oversText = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`;

/**
 * The leaderboards of one edition `ed` (from `editionsOf`) given its `rows` (from `editionRows`): `groups` of boards (Batting, Bowling, Overall) and `leaders`, the top of
 * most runs, most wickets and performance points. A board is `{ id, title, head, cols, rows, note }`; a row is `{ rank, p, t, v, n, cells }` (`v` the headline figure as shown, `n`
 * the number it sorts on, `cells` the figures under `cols`). Innings and team boards also carry `m` (match), `q` (opposition) and `date`. Averages, strike rates and economy
 * rates rank only players past a minimum of balls (`minBalls`), unless fewer than `minRanked` get there.
 */
export function boards(store, ed, rows, { limit = BOARD_LIMIT, minBalls = MIN_BALLS[ed.fmt] ?? 60, minRanked = MIN_RANKED } = {}) {
  const M = store.M, kinds = store.index?.kinds || [], rh = kinds.indexOf("retired hurt"), retired = rh < 0 ? -9 : rh;
  const batMap = battingTotals(rows.bat, retired), bowlMap = bowlingTotals(rows.bowl), ptsMap = pointsTotals(batMap, bowlMap, rows.fld);
  const bats = [...batMap.values()], bowls = [...bowlMap.values()], pts = [...ptsMap.values()];
  const scraped = ed.ms.filter((m) => M.pv?.[m]).length;
  const ranked = (list, field) => { const q = list.filter((x) => x[field] >= minBalls); return q.length >= minRanked ? { list: q, min: true } : { list, min: false }; };
  const noMin = "Short series: no minimum applied.";
  const list = (id, title, head, cols, src, cmp, row, note = "") => ({
    id, title, head, cols, note,
    rows: [...src].sort(cmp).slice(0, limit).map((x, i) => ({ rank: i + 1, ...row(x) })),
  });
  const player = (x, v, n, cells) => ({ p: x.p, t: x.t, v, n, cells });
  const hsText = (h) => `${h.r}${h.no ? "*" : ""}`;
  const dash = (x, d) => (x == null ? "–" : dec(x, d));
  const isNo = (r) => (r.k >= 0 && !(r.k > 0 && r.k !== retired) ? 1 : 0);

  // batting
  const avgPool = ranked(bats.filter((x) => x.avg != null), "balls"), srPool = ranked(bats.filter((x) => x.balls > 0), "balls");
  const batting = [
    list("runs", "Most runs", "Runs", ["Avg", "SR", "HS", "Inn"], bats, chain(hi((x) => x.runs), lo((x) => x.balls)),
      (x) => player(x, String(x.runs), x.runs, [dash(x.avg, 2), dash(x.sr, 1), hsText(x.hs), String(x.inns)])),
    list("hs", "Highest scores", "Score", ["B", "SR", "4s", "6s"], rows.bat, chain(hi((r) => r.r), hi(isNo), lo((r) => r.b)),
      (r) => ({ p: r.p, t: r.t, m: r.m, q: r.q, date: M.d[r.m], v: `${r.r}${isNo(r) ? "*" : ""}`, n: r.r, cells: [String(r.b), r.b > 0 ? dec((100 * r.r) / r.b, 1) : "–", String(r.f), String(r.s)] })),
    list("avg", "Best batting average", "Avg", ["Runs", "SR", "Inn", "NO"], avgPool.list, chain(hi((x) => x.avg), hi((x) => x.runs)),
      (x) => player(x, dec(x.avg, 2), x.avg, [String(x.runs), dash(x.sr, 1), String(x.inns), String(x.no)]),
      `${avgPool.min ? `Minimum ${minBalls} balls faced.` : noMin} Batters not yet dismissed, or with a scraped match, are not ranked.`),
    list("sr", "Best strike rate", "SR", ["Runs", "Balls", "4s", "6s"], srPool.list, chain(hi((x) => x.sr), hi((x) => x.runs)),
      (x) => player(x, dec(x.sr, 1), x.sr, [String(x.runs), String(x.balls), String(x.f4), String(x.f6)]), srPool.min ? `Minimum ${minBalls} balls faced.` : noMin),
    list("sixes", "Most sixes", "6s", ["Runs", "Inn", "4s"], bats.filter((x) => x.f6 > 0), chain(hi((x) => x.f6), hi((x) => x.runs)),
      (x) => player(x, String(x.f6), x.f6, [String(x.runs), String(x.inns), String(x.f4)])),
    list("fours", "Most fours", "4s", ["Runs", "Inn", "6s"], bats.filter((x) => x.f4 > 0), chain(hi((x) => x.f4), hi((x) => x.runs)),
      (x) => player(x, String(x.f4), x.f4, [String(x.runs), String(x.inns), String(x.f6)])),
    list("fifties", "Most 50+ scores", "50+", ["100s", "50s", "Inn"], bats.filter((x) => x.h50 + x.h100 > 0), chain(hi((x) => x.h50 + x.h100), hi((x) => x.h100), hi((x) => x.runs)),
      (x) => player(x, String(x.h50 + x.h100), x.h50 + x.h100, [String(x.h100), String(x.h50), String(x.inns)])),
  ];

  // bowling
  const bAvgPool = ranked(bowls.filter((x) => x.wkts > 0), "balls"), econPool = ranked(bowls.filter((x) => x.balls > 0), "balls");
  const minBowl = `Minimum ${minBalls} balls bowled (${oversText(minBalls)} overs).`;
  const bowling = [
    list("wkts", "Most wickets", "Wkts", ["Avg", "Econ", "Best", "Inn", "Ov"], bowls, chain(hi((x) => x.wkts), lo((x) => x.runs), lo((x) => x.balls)),
      (x) => player(x, String(x.wkts), x.wkts, [dash(x.avg, 2), dash(x.econ, 2), `${x.best.w}/${x.best.c}`, String(x.inns), oversText(x.balls)])),
    list("best", "Best bowling figures", "Figures", ["Ov", "Econ"], rows.bowl, chain(hi((r) => r.w), lo((r) => r.c), lo((r) => r.n)),
      (r) => ({ p: r.p, t: r.t, m: r.m, q: r.q, date: M.d[r.m], v: `${r.w}/${r.c}`, n: r.w, cells: [oversText(r.n), r.n > 0 ? dec((6 * r.c) / r.n, 2) : "–"] })),
    list("bavg", "Best bowling average", "Avg", ["Wkts", "Econ", "Ov"], bAvgPool.list, chain(lo((x) => x.avg), hi((x) => x.wkts)),
      (x) => player(x, dec(x.avg, 2), x.avg, [String(x.wkts), dash(x.econ, 2), oversText(x.balls)]), bAvgPool.min ? minBowl : noMin),
    list("econ", "Best economy", "Econ", ["Wkts", "Avg", "Ov"], econPool.list, chain(lo((x) => x.econ), hi((x) => x.wkts)),
      (x) => player(x, dec(x.econ, 2), x.econ, [String(x.wkts), dash(x.avg, 2), oversText(x.balls)]), econPool.min ? minBowl : noMin),
    list("bsr", "Best bowling strike rate", "SR", ["Wkts", "Econ", "Ov"], bAvgPool.list, chain(lo((x) => x.sr), hi((x) => x.wkts)),
      (x) => player(x, dec(x.sr, 1), x.sr, [String(x.wkts), dash(x.econ, 2), oversText(x.balls)]), `Balls per wicket. ${bAvgPool.min ? minBowl : noMin}`),
    list("w4", "Most 4+ wicket hauls", "4W+", ["5W+", "Wkts", "Inn"], bowls.filter((x) => x.w4 > 0), chain(hi((x) => x.w4), hi((x) => x.w5), hi((x) => x.wkts)),
      (x) => player(x, String(x.w4), x.w4, [String(x.w5), String(x.wkts), String(x.inns)])),
  ];

  // overall: performance points and team innings
  const inns = [];
  for (const m of ed.ms) for (const inn of M.inn?.[m] || []) {
    if (!(inn[IB] > 0)) continue;
    inns.push({ t: inn[IT], q: inn[IT] === M.a[m] ? M.b[m] : M.a[m], m, date: M.d[m], runs: inn[IR], wkts: inn[IW], balls: inn[IB] });
  }
  const total = (x) => ({ t: x.t, q: x.q, m: x.m, date: x.date, v: x.wkts >= 10 ? String(x.runs) : `${x.runs}/${x.wkts}`, n: x.runs, cells: [oversText(x.balls)] });
  const overall = [
    list("pts", "Top performers", "Pts", ["Runs", "Wkts", "Ct", "St"], pts, chain(hi((x) => x.pts), hi((x) => x.runs)),
      (x) => player(x, String(x.pts), x.pts, [String(x.runs), String(x.wkts), String(x.ct), String(x.st)]), "1 point a run, 20 a wicket, 10 a catch, 25 a stumping."),
    list("high", "Highest team totals", "Score", ["Ov"], inns, chain(hi((x) => x.runs), lo((x) => x.wkts), lo((x) => x.balls)), total),
    list("low", "Lowest all-out totals", "Score", ["Ov"], inns.filter((x) => x.wkts >= 10), chain(lo((x) => x.runs), hi((x) => x.balls)), total),
  ];

  const groups = [["bat", "Batting", batting], ["bowl", "Bowling", bowling], ["all", "Overall", overall]].map(([id, label, bs]) => ({ id, label, boards: bs.filter((b) => b.rows.length) }));
  const byId = Object.fromEntries(groups.flatMap((g) => g.boards).map((b) => [b.id, b]));
  // the headline cards: most runs and most wickets, then the first of the others whose leader is a different player
  const leaders = [], used = new Set();
  for (const [id, label, always] of [["runs", "Most runs", 1], ["wkts", "Most wickets", 1], ["pts", "Top performer"], ["sixes", "Most sixes"], ["best", "Best figures"], ["hs", "Highest score"]]) {
    const row = byId[id]?.rows[0];
    if (!row || leaders.length >= 3 || (!always && (leaders.length < 2 || used.has(row.p)))) continue;
    leaders.push({ id, label, head: byId[id].head, cols: byId[id].cols, row });
    used.add(row.p);
  }
  return { groups, leaders, minBalls, scraped, matches: ed.n };
}

// ------------------------------------------------------------------ the edition as a whole, and season by season
/**
 * Scoring in the matches of `ed` that count for summary markets (the Markets tab's rule: void games out), from the per-innings totals only. Who won batting first is a result, not a
 * summary market: it counts every match with a winner, including a chase that ended before 80% of the overs (dropping those made bat-first look better than it is).
 */
export function editionSummary(store, ed) {
  const M = store.M;
  let counted = 0, first = 0, firstN = 0, second = 0, secondN = 0, f4 = 0, f6 = 0, runs = 0, balls = 0, decided = 0, batFirstWins = 0, highest = null;
  for (const m of ed.ms) {
    if (M.r[m] === 0 && M.w[m] >= 0 && M.fi[m] >= 0) { decided++; if (M.w[m] === M.fi[m]) batFirstWins++; }
    const inn = M.inn?.[m] || [];
    if (M.q[m] !== 1 || !inn.length) continue;
    counted++;
    if (inn[0]) { first += inn[0][IR]; firstN++; }
    if (inn[1]) { second += inn[1][IR]; secondN++; }
    for (const x of inn) {
      f4 += x[IF4] || 0; f6 += x[IF6] || 0; runs += x[IR]; balls += x[IB];
      if (!highest || x[IR] > highest.runs) highest = { t: x[IT], m, runs: x[IR], wkts: x[IW] };
    }
  }
  const per = (x, n) => (n ? round(x / n, 2) : null);
  return {
    matches: ed.n, counted, avgFirst: per(first, firstN), avgSecond: per(second, secondN), sixesPerMatch: per(f6, counted), foursPerMatch: per(f4, counted),
    runRate: balls ? round((6 * runs) / balls, 2) : null, batFirstWinPct: decided ? round((100 * batFirstWins) / decided, 1) : null, decided, highest,
  };
}

export const TREND_METRICS = [
  { id: "avgFirst", label: "1st innings score", digits: 0 },
  { id: "sixesPerMatch", label: "Sixes a match", digits: 1 },
  { id: "foursPerMatch", label: "Fours a match", digits: 1 },
  { id: "runRate", label: "Run rate", digits: 2 },
  { id: "batFirstWinPct", label: "Bat-first wins %", digits: 0 },
];

/** The same measures for every edition of the same gender and format as `ed` (never mixed), oldest first, for the season-by-season bars. */
export function trendSeries(store, eds, ed, { minMatches = TREND_MIN_MATCHES } = {}) {
  return eds.filter((x) => x.g === ed.g && x.f === ed.f).map((x) => ({ key: x.key, label: x.label, ...editionSummary(store, x) })).filter((x) => x.counted >= minMatches).reverse();
}

// ------------------------------------------------------------------ which competitions to offer first
/** A competition is live when its latest match was this many days ago or less. */
export const LIVE_DAYS = 10;
/** A competition is "soon" when last season's start date, a year on, falls within this many days ahead (a season due to start). */
export const SOON_DAYS = 60;
const DAY = 864e5, dayMs = (d) => Date.parse(`${d}T00:00:00Z`), padded = (s) => ` ${norm(s)} `;
const STOP = new Set(["the", "s", "men", "mens", "league", "t20", "twenty20", "odi"]);
const ALIAS = { bbl: "big bash", wbbl: "women big bash", wpl: "women premier", ipl: "indian premier", psl: "pakistan super", cpl: "caribbean premier", lpl: "lanka premier", bpl: "bangladesh premier", ilt20: "international" };

/** A competition's name reduced to the words that tell it apart, so the schedule's "Women's Big Bash League 2026-27" and the data's "Women's Big Bash League" meet. `female` adds "women" for a women's fixture whose series name does not say it. Same rule as `league_key` in `src/cricket_site/crex_assets.py`. */
export function seriesKey(name, female = false) {
  const t = [...new Set(norm(name).split(" ").flatMap((w) => (ALIAS[w] ? ALIAS[w].split(" ") : [w])).map((w) => (w === "womens" ? "women" : w)).filter((w) => w && !/^\d+$/.test(w) && !STOP.has(w)))];
  const k = t.filter((w) => w !== "women"); // the words keep their order ("India tour of England" is not "England tour of India"); "women" goes first
  return [...(female || t.includes("women") ? ["women"] : []), ...k].join(" ");
}

/**
 * The competitions to offer first (the Stats page's picker), best first: big events that are live or due to start, those in `pin` ahead of the others (Big Bash on top: the women's
 * season live, the men's due), then any other live competition, then any other that is due, then those that finished lately, big ones first; larger ones first within each. `big`
 * and `pin` are words looked for in the event's name. A competition is "live" when its latest match is within LIVE_DAYS of `now`, "soon" when last season's start, a year on, is
 * within SOON_DAYS ahead (the schedule only reaches ten days out, so this is read off the calendar the event kept before). Competitions whose latest run was under `minMatches`
 * matches are left out. `fixtures` (the schedule: `{ series, gender, start, status }`) says more: a competition with a fixture within three days either way is live, one with a
 * fixture in the next fourteen days is soon, whatever the match data (which lags the schedule) says. Each is `{ e, name, tag: "live" | "soon" | "", big, size, last }`.
 * @param {any} store
 * @param {{ now?: number, big?: string[], pin?: string[], minMatches?: number, limit?: number, fixtures?: any[] }} [opts]
 */
export function featuredEvents(store, { now = Date.now(), big = [], pin = [], minMatches = 10, limit = 14, fixtures = [] } = {}) {
  const M = store.M, by = new Map();
  for (let m = 0; m < store.n; m++) {
    const e = M.e[m];
    if (!e) continue;
    if (!by.has(e)) by.set(e, []);
    by.get(e).push(m);
  }
  const hit = (name, list) => list.some((w) => padded(name).includes(padded(w)));
  const keyed = new Map();
  for (const e of by.keys()) { const k = seriesKey(store.events[e]); if (!keyed.has(k)) keyed.set(k, []); keyed.get(k).push(e); }
  const onNow = new Set(), coming = new Set();
  for (const f of fixtures) {
    const start = Date.parse(String(f.start).length > 10 ? f.start : `${f.start}T12:00:00Z`), ahead = (start - now) / DAY;
    for (const e of keyed.get(seriesKey(f.series || "", f.gender === "female")) || []) {
      if (f.status === "Live" || Math.abs(ahead) <= 3) onNow.add(e);
      else if (ahead > 3 && ahead <= 14) coming.add(e);
    }
  }
  const out = [];
  for (const [e, ms] of by) {
    let last = "";
    for (const m of ms) if (M.d[m] > last) last = M.d[m];
    const since = (now - dayMs(last)) / DAY;
    if (since > 400) continue;
    const eds = editionsOf(store, e, ms), cur = eds[0];
    const size = Math.max(cur.n, eds.find((x, i) => i > 0 && x.g === cur.g && x.f === cur.f)?.n ?? 0);
    if (size < minMatches) continue;
    const live = since <= LIVE_DAYS || onNow.has(e), ahead = (dayMs(cur.from) + 365 * DAY - now) / DAY;
    const soon = !live && ((ahead >= -LIVE_DAYS && ahead <= SOON_DAYS) || coming.has(e));
    if (!live && !soon && since > 120 && !hit(store.events[e], big)) continue; // finished a while ago: only the big events stay on offer
    const name = store.events[e], isBig = hit(name, big), hot = live || soon;
    const group = isBig && hot ? 0 : live ? 1 : soon ? 2 : isBig ? 3 : 4;
    out.push({ e, name, tag: live ? "live" : soon ? "soon" : "", big: isBig, size, last, group, pin: group === 0 && hit(name, pin) ? 0 : 1, lv: live ? 0 : 1 });
  }
  out.sort((x, y) => x.group - y.group || (x.group === 0 ? x.pin - y.pin || x.lv - y.lv : 0) || y.size - x.size || (x.last < y.last ? 1 : x.last > y.last ? -1 : 0) || x.e - y.e);
  return out.slice(0, limit).map(({ e, name, tag, big: b, size, last }) => ({ e, name, tag, big: b, size, last }));
}
