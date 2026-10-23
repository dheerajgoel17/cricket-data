// Pages modelled on StatsHub's sitemap, translated to cricket: fixture/match page, player trends, competitions, tools, glossary.
import { STATS } from "./engine/rules.js";
import { FORMATS } from "./engine/util.js";
import { MATCH_MARKETS, marketReport, selectMatches } from "./engine/markets.js";
import { playerBadge, teamBadge } from "./assets.js";
import { H12, h, hashQuery, live, localWhen, num, odds, pc, table } from "./ui.js";

let C = null; // shared context from app.js
export const initPages = (ctx) => { C = ctx; };
const fmtOf = (f) => (FORMATS.includes(f?.fmt) ? f.fmt : "T20");

// ---------------------------------------------------------------- grid data shared by fixture page and trends
export async function collectGrid(teamIdx, fmtName, stat, nFx = 10) {
  nFx = Math.max(3, Math.min(30, Number(nFx) || 10));
  const { store } = C;
  const fmt = FORMATS.indexOf(fmtName), M = store.M, def = STATS[stat];
  const fx = [];
  for (let m = store.n - 1; m >= 0 && fx.length < nFx; m--) if (M.f[m] === fmt && (M.a[m] === teamIdx || M.b[m] === teamIdx)) fx.push(m);
  fx.reverse();
  if (!fx.length) return { fx, body: [] };
  const cutoff = M.d[fx[0]];
  const cand = [];
  for (let i = 0; i < store.P.id.length; i++) if (store.P.tm[i] === teamIdx && store.P.last[i] >= cutoff && ((store.P.fm[i] >> fmt) & 1)) cand.push(i);
  cand.sort((x, y) => store.P.n[y] - store.P.n[x]);
  const rows = await Promise.all(cand.slice(0, 22).map(async (p) => {
    const r = await store.playerRows(p);
    const list = (def.side === "bat" ? r.bat : r.bowl).filter((x) => x.fmt === fmt && x.t === teamIdx);
    return { p, map: new Map(list.map((x) => [x.m, x])), xi: r.xi };
  }));
  const body = rows.map((r) => ({ ...r, n: fx.filter((m) => r.map.has(m)).length })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n).slice(0, 15);
  return { fx, body, def };
}

export function gridTable(g, teamIdx, line) {
  const { store } = C, M = store.M;
  if (!g.fx.length) return h("p", { class: "muted" }, "No fixtures for this format.");
  const head = h("tr", {}, h("th", {}, "Player"), h("th", {}, "Hit"), g.fx.map((m) => { const opp = M.a[m] === teamIdx ? M.b[m] : M.a[m]; return h("th", { class: "gh" }, teamBadge(store.teamName(opp, true)), h("div", {}, M.d[m].slice(5).split("-").reverse().join("/"))); }));
  const trs = g.body.map(({ p, map, xi }) => {
    const vals = g.fx.filter((m) => map.has(m)).map((m) => map.get(m)[g.def.key]);
    const k = vals.filter((v) => v > line).length;
    return h("tr", {}, h("td", {}, h("a", { class: "tm", href: `#/player/${p}` }, playerBadge(store, p), store.playerName(p))), h("td", { class: "odds" }, vals.length ? `${k}/${vals.length}` : "–"),
      g.fx.map((m) => { const x = map.get(m); return h("td", { class: "gcellx" }, x ? h("span", { class: `gv ${x[g.def.key] > line ? "hit" : "miss"}` }, String(x[g.def.key])) : xi?.has(m) && store.M.xq?.[m] !== 0 ? h("span", { class: "gv void", title: "In the XI but did not bat/bowl: bet void" }, "VOID") : h("span", { class: "gv dnp" }, "–")); }));
  });
  return h("div", { class: "card flat scroll" }, h("table", { class: "gridt" }, h("thead", {}, head), h("tbody", {}, trs)));
}

/** StatsHub "player trends" cards: players whose recent games clear the line most often. */
export function trendCards(grids, line, minHit, stat) {
  const { store } = C;
  const items = [];
  for (const { g, team } of grids) for (const r of g.body) {
    const vals = g.fx.filter((m) => r.map.has(m)).map((m) => r.map.get(m)[g.def.key]);
    if (vals.length < 5) continue;
    const k = vals.filter((v) => v > line).length;
    items.push({ p: r.p, team, vals, k, rate: k / vals.length, last: g.fx.filter((m) => r.map.has(m)).map((m) => r.map.get(m)) });
  }
  items.sort((a, b) => b.rate - a.rate || b.vals.length - a.vals.length);
  const list = items.filter((i) => i.rate >= minHit).slice(0, 24);
  if (!list.length) return h("div", { class: "card muted" }, "No player clears that hit rate in the last games. Lower the hit-rate filter or line.");
  return h("div", { class: "cards2 stagger" }, list.map((i) => h("a", { class: "trend", href: `#/player/${i.p}`, style: "color:inherit;text-decoration:none" },
    h("div", { class: "tt" }, h("div", { class: "who" }, playerBadge(store, i.p), h("div", {}, store.playerName(i.p), h("small", {}, store.teamName(i.team)))), h("span", { class: "linepill" }, `O ${line}`, h("b", {}, odds(i.rate ? 1 / i.rate : null)))),
    h("div", { class: "lab" }, `${STATS[stat].label} over ${line}`),
    h("div", { class: "nums" }, h("div", { class: "l" }, h("b", {}, `${i.k}/${i.vals.length}`), h("span", {}, "Record")), h("div", {}, h("b", {}, pc(i.rate)), h("span", {}, "Hit rate")), h("div", {}, h("b", {}, num(i.vals.reduce((a, b) => a + b, 0) / i.vals.length)), h("span", {}, "Avg"))),
    h("div", { class: "gstrip" }, i.vals.slice(-10).map((v) => h("div", { class: "gcell" }, h("div", { class: `v ${v > line ? "hit" : ""}` }, String(v))))))));
}

const statOptions = (cur) => Object.entries(STATS).map(([k, v]) => h("option", { value: k, selected: k === cur }, v.label));

// ---------------------------------------------------------------- fixture (match) page
export async function fixturePage(args, q) {
  const { store, crumbs, heroCard, go, nextCountdown } = C;
  const fx = (await store.loadFixtures()).find((f) => f.id === args.join("/"));
  if (!fx) return h("div", {}, crumbs(["Home", "#/"], ["Fixture"]), h("div", { class: "card err" }, "That fixture is no longer in the schedule."));
  if (fx.fmt === "FC") return h("div", {}, crumbs(["Home", "#/"], ["Fixtures", "#/"], [`${fx.a} v ${fx.b}`]), h("div", { class: "card" }, h("h2", {}, `${fx.a} v ${fx.b}`), h("p", { class: "muted" }, `${fx.series || ""} · ${fx.venue || ""}`), h("p", {}, "This is a first-class match. First-class cricket is not part of the stats here (no Test or limited-overs form is mixed in), so there is no player grid or trends for it.")));
  const fmt = FORMATS.includes(q.fmt) ? q.fmt : fmtOf(fx), stat = STATS[q.stat] ? q.stat : "sixes", line = q.line !== undefined && q.line !== "" ? Number(q.line) : 0.5, games = [5, 10, 15, 20, 30].includes(Number(q.n)) ? Number(q.n) : 10;
  const when = fx.start.length > 10 ? new Date(fx.start) : new Date(`${fx.start}T12:00:00`);
  const root = h("div");
  const hc = heroCard({ name: `${fx.a} v ${fx.b}`, sub: fx.venue || "", meta: [fmt, fx.gender === "female" ? "Women" : "Men", localWhen(when)],
    badge: h("div", { class: "vs" }, teamBadge(fx.a, "crest"), h("span", {}, "v"), teamBadge(fx.b, "crest")), tabs: [["grid", "Player grid"], ["trends", "Trends"], ["markets", "Team markets"]] }, root);
  const hitSel = (cur) => [[0.5, "50%+"], [0.6, "60%+"], [0.7, "70%+"], [0.8, "80%+"]].map(([v, l]) => h("option", { value: v, selected: String(v) === String(cur || "0.6") }, l));
  const mkForm = () => live(h("form", { class: "card filters", onsubmit: (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); go(`fixture/${fx.id}`, { ...f, tab: hashQuery().tab }); } },
    h("label", {}, "Format", h("select", { name: "fmt" }, FORMATS.map((f) => h("option", { value: f, selected: f === fmt }, f)))),
    h("label", {}, "Stat", h("select", { name: "stat" }, statOptions(stat))), h("label", {}, "Line", h("input", { name: "line", type: "number", step: "0.5", value: line, style: "width:90px" })),
    h("label", {}, "Games", h("select", { name: "n" }, [5, 10, 15, 20, 30].map((n) => h("option", { value: n, selected: n === games }, `Last ${n}`)))),
    h("label", {}, "Min hit rate (trends)", h("select", { name: "hit" }, hitSel(q.hit)))));
  const teams = [[fx.a, fx.a_ix], [fx.b, fx.b_ix]];
  const known = teams.filter(([, i]) => i >= 0);
  const grids = await Promise.all(known.map(async ([name, i]) => ({ name, team: i, g: await collectGrid(i, fmt, stat, games) })));
  const sGrid = h("div", { "data-sec": "grid" }, mkForm(), ...grids.map(({ name, team, g }) => h("div", {}, h("h2", {}, `${name}: ${STATS[stat].label} over ${line}`), gridTable(g, team, line))),
    !known.length ? h("div", { class: "card muted" }, "These teams are not in the dataset yet.") : null);
  const sTrends = h("div", { "data-sec": "trends" }, mkForm(), trendCards(grids, line, Number(q.hit || 0.6), stat));
  const sMarkets = h("div", { "data-sec": "markets" }, known.length ? h("div", { class: "two" }, known.map(([name, i]) => marketCard(name, i, fmt))) : h("div", { class: "card muted" }, "No team data."));
  root.append(sGrid, sTrends, sMarkets);
  const out = h("div", {}, crumbs(["Home", "#/"], ["Fixtures", "#/"], [`${fx.a} v ${fx.b}`]), hc.el, nextCountdown ? nextCountdown(when) : null, root);
  hc.set(q.tab);
  return out;
}

function marketCard(name, idx, fmt) {
  const { store } = C;
  const ms = selectMatches(store, { fmt: FORMATS.indexOf(fmt), team: idx, lastN: 30 });
  const rows = ["match_runs", "match_sixes", "match_fours", "match_50s", "highest_over"].map((k) => { const r = marketReport(store, ms, k); return [MATCH_MARKETS[k].label, num(r.summary.median), num(r.summary.mean)]; });
  return h("div", { class: "card" }, h("h3", {}, `${name}: last ${ms.length} ${fmt} matches`), table(["Market", "Median", "Mean"], rows), h("p", {}, h("a", { href: `#/team/${idx}?fmt=${fmt}` }, "Full team page →")));
}

// ---------------------------------------------------------------- trends (pick a fixture)
export async function trendsPage(_, q) {
  const { store, crumbs, go } = C;
  const fxs = (await store.loadFixtures()).filter((f) => f.a_ix >= 0 && f.b_ix >= 0 && (f.start.length > 10 ? Date.parse(f.start) > Date.now() - 4 * 36e5 : true)).slice(0, 40);
  const sel = fxs.find((f) => f.id === q.f) || fxs[0];
  const fmtQ = FORMATS.includes(q.fmt) ? q.fmt : null;
  const form = live(h("form", { class: "card filters", onsubmit: (e) => { e.preventDefault(); go("trends", Object.fromEntries(new FormData(e.target))); } },
    h("label", {}, "Fixture", h("select", { name: "f" }, fxs.map((f) => h("option", { value: f.id, selected: f === sel }, `${localWhen(f.start.length > 10 ? f.start : `${f.start}T12:00:00`, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}  ${f.a} v ${f.b} (${f.fmt || "T20"})`)))),
    h("label", {}, "Format", h("select", { name: "fmt" }, FORMATS.map((f) => h("option", { value: f, selected: f === (fmtQ || (sel ? fmtOf(sel) : "T20")) }, f)))),
    h("label", {}, "Stat", h("select", { name: "stat" }, statOptions(q.stat || "sixes"))), h("label", {}, "Line", h("input", { name: "line", type: "number", step: "0.5", value: q.line ?? 0.5, style: "width:90px" })),
    h("label", {}, "Games", h("select", { name: "n" }, [5, 10, 15, 20, 30].map((n) => h("option", { value: n, selected: n === (Number(q.n) || 10) }, `Last ${n}`)))),
    h("label", {}, "Min hit rate", h("select", { name: "hit" }, [[0.5, "50%+"], [0.6, "60%+"], [0.7, "70%+"], [0.8, "80%+"]].map(([v, l]) => h("option", { value: v, selected: String(v) === (q.hit || "0.6") }, l))))));
  let body = h("div", { class: "card muted" }, "No upcoming fixtures with known teams right now.");
  if (sel) {
    const stat = STATS[q.stat] ? q.stat : "sixes", line = q.line !== undefined && q.line !== "" ? Number(q.line) : 0.5;
    const fmt = fmtQ || fmtOf(sel);
    const grids = await Promise.all([[sel.a, sel.a_ix], [sel.b, sel.b_ix]].map(async ([name, i]) => ({ name, team: i, g: await collectGrid(i, fmt, stat, Number(q.n) || 10) })));
    body = h("div", {}, h("h2", {}, `${sel.a} v ${sel.b}`), trendCards(grids, line, Number(q.hit || 0.6), stat), h("p", { class: "muted small" }, `Players whose last ${Number(q.n) || 10} ${fmt} games for their team cleared ${STATS[stat].label.toLowerCase()} over ${line}. Games he did not feature in are excluded.`));
  }
  return h("div", {}, crumbs(["Home", "#/"], ["Tools", "#/tools"], ["Player trends"]), h("h1", {}, "Player trends"), h("p", { class: "muted" }, "Strongest recent hit-rate streaks for the players in an upcoming match."), form, body);
}

// ---------------------------------------------------------------- competitions
export async function competitionsPage(_, q) {
  const { store, crumbs } = C;
  const cnt = new Map();
  for (let m = 0; m < store.n; m++) { const e = store.M.e[m]; if (e) cnt.set(e, (cnt.get(e) || 0) + 1); }
  const all = [...cnt.entries()].filter(([, c]) => c >= 8).sort((a, b) => b[1] - a[1]);
  const input = h("input", { type: "search", placeholder: "Search competitions", style: "width:100%", value: q.q || "" });
  const list = h("div");
  const draw = () => {
    const t = input.value.trim().toLowerCase();
    const rows = all.filter(([e]) => !t || store.events[e].toLowerCase().includes(t)).slice(0, 80);
    list.replaceChildren(h("div", { class: "card flat" }, rows.map(([e, c]) => h("a", { class: "match", href: `#/league/${e}` }, h("div", { class: "badge-ico" }, store.events[e].split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase()), h("div", { class: "teams" }, h("div", {}, store.events[e])), h("div", { class: "meta" }, `${c} matches`), h("span", { class: "arrow" }, "→")))));
  };
  input.addEventListener("input", draw);
  draw();
  return h("div", {}, crumbs(["Home", "#/"], ["Competitions"]), h("h1", {}, "Competitions"), input, list);
}

export async function leaguePage(args) {
  const { store, crumbs, heroCard } = C;
  const e = Number(args[0]);
  if (!(e >= 0 && e < store.events.length)) return h("div", { class: "card err" }, "Unknown competition.");
  const ms = [];
  for (let m = 0; m < store.n; m++) if (store.M.e[m] === e) ms.push(m);
  const fc = [0, 0, 0, 0];
  for (const m of ms) fc[store.M.f[m]]++;
  const fmt = fc.indexOf(Math.max(...fc)), fmtName = FORMATS[fmt];
  const valid = selectMatches(store, { fmt, event: [e] });
  const root = h("div");
  const seasons = [...new Set(ms.map((m) => store.M.d[m].slice(0, 4)))].sort().reverse();
  // team table
  const tt = new Map();
  for (const m of ms) for (const t of [store.M.a[m], store.M.b[m]]) { const r = tt.get(t) || { n: 0, w: 0, l: 0 }; r.n++; if (store.M.w[m] === t) r.w++; else if (store.M.w[m] >= 0) r.l++; tt.set(t, r); }
  const teams = [...tt.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 40);
  const mk = ["match_runs", "match_sixes", "match_fours", "match_50s", "highest_over", "top_score"].map((k) => { const r = marketReport(store, valid, k); return [MATCH_MARKETS[k].label, num(r.summary.median), num(r.summary.mean), r.n]; });
  const recent = ms.slice(-15).reverse().map((m) => { const inn = store.M.inn[m]; const sc = (i) => inn[i] ? `${inn[i][1]}/${inn[i][2]}` : "–"; return [store.M.d[m], `${store.teamName(store.M.a[m], true)} v ${store.teamName(store.M.b[m], true)}`, store.venueName(store.M.v[m]), inn.length ? `${sc(0)} · ${sc(1)}` : "–", store.M.w[m] >= 0 ? store.teamName(store.M.w[m], true) : "–"]; });
  root.append(h("div", { "data-sec": "overview" }, h("div", { class: "card flat" }, table(["Market", "Median", "Mean", "Matches"], mk)), h("p", { class: "muted small" }, `${fmtName} matches that count for summary markets (void games excluded).`)),
    h("div", { "data-sec": "teams" }, h("div", { class: "card flat" }, table(["Team", "Played", "Won", "Lost", "Win %"], teams.map(([t, r]) => [h("a", { href: `#/team/${t}?fmt=${fmtName}` }, store.teamName(t)), r.n, r.w, r.l, pc(r.n ? r.w / r.n : null)])))),
    h("div", { "data-sec": "results" }, h("div", { class: "card flat" }, table(["Date", "Match", "Venue", "Innings runs", "Winner"], recent))));
  const hc = heroCard({ name: store.events[e], sub: `${ms.length} matches · ${seasons[seasons.length - 1]}–${seasons[0]}`, meta: [fmtName, `${tt.size} teams`], cls: "v", badge: h("div", { class: "crest" }, store.events[e].split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase()),
    tabs: [["overview", "Markets"], ["teams", "Teams"], ["results", "Results"]] }, root);
  const out = h("div", {}, crumbs(["Home", "#/"], ["Competitions", "#/competitions"], [store.events[e]]), hc.el, root);
  hc.set();
  return out;
}

// ---------------------------------------------------------------- tools, calculator, glossary, features
const TOOLS = [["trends", "Player trends", "Players whose recent games clear a line, for any upcoming match.", "Popular"], ["props", "Prop Hunter", "Value bets from the hourly market scan.", "Popular"],
  ["odds", "Odds & probability calculator", "Decimal odds, implied probability, margin removal, EV and Kelly stake.", "New"], ["players", "Player stats", "Hit rates over any line with DNP-aware form charts.", ""],
  ["teams", "Team & venue stats", "Match totals, fancy markets and player grids.", ""], ["pair", "Partnerships", "Who gets out first for any pair of batters.", ""],
  ["competitions", "Competitions", "Markets, teams and results for every league and series.", ""], ["ask", "Ask anything", "Type a question in your own words.", ""], ["glossary", "Cricket stats explained", "What every market and rule means.", ""]];
export async function toolsPage() {
  const { crumbs } = C;
  return h("div", {}, crumbs(["Home", "#/"], ["Tools"]), h("h1", {}, "Free cricket betting tools"), h("p", { class: "muted" }, "Professional-grade cricket props analysis, completely free: no login, no paywall."),
    h("div", { class: "pills" }, ["100% free", "No registration", "Ball-by-ball data"].map((x) => h("span", { class: "chip" }, x))),
    h("div", { class: "cards2 stagger", style: "margin-top:16px" }, TOOLS.map(([r, t, d, b]) => h("a", { class: "card toolc", href: `#/${r}` }, b ? h("span", { class: "badge live" }, b) : null, h("h3", {}, t), h("p", { class: "muted small" }, d), h("span", { class: "odds" }, "Open →")))));
}
export const featuresPage = toolsPage;

export async function oddsPage() {
  const { crumbs } = C;
  const dec = h("input", { type: "number", step: "0.01", min: "1.01", value: "1.90", id: "o-dec" });
  const opp = h("input", { type: "number", step: "0.01", min: "1.01", value: "1.90", id: "o-opp" });
  const bank = h("input", { type: "number", step: "1", min: "0", value: "1000" });
  const myp = h("input", { type: "number", step: "0.1", min: "0", max: "100", value: "55" });
  const out = h("div", { class: "grid" });
  const draw = () => {
    const d = Number(dec.value), o = Number(opp.value), p = Number(myp.value) / 100, b = Number(bank.value);
    const imp = d > 1 ? 1 / d : null, impO = o > 1 ? 1 / o : null, over = imp && impO ? imp + impO : null;
    const fair = over ? imp / over : null, ev = p && d > 1 ? p * d - 1 : null, kelly = ev != null && d > 1 ? Math.max(0, ev / (d - 1)) : null;
    const card = (k, v, s) => h("div", { class: "stat" }, h("div", { class: "k" }, k), h("div", { class: "v" }, v), s ? h("div", { class: "s" }, s) : null);
    out.replaceChildren(card("Implied probability", imp ? pc(imp) : "–", "1 ÷ decimal odds"), card("Margin (overround)", over ? `${((over - 1) * 100).toFixed(1)}%` : "–", "both sides of the market"),
      card("No-vig probability", fair ? pc(fair) : "–", fair ? `fair odds ${odds(1 / fair)}` : "enter both sides"), card("Expected value", ev != null ? `${(ev * 100).toFixed(1)}%` : "–", "per 1 staked at your probability"),
      card("Kelly stake", kelly != null && b ? `${(kelly * b).toFixed(0)}` : "–", kelly != null ? `full Kelly ${(kelly * 100).toFixed(1)}% · quarter ${(kelly * 25).toFixed(1)}%` : ""));
  };
  [dec, opp, bank, myp].forEach((i) => i.addEventListener("input", draw));
  draw();
  const f = (l, el) => h("label", {}, l, el);
  return h("div", {}, crumbs(["Home", "#/"], ["Tools", "#/tools"], ["Odds calculator"]), h("h1", {}, "Odds & probability calculator"),
    h("p", { class: "muted" }, "Decimal odds only. Turn a price into a probability, strip the bookmaker margin, and size a stake from your own estimate."),
    h("div", { class: "card filters" }, f("Decimal odds (this side)", dec), f("Decimal odds (other side)", opp), f("Your probability %", myp), f("Bankroll", bank)), out,
    h("p", { class: "muted small" }, "Not betting advice. Fair odds on this site are 1 ÷ historical hit rate and ignore margin, form, pitch and XIs."));
}

const GLOSS = [
  ["Hit rate", "Basic", "Betting", "Share of games where the stat cleared the line (over: strictly more than the line). Pushes on whole-number lines are void."],
  ["Fair decimal odds", "Basic", "Betting", "1 ÷ hit rate. The price at which the historical rate breaks even, with no bookmaker margin."],
  ["Line", "Basic", "Betting", "The threshold in a prop, e.g. sixes over 0.5 or runs over 24.5."],
  ["DNP", "Basic", "Form", "Did not play: the team had a fixture but the player was not in the playing XI. Shown on charts, left out of hit rates."],
  ["VOID (did not bat / bowl)", "Intermediate", "Rules", "Named in the playing XI but never reached the crease (or never bowled): bets on that player's batting (or bowling) stats are void and the stake is returned. Left out of hit rates."],
  ["30s", "Basic", "Markets", "Innings of 30-49 runs. Counted per match as a fancy market."],
  ["50s", "Basic", "Markets", "Innings of 50-99 runs (100+ are centuries)."],
  ["Double-digit scores", "Basic", "Markets", "Batters reaching 10 or more."],
  ["Single-digit scores", "Basic", "Markets", "Scores of 1-9. Ducks (out for 0) are not single-digit."],
  ["Highest over", "Intermediate", "Markets", "Most runs conceded in a single over of the match."],
  ["Most runs conceded", "Intermediate", "Markets", "The largest number of runs conceded by one bowler in the match."],
  ["Top batter", "Intermediate", "Markets", "Highest scorer in the match, or for the team batting first. Ties are shown separately."],
  ["Void rules", "Intermediate", "Rules", "T20 and ODI summary markets are void unless 80% of the overs are bowled in both innings; Tests unless there is a result or 300 (5-day) / 200 (4-day) overs."],
  ["Team-specific markets", "Intermediate", "Rules", "Count only the team batting first."],
  ["Retired hurt", "Basic", "Rules", "Not a wicket. Penalty runs count. Super overs are ignored."],
  ["Batting position", "Intermediate", "Form", "Order in which a batter first appears at the crease (openers are 1 and 2)."],
  ["Home / away / neutral", "Intermediate", "Form", "Inferred from the series name, the venue's host nation and who plays there most; Cricsheet has no home flag."],
  ["Correlated props", "Advanced", "Betting", "How often a player's other props clear when a given prop clears, versus his normal rate."],
  ["Overround", "Advanced", "Betting", "The sum of implied probabilities above 100%: the bookmaker's margin."],
  ["Kelly stake", "Advanced", "Betting", "Stake sized from your edge: (p × odds - 1) ÷ (odds - 1). Quarter Kelly is the usual cautious fraction."],
  ["Provisional matches", "Intermediate", "Data", "Scraped scorecards covering the gap until Cricsheet publishes: player totals only, so no partnerships or batting order."],
];
export async function glossaryPage(_, q) {
  const { crumbs } = C;
  const cats = ["All", ...new Set(GLOSS.map((g) => g[2]))], levels = ["All", "Basic", "Intermediate", "Advanced"];
  const st = { c: "All", l: "All", t: q.q || "" };
  const body = h("div", { class: "cards2 stagger" });
  const draw = () => body.replaceChildren(...GLOSS.filter((g) => (st.c === "All" || g[2] === st.c) && (st.l === "All" || g[1] === st.l) && (!st.t || (g[0] + g[3]).toLowerCase().includes(st.t.toLowerCase())))
    .map(([t, l, c, d]) => h("div", { class: "card", style: "margin:0" }, h("div", { class: "pills" }, h("span", { class: "badge" }, l), h("span", { class: "badge" }, c)), h("h3", { style: "margin-top:8px" }, t), h("p", { class: "muted small" }, d))));
  const sel = (arr, key) => h("select", { onchange: (e) => { st[key] = e.target.value; draw(); } }, arr.map((x) => h("option", { value: x }, x)));
  const search = h("input", { type: "search", placeholder: "Search stats and rules", value: st.t, oninput: (e) => { st.t = e.target.value; draw(); }, style: "flex:1;min-width:200px" });
  draw();
  return h("div", {}, crumbs(["Home", "#/"], ["Tools", "#/tools"], ["Cricket stats explained"]), h("h1", {}, "Cricket stats explained"), h("p", { class: "muted" }, "Every market, rule and number on this site, in plain words."),
    h("div", { class: "card filters" }, search, sel(cats, "c"), sel(levels, "l")), body);
}
