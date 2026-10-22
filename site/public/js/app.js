import { parseQuestion } from "./engine/nl.js";
import { runPlan } from "./engine/plan.js";
import { Resolver } from "./engine/resolve.js";
import { RULES, STATS } from "./engine/rules.js";
import { createStore } from "./engine/store.js";
import { FORMATS } from "./engine/util.js";
import { renderResult } from "./render.js";
import { SPLITS } from "./engine/props.js";
import { chips, freshText, h, odds, pc, suggest, table } from "./ui.js";

const app = document.getElementById("app");
let store, rz;
const EXAMPLES = [
  "Harry Brook ODI sixes over 0.5 away from England",
  "when Banton and Duckett open, who gets out first",
  "Jos Buttler T20 fours under 1.5 chasing last 20",
  "Babar Azam ODI runs over 49.5 vs India",
  "IPL match sixes at Wankhede",
  "England T20 team sixes batting first",
];

// ---------------------------------------------------------------- routing
const routes = { "": home, fixtures, players: playersPage, player, teams: teamsPage, team: (a, q) => marketPage("team", a, q), venue: (a, q) => marketPage("venue", a, q), pair, props, ask: askPage, about };

async function boot() {
  try {
    store = await createStore({ base: "data/" });
  } catch (e) {
    app.replaceChildren(h("div", { class: "card err" }, h("h2", {}, "Data not found"), h("p", {}, `Could not load data files (${e.message}). Run the site build first: see docs/SITE.md.`)));
    return;
  }
  rz = new Resolver(store);
  document.getElementById("fresh").replaceChildren(...freshText(store).flat(Infinity).map((x) => (x instanceof Node ? x : document.createTextNode(x))));
  window.addEventListener("hashchange", render);
  render();
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, qs] = raw.split("?");
  const [name, ...args] = path.split("/");
  return { name, args, q: Object.fromEntries(new URLSearchParams(qs || "")) };
}
const go = (path, q = {}) => {
  const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v != null && v !== "")).toString();
  location.hash = `#/${path}${qs ? `?${qs}` : ""}`;
};

async function render() {
  const { name, args, q } = parseHash();
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === `#/${name}`));
  const page = routes[name] || home;
  app.replaceChildren(h("p", { class: "muted pad" }, "Crunching…"));
  try {
    const el = await page(args, q);
    app.replaceChildren(el);
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    app.replaceChildren(h("div", { class: "card err" }, h("p", {}, `Something went wrong: ${e.message}`)));
  }
}

// ---------------------------------------------------------------- ask (LLM → plan, with a built-in fallback)
export async function interpret(question) {
  let llm = null;
  try {
    const r = await fetch("api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
    if (r.ok) llm = await r.json();
  } catch { /* offline or no function: fall through */ }
  const local = parseQuestion(question, rz, store);
  if (llm?.plan && llm.plan.kind !== "unknown") {
    const res = await runPlan(store, rz, llm.plan);
    if (res.ok) return { res, source: `AI parse (${llm.model || "Gemini free tier"}) · numbers computed from the data` };
    const res2 = await runPlan(store, rz, local);
    if (res2.ok) return { res: res2, source: "built-in parser (the AI reading could not be resolved)" };
    return { res, source: "AI parse" };
  }
  const res = await runPlan(store, rz, local);
  return { res, source: llm?.error ? "built-in parser (AI unavailable)" : "built-in parser" };
}

function askBox(initial = "", onResult) {
  const ta = h("textarea", { placeholder: "e.g. Harry Brook ODI sixes over 0.5 away from England", "aria-label": "Your question", maxlength: 300 }, initial);
  const out = h("div");
  const btn = h("button", { type: "submit" }, "Ask");
  const run = async (q) => {
    if (!q.trim()) return;
    btn.disabled = true; btn.textContent = "Working…";
    out.replaceChildren(h("p", { class: "muted" }, "Reading your question…"));
    try {
      const { res, source } = await interpret(q.trim());
      out.replaceChildren(renderResult(res, { source }));
      onResult?.(res);
    } catch (e) { out.replaceChildren(h("div", { class: "card err" }, e.message)); }
    btn.disabled = false; btn.textContent = "Ask";
  };
  const form = h("form", { class: "ask", onsubmit: (e) => { e.preventDefault(); history.replaceState(null, "", `#/ask?q=${encodeURIComponent(ta.value)}`); run(ta.value); } },
    ta, h("div", { class: "row" }, btn, h("span", { class: "muted small" }, "Typos are fine. Numbers always come from the data, never from the AI.")),
    h("div", { class: "examples" }, EXAMPLES.map((x) => h("button", { type: "button", onclick: () => { ta.value = x; form.requestSubmit(); } }, x))));
  if (initial) queueMicrotask(() => run(initial));
  return h("div", {}, form, out);
}

// ---------------------------------------------------------------- pages
async function home() {
  const fx = await upcoming(8);
  return h("div", {},
    h("div", { class: "hero" }, h("h1", {}, "Cricket player props, from the real data"),
      h("p", { class: "muted" }, `Hit rates over any line, fair decimal odds, partnerships and fancy markets from ${store.meta.matches.toLocaleString()} matches since 2001 (men's and women's). Ask in your own words or browse.`)),
    askBox(""),
    h("h2", {}, "Next matches"), fixtureList(fx),
    h("p", {}, h("a", { href: "#/fixtures" }, "All fixtures →"), " · ", h("a", { href: "#/props" }, "Prop Hunter: best-value props →")));
}

async function upcoming(limit = 200) {
  const fx = await store.loadFixtures();
  const cut = new Date(Date.now() - 4 * 3600e3).toISOString();
  return fx.filter((f) => (f.start.length > 10 ? f.start : `${f.start}T23:59Z`) >= cut).slice(0, limit);
}

function fixtureList(fx) {
  if (!fx.length) return h("p", { class: "muted" }, "No upcoming fixtures in the schedule files right now.");
  const when = (s) => (s.length > 10 ? new Date(s).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : s);
  const link = (name, ix) => (ix >= 0 ? h("a", { href: `#/team/${ix}` }, name) : name);
  return h("div", { class: "card" }, table(["When", "Match", "Format", "Venue", "Source"], fx.map((f) => [when(f.start),
    h("span", {}, link(f.a, f.a_ix), " v ", link(f.b, f.b_ix), f.gender === "female" ? " (W)" : ""), f.fmt || "?", f.venue || "–",
    h("span", { class: "badge" }, f.source === "markets" ? "bookmaker markets" : "schedule")])));
}

async function fixtures() {
  const fx = await upcoming();
  return h("div", {}, h("h1", {}, "Fixtures"), h("p", { class: "muted" }, "Internationals and leagues from the schedule scrape plus matches that currently have player-prop markets. Times are in your local time zone."),
    fixtureList(fx), h("p", { class: "muted small" }, "Coverage is limited to what the free sources list; see Rules for details."));
}

function playerSource(text) {
  return rz.players(text, {}, 8).map((p) => ({ label: p.name, sub: `${store.teamName(p.team)} · last ${p.last.slice(0, 4)}`, value: p.idx }));
}

async function playersPage(_, q) {
  const input = h("input", { type: "search", placeholder: "Search a player (typos ok)", value: q.q || "", "aria-label": "Search players", style: "width:100%" });
  const list = h("div");
  const draw = () => {
    const t = input.value.trim();
    if (t.length < 2) { list.replaceChildren(h("p", { class: "muted" }, "Type at least two letters.")); return; }
    const c = rz.players(t, {}, 20);
    list.replaceChildren(table(["Player", "Team", "Formats", "Last match", "Innings/spells"], c.map((p) => [h("a", { href: `#/player/${p.idx}` }, p.name),
      store.teamName(p.team), FORMATS.filter((_, i) => (store.P.fm[p.idx] >> i) & 1).join(" "), p.last, store.P.n[p.idx]])));
  };
  input.addEventListener("input", draw);
  draw();
  return h("div", {}, h("h1", {}, "Players"), input, list);
}

function field(label, el) { return h("label", {}, label, el); }
const sel = (name, opts, val) => h("select", { name }, opts.map(([v, l]) => h("option", { value: v, selected: String(v) === String(val ?? "") }, l)));
const inp = (name, val, attrs = {}) => h("input", { name, value: val ?? "", ...attrs });

function datalists() {
  return [h("datalist", { id: "dl-teams" }, [...new Set(store.teams.map((t) => t.n))].map((n) => h("option", { value: n }))),
    h("datalist", { id: "dl-venues" }, store.venues.map((n) => h("option", { value: n })))];
}

async function player(args, q) {
  const idx = Number(args[0]);
  if (!(idx >= 0 && idx < store.P.id.length)) return h("p", {}, "Unknown player.");
  const name = store.playerName(idx);
  const fm = store.P.fm[idx];
  const fmts = FORMATS.map((f, i) => [i, f]).filter(([i]) => (fm >> i) & 1);
  const fmtVal = q.fmt ?? (fmts.length ? fmts[0][0] : 0);
  const form = h("form", { class: "card row", onsubmit: (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); go(`player/${idx}`, f); } },
    field("Format", sel("fmt", fmts, fmtVal)),
    field("Stat", sel("stat", Object.entries(STATS).map(([k, v]) => [k, v.label]), q.stat || "runs")),
    field("Line", inp("line", q.line, { type: "number", step: "0.5", placeholder: "e.g. 0.5", style: "width:90px" })),
    field("Side", sel("side", [["over", "Over"], ["under", "Under"]], q.side || "over")),
    field("Opposition", inp("opp", q.opp, { list: "dl-teams", style: "width:150px" })),
    field("Venue", inp("venue", q.venue, { list: "dl-venues", style: "width:170px" })),
    field("Home/away", sel("vt", [["", "any"], ["home", "home"], ["away", "away"], ["neutral", "neutral"]], q.vt)),
    field("Innings", sel("inn", [["", "any"], ["first", "batting first"], ["second", "chasing"]], q.inn)),
    field("Position", sel("pos", [["", "any"], ["1-2", "openers"], ["1-3", "top 3"], ["4-6", "middle"], ["7-11", "lower"], ...Array.from({ length: 11 }, (_, i) => [`${i + 1}`, `No. ${i + 1}`])], q.pos)),
    field("From", inp("since", q.since, { type: "date" })), field("To", inp("until", q.until, { type: "date" })),
    field("Last N", inp("last", q.last, { type: "number", min: "1", style: "width:70px" })),
    field("Competition", inp("comp", q.comp, { placeholder: "IPL, BBL…", style: "width:110px" })),
    field("Level", sel("lvl", [["", "all"], ["intl", "international"], ["club", "club / league"]], q.lvl)),
    h("button", { type: "submit" }, "Update"));
  const plan = {
    kind: "player_prop", stat: q.stat || "runs", line: q.line !== undefined && q.line !== "" ? Number(q.line) : null, side: q.side || "over",
    competition: q.comp || null, split_by: SPLITS,
    filters: { format: FORMATS[fmtVal], opposition: q.opp || null, venue_type: q.vt || null, innings: q.inn || null, position: q.pos || null,
      since: q.since || null, until: q.until || null, last_n: q.last ? Number(q.last) : null, international: q.lvl === "intl" ? true : q.lvl === "club" ? false : null },
    venue: q.venue || null,
  };
  const res = await runPlan(store, rz, plan, { playerIdx: idx });
  return h("div", {}, h("h1", {}, name), h("p", { class: "muted" }, `${store.teamName(store.P.tm[idx])} · last played ${store.P.last[idx]}`), ...datalists(), form, renderResult(res));
}

async function teamsPage(_, q) {
  const tab = q.tab === "venues" ? "venues" : "teams";
  const input = h("input", { type: "search", placeholder: `Search ${tab}`, style: "width:100%", value: q.q || "" });
  const list = h("div");
  const counts = tab === "teams" ? rz.teamCount : rz.venueCount;
  const names = tab === "teams" ? store.teams.map((t, i) => store.teamName(i)) : store.venues;
  const draw = () => {
    const t = input.value.trim().toLowerCase();
    const rows = names.map((n, i) => [n, i]).filter(([n]) => !t || n.toLowerCase().includes(t)).sort((a, b) => counts[b[1]] - counts[a[1]]).slice(0, 60);
    list.replaceChildren(table([tab === "teams" ? "Team" : "Venue", "Matches"], rows.map(([n, i]) => [h("a", { href: `#/${tab === "teams" ? "team" : "venue"}/${i}` }, n), counts[i]])));
  };
  input.addEventListener("input", draw);
  draw();
  return h("div", {}, h("h1", {}, "Teams & venues"),
    h("div", { class: "tabs" }, h("button", { class: tab === "teams" ? "on" : "", onclick: () => go("teams", { tab: "teams" }) }, "Teams"), h("button", { class: tab === "venues" ? "on" : "", onclick: () => go("teams", { tab: "venues" }) }, "Venues")),
    input, list);
}

async function marketPage(kind, args, q) {
  const idx = Number(args[0]);
  const isTeam = kind === "team";
  const label = isTeam ? store.teamName(idx) : store.venueName(idx);
  const fmt = q.fmt ?? "T20";
  const form = h("form", { class: "card row", onsubmit: (e) => { e.preventDefault(); go(`${kind}/${idx}`, Object.fromEntries(new FormData(e.target))); } },
    field("Format", sel("fmt", FORMATS.map((f) => [f, f]), fmt)),
    isTeam ? field("Opposition", inp("opp", q.opp, { list: "dl-teams", style: "width:150px" })) : null,
    isTeam ? field("Home/away", sel("vt", [["", "any"], ["home", "home"], ["away", "away"], ["neutral", "neutral"]], q.vt)) : null,
    field("Market", sel("market", [["", "all markets"], ["match_sixes", "match sixes"], ["match_fours", "match fours"], ["match_runs", "match runs"], ["match_30s", "30s"], ["match_50s", "50s"], ["highest_over", "highest over"], ["max_conceded", "most conceded by a bowler"], ["top_score", "top score"]], q.market)),
    field("Line", inp("line", q.line, { type: "number", step: "0.5", style: "width:90px" })),
    field("From", inp("since", q.since, { type: "date" })), field("To", inp("until", q.until, { type: "date" })),
    field("Last N", inp("last", q.last, { type: "number", min: "1", style: "width:70px" })),
    h("button", { type: "submit" }, "Update"));
  const plan = { kind: "match_market", market: q.market || null, line: q.line ? Number(q.line) : null, side: "over",
    filters: { format: fmt, opposition: q.opp || null, venue_type: q.vt || null, since: q.since || null, until: q.until || null, last_n: q.last ? Number(q.last) : null,
      gender: isTeam ? (store.genderOfTeam(idx) ? "female" : "male") : null } };
  const hints = isTeam ? { teamIdx: idx } : { venueIdx: idx };
  const [res, top] = await Promise.all([runPlan(store, rz, plan, hints), runPlan(store, rz, { ...plan, kind: "top_batter", market: null }, hints)]);
  return h("div", {}, h("h1", {}, label), h("p", { class: "muted" }, isTeam ? "Match and team-specific markets (team markets count only matches where this team batted first)." : "Match markets at this venue."), ...datalists(), form,
    renderResult(res), h("h2", {}, isTeam ? "Top batter (team batting first)" : "Top batter in the match"), renderResult(top));
}

async function pair(_, q) {
  const state = { a: q.a != null ? Number(q.a) : null, b: q.b != null ? Number(q.b) : null };
  const mk = (key, ph) => {
    const i = h("input", { placeholder: ph, value: state[key] != null ? store.playerName(state[key]) : "", style: "width:200px" });
    const wrap = h("div", {}, i);
    queueMicrotask(() => suggest(i, playerSource, (it) => { state[key] = it.value; }));
    return wrap;
  };
  const ia = mk("a", "Batter 1 (e.g. Duckett)"), ib = mk("b", "Batter 2 (e.g. Banton)");
  const fmtSel = sel("fmt", [["", "auto"], ...FORMATS.map((f) => [f, f])], q.fmt);
  const open = h("input", { type: "checkbox", name: "open", checked: q.open === "1" });
  const opp = inp("opp", q.opp, { list: "dl-teams", style: "width:150px" });
  const ven = inp("venue", q.venue, { list: "dl-venues", style: "width:170px" });
  const vt = sel("vt", [["", "any"], ["home", "home"], ["away", "away"], ["neutral", "neutral"]], q.vt);
  const form = h("form", { class: "card row", onsubmit: (e) => { e.preventDefault(); go("pair", { a: state.a, b: state.b, fmt: fmtSel.value, open: open.checked ? "1" : "", opp: opp.value, venue: ven.value, vt: vt.value }); } },
    field("Batter 1", ia), field("Batter 2", ib), field("Format", fmtSel), field("Opening pair only", open), field("Opposition", opp),
    field("Venue", ven), field("Home/away", vt),
    h("button", { type: "submit" }, "Compare"));
  let result = h("p", { class: "muted" }, "Pick two batters to see who gets out first, and how big their stands are.");
  if (state.a != null && state.b != null) {
    const res = await runPlan(store, rz, { kind: "partnership", opening: q.open === "1", filters: { format: q.fmt || null, opposition: q.opp || null, venue_type: q.vt || null }, venue: q.venue || null }, { playerIdx: state.a, player2Idx: state.b });
    result = renderResult(res);
  }
  return h("div", {}, h("h1", {}, "Partnerships"), h("p", { class: "muted" }, "For any pair: who is dismissed first, stand sizes, split by format, opposition and venue. Needs ball-by-ball data, so only Cricsheet-published matches count."), ...datalists(), form, result);
}

async function props() {
  const RAW = "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/value_bets/out/value_bets_latest.json";
  let snap = null, live = false;
  try { snap = await (await fetch("data/props.json")).json(); } catch { /* none */ }
  try {
    const r = await fetch(RAW, { cache: "no-cache" });
    if (r.ok) {
      const d = await r.json();
      if (!snap || (d.generated_at_utc || "") >= (snap.generated_at_utc || "")) { snap = { ...snap, ...d, value_bets: d.value_bets, recent_alerts: snap?.recent_alerts || [] }; live = true; }
    }
  } catch { /* offline: bundled snapshot */ }
  if (!snap) return h("div", { class: "card" }, "Prop Hunter data is not available yet.");
  const now = Date.now();
  const bets = (snap.value_bets || []).filter((b) => !b.start_utc || Date.parse(b.start_utc) > now - 3600e3).sort((a, b) => b.edge_pct - a.edge_pct);
  const link = (b) => { const nm = (b.player_matched_as || (b.selection || "").replace(/\s+(over|under|\d+\+).*$/i, "")).trim(); const p = nm && rz.player(nm); return p ? h("a", { href: `#/player/${p.idx}` }, b.selection) : b.selection; };
  const rows = (list) => list.map((b) => [b.start_ist || "", b.match, b.market, link(b), h("span", { class: "odds" }, odds(b.best_odds)), h("span", { class: "odds" }, odds(b.fair_odds)),
    b.edge_pct != null ? `${b.edge_pct}%` : "–", b.kelly_quarter_stake_pct != null ? `${b.kelly_quarter_stake_pct}%` : "–", b.best_source || ""]);
  const cols = ["Start (IST)", "Match", "Market", "Selection", "Best odds", "Fair odds", "Edge", "¼-Kelly stake", "Source"];
  const hist = (snap.recent_alerts || []).slice().reverse().filter((b) => !bets.some((x) => x.selection === b.selection && x.match === b.match));
  return h("div", {}, h("h1", {}, "Prop Hunter"),
    h("p", { class: "muted" }, "Player-prop value bets for upcoming matches, produced hourly by the repo's value-bets pipeline (free odds sources vs the model). Decimal odds. Not betting advice: most edges are information the model lacks (XIs, batting order, pitch, injuries)."),
    h("p", { class: "small" }, h("span", { class: `badge ${live ? "live" : ""}` }, live ? "live from GitHub" : "bundled snapshot"), ` generated ${snap.generated_at_ist || "?"}`),
    bets.length ? h("div", { class: "card" }, table(cols, rows(bets))) : h("div", { class: "card" }, h("p", {}, "No value bets passed the filters in the latest run."),
      h("p", { class: "muted small" }, `Markets priced: ${snap.stats?.markets_in_window ?? "?"} across ${snap.stats?.events_in_window ?? "?"} matches in the next 24 h; sources: ${Object.entries(snap.sources || {}).map(([k, v]) => `${k} ${v.status}`).join(", ") || "n/a"}.`)),
    bets.length ? h("details", {}, h("summary", {}, "Why each bet"), h("ul", {}, bets.map((b) => h("li", { class: "small" }, h("b", {}, b.selection), `: ${b.why || b.notes || ""}`)))) : null,
    hist.length ? [h("h2", {}, "Recent alerts"), h("div", { class: "card" }, table(["Alerted", "Match", "Market", "Selection", "Odds", "Fair", "Edge"], hist.slice(0, 25).map((b) => [b.alerted_at_ist, b.match, b.market, b.selection, h("span", { class: "odds" }, odds(b.best_odds)), h("span", { class: "odds" }, odds(b.fair_odds)), `${b.edge_pct}%`])))] : null);
}

async function askPage(_, q) {
  return h("div", {}, h("h1", {}, "Ask anything"), h("p", { class: "muted" }, "Write your question your own way. A free AI model only turns it into a structured query; the site then runs that query on the real data and shows the filters used and the sample size."), askBox(q.q || ""));
}

async function about() {
  return h("div", {}, h("h1", {}, "Rules, definitions and data"),
    h("div", { class: "card" }, h("h3", {}, "Settlement rules applied"), h("ul", {}, RULES.map((r) => h("li", {}, r)))),
    h("div", { class: "card" }, h("h3", {}, "Definitions"), h("ul", {},
      h("li", {}, "Fair decimal odds = 1 ÷ hit rate on the filtered sample. Pushes (whole-number lines) are void. A 90% interval shows how far small samples can mislead."),
      h("li", {}, "Home / away / neutral is inferred from the event ('X tour of Y'), the venue's country and the team that plays most at the ground: Cricsheet has no home flag."),
      h("li", {}, "Batting position is the order batters first appear at the crease. Batting first / chasing is the player's team."),
      h("li", {}, "Runs conceded include penalty runs, exclude byes and leg byes. Super overs are ignored."),
      h("li", {}, "Provisional (scraped) matches fill the gap before Cricsheet publishes: they carry player totals only, so they feed player props but not partnerships, batting position, innings order or match markets."))),
    h("div", { class: "card" }, h("h3", {}, "Data freshness"), h("p", {}, ...freshText(store))));
}

boot();
