import { parseQuestion } from "./engine/nl.js";
import { runPlan } from "./engine/plan.js";
import { Resolver } from "./engine/resolve.js";
import { RULES, STATS } from "./engine/rules.js";
import { createStore } from "./engine/store.js";
import { FORMATS } from "./engine/util.js";
import { renderResult } from "./render.js";
import { loadIonic } from "./ionic.js";
import { playerScreen } from "./playerapp.js";
import { SPLITS } from "./engine/props.js";
import { loadPhotos, playerBadge, teamBadge } from "./assets.js";
import { STATS as STATDEF } from "./engine/rules.js";
import { collectGrid, gridTable, initPages, fixturePage, trendsPage, competitionsPage, leaguePage, toolsPage, featuresPage, oddsPage, glossaryPage } from "./pages2.js";
import { Accordion, Badge, PageSkeleton, TabsList, toast } from "./shadcn.js";
import { fromIst, hashQuery, live, localTime, localWhen, chips, freshText, h, odds, pc, suggest, table } from "./ui.js";

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
const routes = { fixture: fixturePage, trends: trendsPage, competitions: competitionsPage, league: leaguePage, tools: toolsPage, features: featuresPage, odds: oddsPage, glossary: glossaryPage, saved: savedPage, "": home, fixtures: home, players: playersPage, player, teams: teamsPage, team: (a, q) => marketPage("team", a, q), venue: (a, q) => marketPage("venue", a, q), pair, props, ask: askPage, about };

function pathToHash() {
  if (location.pathname !== "/" && !location.hash) {
    const p = location.pathname.replace(/^\/|\/$/g, "");
    history.replaceState(null, "", "/");
    location.hash = `#/${p}${location.search}`;
  }
}

const TITLES = { "": "Cricket fixtures, player props and stats", players: "Cricket player stats", player: "Player stats, hit rates and form chart", teams: "Teams and venues", team: "Team stats and player grid", venue: "Venue stats", props: "Prop Hunter: value cricket props", pair: "Batting partnerships", ask: "Ask anything about cricket stats", about: "Rules and data", fixture: "Match preview, player grid and trends", trends: "Player trends", competitions: "Cricket competitions", league: "Competition stats", tools: "Free cricket betting tools", odds: "Odds and probability calculator", glossary: "Cricket stats explained", saved: "Saved" };
function drawFooter() {
  const f = document.getElementById("foot");
  const col = (t, items) => h("div", {}, h("h4", {}, t), items.map(([l, hr]) => h("a", { href: hr }, l)));
  f.replaceChildren(h("div", { class: "fcols" }, col("Tools & features", [["Free tools", "#/tools"], ["Player trends", "#/trends"], ["Prop Hunter", "#/props"], ["Odds calculator", "#/odds"], ["Partnerships", "#/pair"], ["Ask anything", "#/ask"]]),
    col("Popular competitions", [["IPL", "#/competitions?q=indian premier"], ["Big Bash", "#/competitions?q=big bash"], ["PSL", "#/competitions?q=pakistan super"], ["World Cups", "#/competitions?q=world cup"], ["All competitions", "#/competitions"]]),
    col("Resources", [["Cricket stats explained", "#/glossary"], ["Rules & data", "#/about"], ["Saved", "#/saved"], ["Cricsheet", "https://cricsheet.org"]])),
    h("div", { class: "fcopy" }, "Free cricket stats and player props. Photos: Wikimedia Commons (free licences, where available). Data: Cricsheet ball-by-ball (ODbL) plus provisional scorecards. Decimal odds only; fair odds are 1 ÷ historical hit rate with no margin: a guide, not betting advice. 18+, gamble responsibly."));
  f.hidden = false;
}

async function boot() {
  pathToHash();
  try {
    store = await createStore({ base: "data/" });
  } catch (e) {
    app.replaceChildren(h("div", { class: "card err" }, h("h2", {}, "Data not found"), h("p", {}, `Could not load data files (${e.message}). Run the site build first: see docs/SITE.md.`)));
    return;
  }
  rz = new Resolver(store);
  loadIonic(); // starts in the background; pages that use it wait for it
  await loadPhotos("data/");
  document.getElementById("fresh").replaceChildren(...freshText(store).flat(Infinity).map((x) => (x instanceof Node ? x : document.createTextNode(x))));
  initPages({ store, rz, go, crumbs, heroCard, nextCountdown: (when) => nextMatchCard({ a: "", b: "", start: when.toISOString(), venue: "", countdownOnly: true }) });
  initSearch();
  drawFooter();
  window.addEventListener("hashchange", render);
  render();
}

function initSearch() {
  const input = document.getElementById("gs");
  suggest(input, (t) => {
    if (t.length < 2) return [];
    const ps = rz.players(t, {}, 5).map((p) => ({ label: p.name, sub: `${store.teamName(p.team)}`, href: `#/player/${p.idx}` }));
    const tm = rz.team(t) ? [{ label: rz.team(t).name, sub: "team", href: `#/team/${rz.team(t).idx}` }] : [];
    return [...tm, ...ps];
  }, (it) => { input.value = ""; location.hash = it.href; });
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

let lastRoute = "";
async function render() {
  const { name, args, q } = parseHash();
  document.querySelectorAll("ion-modal.sheet").forEach((m) => m.dismiss()); // any navigation (a filter applied, a link) closes open sheets
  const cur = name === "fixtures" ? "" : name;
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === cur));
  document.querySelectorAll("#tabbar a").forEach((a) => a.classList.toggle("on", a.dataset.r === (["player", "team", "venue"].includes(cur) ? { player: "players", team: "teams", venue: "teams" }[cur] : cur === "pair" ? "teams" : cur)));
  const page = routes[name] || home;
  document.body.classList.toggle("app-screen", name === "player"); // the player page is an app screen with its own bar
  document.title = `${TITLES[cur] || "Cricket Props Hub"} | Cricket Props Hub`;
  const same = lastRoute === `${name}/${args.join("/")}`; // only a filter changed: keep the page and the scroll position
  lastRoute = `${name}/${args.join("/")}`;
  if (!same) app.replaceChildren(PageSkeleton());
  try {
    const y = window.scrollY;
    const el = await page(args, q);
    app.replaceChildren(el);
    window.scrollTo(0, same ? y : 0);
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
const SAVE_KEY = "cph-saved";
const getSaved = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "[]"); } catch { return []; } };
const setSaved = (l) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(l)); } catch { /* private mode */ } };
const star = (kind, idx) => {
  const key = `${kind}:${idx}`;
  const b = h("button", { type: "button", class: "star", "aria-label": "Save", onclick: () => { const l = getSaved(); const i = l.indexOf(key); i >= 0 ? l.splice(i, 1) : l.push(key); setSaved(l); b.classList.toggle("on", i < 0); toast(i < 0 ? "Saved. Find it under Saved." : "Removed from Saved"); } },
    h("span", { html: '<svg class="i" viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>' }));
  b.classList.toggle("on", getSaved().includes(key));
  return b;
};
async function savedPage() {
  const l = getSaved();
  const items = l.map((k) => { const [kind, i] = k.split(":"); return kind === "player" ? { href: `#/player/${i}`, name: store.playerName(+i), sub: store.teamName(store.P.tm[+i]), b: playerBadge(store, +i) } : { href: `#/team/${i}`, name: store.teamName(+i), sub: "Team", b: teamBadge(store.teams[+i].n) }; });
  return h("div", {}, crumbs(["Home", "#/"], ["Saved"]), h("h1", {}, "Saved"),
    items.length ? h("div", { class: "card flat" }, items.map((it) => h("a", { class: "match", href: it.href }, h("div", { class: "teams" }, h("div", { class: "tm" }, it.b, it.name)), h("div", { class: "meta" }, it.sub), h("span", { class: "arrow" }, "→"))))
      : h("div", { class: "card muted" }, "Tap the star on a player or team to keep it here. Saved items live in this browser only."));
}
const crumbs = (...items) => h("div", { class: "crumbs" }, items.flatMap((it, i) => [i ? h("span", { class: "sep" }, "›") : null,
  i === items.length - 1 ? h("span", { class: "cur" }, it[0]) : h("a", { href: it[1] }, it[0])]));

/** StatsHub-style hero card: crest, name, meta pills and in-card tabs that switch the page sections. */
function heroCard({ name, sub, meta = [], cls = "", badge = null, tabs = [], save = null }, root) {
  const list = tabs.length ? TabsList(tabs, tabs[0][0], (id) => { set(id); const q = hashQuery(); q.tab = id; history.replaceState(null, "", `#/${location.hash.slice(2).split("?")[0]}?${new URLSearchParams(q)}`); }) : null;
  const bar = h("div", { class: "hero-tabs" }, list);
  const set = (id) => {
    if (!tabs.some(([t]) => t === id)) id = tabs[0]?.[0];
    list?.select(id);
    root.querySelectorAll("[data-sec]").forEach((el) => { el.hidden = el.dataset.sec !== id; });
  };
  const el = h("div", { class: `hero-card ${cls}` }, save ? h("div", { class: "hero-star" }, star(save[0], save[1])) : null, h("div", { class: "hero-top" }, badge || h("div", { class: "crest" }, initials(name)), h("h1", { class: "hero-name" }, name),
    sub ? h("p", {}, sub) : null, meta.length ? h("div", { class: "hero-meta" }, meta.map((m) => h("span", {}, m))) : null), tabs.length ? bar : null);
  return { el, set: (id) => tabs.length && set(id || tabs[0][0]) };
}
const pretty = (s) => (s || "").replace(/-/g, " ").replace(/\b(\d{4})\b/g, "$1").replace(/\b[a-z]/g, (c) => c.toUpperCase());
const initials = (n) => n.replace(/\(W\)/, "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
const dayKey = (f) => (f.start.length > 10 ? new Date(f.start) : new Date(`${f.start}T12:00:00`)).toLocaleDateString("en-CA");
const dayLabel = (k, i) => {
  const d = new Date(`${k}T12:00:00`), t = new Date();
  const diff = Math.round((new Date(`${k}T12:00:00`) - new Date(`${t.toLocaleDateString("en-CA")}T12:00:00`)) / 864e5);
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

async function home(_, q = {}) {
  const fx = await upcoming();
  const days = [...new Set(fx.map(dayKey))].slice(0, 12);
  const sel_ = days.includes(q.d) ? q.d : days[0];
  const state = { g: "all", f: "all" };
  const body = h("div");
  const tabs = h("div", { class: "dtabs" }, days.map((k) => h("button", { class: k === sel_ ? "on" : "", onclick: () => go("", { d: k }) }, dayLabel(k), h("small", {}, String(fx.filter((f) => dayKey(f) === k).length)))));
  const chipRow = h("div", { class: "strip" });
  const draw = () => {
    chipRow.replaceChildren(...[["all", "ALL"], ["T20", "T20"], ["ODI", "ODI"], ["Test", "TEST"], ["male", "MEN"], ["female", "WOMEN"]].map(([v, l]) =>
      h("button", { class: (v === state.f ? "on" : ""), onclick: () => { state.f = v; draw(); } }, l)));
    const list = fx.filter((f) => dayKey(f) === sel_ && (state.f === "all" || f.fmt === state.f || f.gender === state.f));
    body.replaceChildren(fixtureGroups(list));
  };
  draw();
  const side = await sidebar();
  return h("div", {}, landing(), h("div", { class: "layout has-side" }, h("div", {},
    h("h1", {}, "Today's cricket fixtures, player stats & team stats"),
    h("p", { class: "muted" }, new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })),
    h("p", { class: "muted" }, `Hit rates over any line, fair decimal odds, partnerships and fancy markets from ${store.meta.matches.toLocaleString()} matches since 2001, men's and women's.`),
    tabs, chipRow, h("div", { class: "sec-title" }, days.length ? "Matches" : "No upcoming fixtures"), body,
    h("p", { class: "muted small" }, "Coverage is what the free schedule scrape and odds sources list. Times are in your local time zone.")), side));
}

function landing() {
  const words = ["T20", "ODI", "TEST", "IPL", "BBL", "PSL", "T20I", "WOMEN'S", "THE HUNDRED", "SA20", "CPL", "LIST A"];
  const feats = [["BALL-BY-BALL DEPTH", "Batting position, innings order, partnerships and 20+ years of Cricsheet data behind every number."],
    ["FIND THE EDGE", "Hit rates over any line, fair decimal odds and the exchange void rules built in."],
    ["ADVANCED FILTERS", "Format, opposition, venue, home/away, batting first or chasing, position and dates."],
    ["CORRELATED PROPS", "When a line clears, see how often the player's other props clear too."]];
  return h("section", { class: "lp" },
    h("div", { class: "lp-copy" }, h("h1", { class: "lp-h" }, "FIND THE", h("br"), h("span", {}, "EDGE")),
      h("p", { class: "muted lp-p" }, "Free cricket player props: scan hit rates over any line, DNP-aware form charts, partnerships and fancy markets, then compare with the market in Prop Hunter."),
      h("div", { class: "pills" }, h("a", { class: "btn", href: "#/ask" }, "Ask a question →"), h("a", { class: "btn ghost", href: "#/props" }, "Open Prop Hunter"))),
    h("div", { class: "marq", "aria-hidden": "true" }, h("div", { class: "marq-in" }, [...words, ...words].map((w) => h("span", {}, w)))),
    h("div", { class: "lp-feats" }, feats.map(([t, d]) => h("div", { class: "lp-f" }, h("h3", {}, t), h("p", { class: "muted small" }, d)))));
}

async function sidebar() {
  let snap = null;
  try { snap = await (await fetch("data/props.json")).json(); } catch { /* none */ }
  const bets = (snap?.value_bets || []).slice(0, 5);
  const alerts = (snap?.recent_alerts || []).slice(-5).reverse();
  const rows = bets.length ? bets.map((b) => ({ t: b.selection, s: `${b.match} · ${b.market}`, o: b.best_odds })) : alerts.map((b) => ({ t: b.selection, s: `${b.match} · ${b.market}`, o: b.best_odds }));
  return h("aside", { class: "side" },
    h("div", { class: "banner" }, h("div", { class: "t" }, h("div", { class: "k" }, "● PROP HUNTER"), h("div", { class: "v" }, bets.length ? `${bets.length} value bets now` : "Best-value props"),
      h("a", { class: "go", href: "#/props", style: "display:inline-block;margin-top:10px" }, "Open Prop Hunter →"))),
    h("div", { class: "card" }, h("h3", {}, bets.length ? "Top value bets" : "Recent alerts"),
      rows.length ? h("div", { class: "mini" }, rows.map((r) => h("a", { href: "#/props" }, h("span", {}, r.t, h("small", {}, r.s)), h("span", { class: "odds" }, odds(r.o))))) : h("p", { class: "muted small" }, "Nothing flagged right now.")),
    h("div", { class: "card" }, h("h3", {}, "Ask anything"), h("p", { class: "muted small" }, "Write your question your own way; typos are fine."),
      h("a", { class: "btn", href: "#/ask" }, "Ask a question")));
}

async function upcoming() {
  const fx = await store.loadFixtures();
  const cut = new Date(Date.now() - 4 * 3600e3).toISOString();
  return fx.filter((f) => (f.start.length > 10 ? f.start : `${f.start}T23:59Z`) >= cut);
}

function nextMatchCard(f) {
  const when = f.start.length > 10 ? new Date(f.start) : new Date(`${f.start}T12:00:00`);
  const cd = h("div", { class: "cd" });
  const tick = () => {
    const ms = Math.max(0, when - Date.now()), d = Math.floor(ms / 864e5), hh = Math.floor(ms / 36e5) % 24, mm = Math.floor(ms / 6e4) % 60;
    cd.replaceChildren(...[[d, "d"], [String(hh).padStart(2, "0"), "h"], [String(mm).padStart(2, "0"), "m"]].map(([v, u]) => h("div", {}, h("b", {}, String(v)), h("span", {}, u))));
  };
  tick();
  const id = setInterval(() => { if (!cd.isConnected) clearInterval(id); else tick(); }, 30000);
  if (f.countdownOnly) return h("div", { class: "card nextm" }, h("div", { class: "nm-c" }, h("div", { class: "muted small" }, "Starts in"), cd));
  return h("div", { class: "card nextm" }, h("div", { class: "nm-h" }, h("h3", {}, "Next match"), h("span", { class: "chip" }, `${f.fmt || ""} ${f.gender === "female" ? "women" : "men"}`)),
    h("div", { class: "nm-b" }, h("div", { class: "nm-t" }, teamBadge(f.a, "crest"), h("b", {}, f.a)), h("div", { class: "nm-c" }, h("div", { class: "nm-time" }, f.start.length > 10 ? localTime(when) : "TBC"),
      h("small", { class: "muted" }, when.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })), h("div", { class: "muted small", style: "margin-top:8px" }, "Kicks off in"), cd), h("div", { class: "nm-t" }, teamBadge(f.b, "crest"), h("b", {}, f.b))),
    f.venue ? h("div", { class: "muted small", style: "text-align:center" }, f.venue) : null);
}

function fixtureGroups(fx) {
  if (!fx.length) return h("div", { class: "card muted" }, "Nothing scheduled for this selection.");
  const groups = new Map();
  for (const f of fx) {
    const key = f.series ? (f.series.includes(" ") ? f.series : pretty(f.series.replace(/-\d{4}$/, ""))) : f.source === "markets" ? "Matches with prop markets" : `${f.fmt || ""} ${f.gender === "female" ? "women's" : "men's"} cricket`.trim();
    (groups.get(key) || groups.set(key, []).get(key)).push(f);
  }
  const time = (s) => (s.length > 10 ? localTime(s) : "TBC");
  const promo = h("div", { class: "promo" }, h("h3", {}, "Unlock advanced stats"), h("p", { class: "muted" }, "Hit rates over any line, DNP-aware form charts and fair decimal odds for every player."),
    h("div", { class: "pills" }, h("a", { class: "btn", href: "#/props" }, "Prop Hunter →"), h("a", { class: "btn ghost", href: "#/ask" }, "Ask anything →")));
  const items = [...groups.entries()].map(([name, list], i) => ({
    open: i < 6,
    title: h("span", { class: "comp-title" }, h("span", { class: "badge-ico" }, list[0].fmt || "·"), h("span", { class: "ct" }, h("b", {}, name), h("span", {}, list[0].gender === "female" ? "Women" : "Men"))),
    meta: Badge(String(list.length), "secondary"),
    content: h("div", {}, list.map((f) => h("a", { class: "match", href: f.id ? `#/fixture/${f.id}` : f.a_ix >= 0 ? `#/team/${f.a_ix}` : "#/teams" },
      h("div", { class: "teams" }, h("div", { class: "tm" }, teamBadge(f.a), f.a), h("div", { class: "tm" }, teamBadge(f.b), f.b)),
      h("div", { class: "meta" }, h("b", {}, time(f.start)), f.venue || f.fmt || ""), h("span", { class: "arrow" }, "→")))),
  }));
  const acc = Accordion(items, { type: "multiple", cls: "cards" });
  if (items.length > 1) acc.children[0].after(promo);
  const cards = [acc];
  return h("div", { class: "stagger" }, cards);
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
    list.replaceChildren(table(["Player", "Team", "Formats", "Last match", "Innings/spells"], c.map((p) => [h("a", { class: "tm", href: `#/player/${p.idx}` }, playerBadge(store, p.idx), p.name),
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
  const fm = store.P.fm[idx];
  const fmts = FORMATS.map((f, i) => [i, f]).filter(([i]) => (fm >> i) & 1);
  const fmtVal = Number(q.fmt ?? (fmts.length ? fmts[0][0] : 0));
  await loadIonic();
  // The prop, format, line and side live on screen (rail, segments, chart); everything else is in the filter sheet.
  // hashQuery(), not q: the chart changes line / side locally and keeps them in the URL
  const moreFilters = h("form", { class: "sheet-form", onsubmit: (e) => { e.preventDefault(); go(`player/${idx}`, { ...hashQuery(), ...Object.fromEntries(new FormData(e.target)) }); } },
   h("div", { class: "filters" },
    field("Opposition", inp("opp", q.opp, { list: "dl-teams" })),
    field("Venue", inp("venue", q.venue, { list: "dl-venues" })),
    field("Home/away", sel("vt", [["", "any"], ["home", "home"], ["away", "away"], ["neutral", "neutral"]], q.vt)),
    field("Innings", sel("inn", [["", "any"], ["first", "batting first"], ["second", "chasing"]], q.inn)),
    field("Position", sel("pos", [["", "any"], ["1-2", "openers"], ["1-3", "top 3"], ["4-6", "middle"], ["7-11", "lower"], ...Array.from({ length: 11 }, (_, i) => [`${i + 1}`, `No. ${i + 1}`])], q.pos)),
    field("From", inp("since", q.since, { type: "date" })), field("To", inp("until", q.until, { type: "date" })),
    field("Last N", inp("last", q.last, { type: "number", min: "1" })),
    field("Competition", inp("comp", q.comp, { placeholder: "IPL, BBL…" })),
    field("Level", sel("lvl", [["", "all"], ["intl", "international"], ["club", "club / league"]], q.lvl))), ...datalists());
  live(moreFilters);
  const plan = {
    kind: "player_prop", stat: q.stat || "runs", line: q.line !== undefined && q.line !== "" ? Number(q.line) : null, side: q.side || "over",
    competition: q.comp || null, split_by: SPLITS,
    filters: { format: FORMATS[fmtVal], opposition: q.opp || null, venue_type: q.vt || null, innings: q.inn || null, position: q.pos || null,
      since: q.since || null, until: q.until || null, last_n: q.last ? Number(q.last) : null, international: q.lvl === "intl" ? true : q.lvl === "club" ? false : null },
    venue: q.venue || null,
  };
  const res = await runPlan(store, rz, plan, { playerIdx: idx });
  return playerScreen({ store, idx, q, res, go, star, playerBadge, teamBadge, fmts, fmtVal, stats: Object.entries(STATS).map(([k, v]) => [k, v.label]), moreFilters,
    back: () => (history.length > 1 ? history.back() : go("players")) });
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

/** StatsHub-style fixture grid: players down, the team's last fixtures across, cell = stat value (green when it clears the line). */
async function playerGrid(teamIdx, fmtName, q) {
  const stat = STATDEF[q.gstat] ? q.gstat : "sixes";
  const line = q.gline !== undefined && q.gline !== "" ? Number(q.gline) : 0.5;
  const out = h("div", { "data-sec": "grid" });
  out.append(h("form", { class: "card filters", onsubmit: (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); go(`team/${teamIdx}`, { ...q, gstat: f.gstat, gline: f.gline, tab: hashQuery().tab }); } },
    field("Stat", sel("gstat", Object.entries(STATDEF).map(([k, v]) => [k, v.label]), stat)), field("Line", inp("gline", line, { type: "number", step: "0.5", style: "width:90px" }))));
  live(out.querySelector("form"));
  const g = await collectGrid(teamIdx, fmtName, stat);
  out.append(gridTable(g, teamIdx, line), h("p", { class: "muted small" }, `${STATDEF[stat].label} over ${line} across this team's last ${g.fx.length} ${fmtName} fixtures. A dash means the player was not in the XI; VOID means he was in the XI but did not ${STATDEF[stat].side === "bat" ? "bat" : "bowl"}, so the bet is void.`));
  return out;
}

async function marketPage(kind, args, q) {
  const idx = Number(args[0]);
  const isTeam = kind === "team";
  const label = isTeam ? store.teamName(idx) : store.venueName(idx);
  const fmt = q.fmt ?? "T20";
  const form = h("form", { class: "card filters", onsubmit: (e) => { e.preventDefault(); go(`${kind}/${idx}`, { ...Object.fromEntries(new FormData(e.target)), tab: hashQuery().tab }); } },
    field("Format", sel("fmt", FORMATS.map((f) => [f, f]), fmt)),
    isTeam ? field("Opposition", inp("opp", q.opp, { list: "dl-teams", style: "width:150px" })) : null,
    isTeam ? field("Home/away", sel("vt", [["", "any"], ["home", "home"], ["away", "away"], ["neutral", "neutral"]], q.vt)) : null,
    field("Market", sel("market", [["", "all markets"], ["match_sixes", "match sixes"], ["match_fours", "match fours"], ["match_runs", "match runs"], ["match_30s", "30s"], ["match_50s", "50s"], ["highest_over", "highest over"], ["max_conceded", "most conceded by a bowler"], ["top_score", "top score"]], q.market)),
    field("Line", inp("line", q.line, { type: "number", step: "0.5", style: "width:90px" })),
    field("From", inp("since", q.since, { type: "date" })), field("To", inp("until", q.until, { type: "date" })),
    field("Last N", inp("last", q.last, { type: "number", min: "1", style: "width:70px" })));
  live(form);
  const plan = { kind: "match_market", market: q.market || null, line: q.line ? Number(q.line) : null, side: "over",
    filters: { format: fmt, opposition: q.opp || null, venue_type: q.vt || null, since: q.since || null, until: q.until || null, last_n: q.last ? Number(q.last) : null,
      gender: isTeam ? (store.genderOfTeam(idx) ? "female" : "male") : null } };
  const hints = isTeam ? { teamIdx: idx } : { venueIdx: idx };
  const [res, top] = await Promise.all([runPlan(store, rz, plan, hints), runPlan(store, rz, { ...plan, kind: "top_batter", market: null }, hints)]);
  const b1 = h("div", { "data-sec": "markets" }, form, renderResult(res)), b2 = h("div", { "data-sec": "top" }, h("h2", {}, isTeam ? "Top batter (team batting first)" : "Top batter in the match"), renderResult(top));
  const b3 = isTeam ? await playerGrid(idx, FORMATS.includes(fmt) ? fmt : "T20", q) : null;
  const root = h("div", {}, b1, b2, b3);
  const hc = heroCard({ name: label, sub: isTeam ? (store.teams[idx].g ? "Women's cricket" : "Men's cricket") : "Venue", meta: [`${FORMATS.includes(fmt) ? fmt : "T20"} markets`, isTeam ? "team markets use the side batting first" : "match markets"],
    cls: isTeam ? "" : "v", save: isTeam ? ["team", idx] : null, badge: isTeam ? teamBadge(store.teams[idx].n, "crest") : null, tabs: isTeam ? [["grid", "Player grid"], ["markets", "Markets"], ["top", "Top batter"]] : [["markets", "Markets"], ["top", "Top batter"]] }, root);
  const nextFx = isTeam ? (await store.loadFixtures()).find((f) => (f.a_ix === idx || f.b_ix === idx) && (f.start.length > 10 ? Date.parse(f.start) > Date.now() : f.start >= new Date().toISOString().slice(0, 10))) : null;
  const nextCard = nextFx ? nextMatchCard(nextFx) : null;
  const about = isTeam ? h("div", { class: "card about" }, h("h3", {}, `About ${label}`), h("p", { class: "muted" }, `${label} ${FORMATS.includes(fmt) ? fmt : "T20"} stats: match markets (sixes, fours, 30s, 50s, highest over, top batter) and a player grid for the last fixtures. Every figure is computed from Cricsheet ball-by-ball data and shown with its sample size. Fair odds are 1 ÷ hit rate and carry no margin.`)) : null;
  const out = h("div", {}, crumbs(["Home", "#/"], [isTeam ? "Teams" : "Venues", `#/teams?tab=${isTeam ? "teams" : "venues"}`], [label]), hc.el, nextCard, ...datalists(), root, about);
  hc.set(q.tab);
  return out;
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
  return h("div", {}, crumbs(["Home", "#/"], ["Partnerships"]), h("h1", {}, "Partnerships"), h("p", { class: "muted" }, "For any pair: who is dismissed first, stand sizes, split by format, opposition and venue. Needs ball-by-ball data, so only Cricsheet-published matches count."), ...datalists(), form, result);
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
  const card = (b) => h("div", { class: "trend" },
    h("div", { class: "tt" }, h("span", { class: "muted small", title: "your local time" }, localWhen(b.start_utc || fromIst(b.start_ist) || fromIst(b.alerted_at_ist)) || b.start_ist || b.alerted_at_ist || ""), b.edge_pct != null ? h("span", { class: "edge" }, `+${b.edge_pct}%`) : null),
    h("div", { class: "who", style: "margin-top:8px" }, h("div", {}, link(b), h("small", {}, b.match))),
    h("div", { class: "lab" }, b.market),
    h("div", { class: "nums" }, h("div", { class: "l" }, h("b", {}, odds(b.best_odds)), h("span", {}, b.best_source || "Best odds")), h("div", {}, h("b", {}, odds(b.fair_odds)), h("span", {}, "Fair odds")),
      h("div", {}, h("b", {}, b.kelly_quarter_stake_pct != null ? `${b.kelly_quarter_stake_pct}%` : "–"), h("span", {}, "¼-Kelly"))),
    b.why ? h("p", { class: "muted small", style: "margin:12px 0 0" }, b.why) : null);
  const hist = (snap.recent_alerts || []).slice().reverse().filter((b) => !bets.some((x) => x.selection === b.selection && x.match === b.match));
  return h("div", {}, crumbs(["Home", "#/"], ["Prop Hunter"]), h("h1", {}, "Prop Hunter"),
    h("p", { class: "muted" }, "Player-prop value bets for upcoming matches, produced hourly by the repo's value-bets pipeline (free odds sources vs the model). Decimal odds. Not betting advice: most edges are information the model lacks (XIs, batting order, pitch, injuries)."),
    h("p", { class: "small" }, h("span", { class: `badge ${live ? "live" : ""}` }, live ? "live from GitHub" : "bundled snapshot"), ` generated ${snap.generated_at_ist || "?"}`),
    bets.length ? h("div", { class: "cards2" }, bets.map(card)) : h("div", { class: "card" }, h("p", {}, "No value bets passed the filters in the latest run."),
      h("p", { class: "muted small" }, `Markets priced: ${snap.stats?.markets_in_window ?? "?"} across ${snap.stats?.events_in_window ?? "?"} matches in the next 24 h; sources: ${Object.entries(snap.sources || {}).map(([k, v]) => `${k} ${v.status}`).join(", ") || "n/a"}.`)),
    hist.length ? [h("h2", {}, "Recent alerts"), h("div", { class: "cards2" }, hist.slice(0, 12).map(card))] : null);
}

async function askPage(_, q) {
  return h("div", {}, h("h1", {}, "Ask anything"), h("p", { class: "muted" }, "Write your question your own way. A free AI model only turns it into a structured query; the site then runs that query on the real data and shows the filters used and the sample size."), askBox(q.q || ""));
}

async function about() {
  const defs = [
    "Fair decimal odds = 1 ÷ hit rate on the filtered sample. Pushes (whole-number lines) are void. A 90% interval shows how far small samples can mislead.",
    "Home / away / neutral is inferred from the event ('X tour of Y'), the venue's country and the team that plays most at the ground: Cricsheet has no home flag.",
    "Batting position is the order batters first appear at the crease. Batting first / chasing is the player's team.",
    "Runs conceded include penalty runs, exclude byes and leg byes. Super overs are ignored.",
    "A player named in the XI who never batted or bowled shows as VOID (the bet is void); a player not named shows as DNP; an XI that was not recorded reliably shows N/A. None of the three counts in a hit rate.",
    "Provisional (scraped) matches fill the gap before Cricsheet publishes: they carry player totals only, so they feed player props but not partnerships, batting position, innings order or match markets.",
  ];
  const list = (xs) => h("ul", { style: "margin:0 0 4px; padding-left: 20px" }, xs.map((r) => h("li", { class: "muted", style: "margin: 4px 0" }, r)));
  return h("div", {}, crumbs(["Home", "#/"], ["Rules & data"]), h("h1", {}, "Rules, definitions and data"),
    Accordion([
      { open: true, title: "Settlement rules applied", meta: Badge(String(RULES.length), "secondary"), content: list(RULES) },
      { title: "Definitions", meta: Badge(String(defs.length), "secondary"), content: list(defs) },
      { title: "Data freshness", content: h("p", { class: "muted", style: "margin:0" }, ...freshText(store)) },
    ], { type: "single", cls: "faq" }),
    h("p", { class: "muted small", style: "margin-top:14px" }, "See also: ", h("a", { href: "#/glossary" }, "Cricket stats explained"), "."));
}

boot();
