// The player page as an app screen: sticky app bar, stat strip, stat rail, one big tappable chart with look-back pills,
// filters in a bottom sheet and Lines / Game log / Splits as swipe-free tabs. Every number comes from the engine result
// (`res`) or from windows.js over the chart entries: nothing is computed from an LLM or invented here.
import { barState, windowRates } from "./engine/windows.js";
import { ladderTable, splitTables } from "./render.js";
import { segment, sheet } from "./ionic.js";
import { chips, h, hashQuery, num, odds, pc, table } from "./ui.js";

const BACK = '<svg class="i" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
const SLIDERS = '<svg class="i" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>';
const FILTER_SKIP = new Set(["Player", "Stat", "Format", "Line", "Side"]); // those are on screen already

const tile = (k, v, sub, cls = "") => h("div", { class: `pa-tile ${cls}` }, h("span", { class: "k" }, k), h("b", { class: "v" }, v), sub ? h("span", { class: "s" }, sub) : null);
const shortDate = (d) => d.slice(5).split("-").reverse().join("/");
const bandOf = (p) => (p == null ? "" : p >= 0.6 ? "hi" : p >= 0.4 ? "mid" : "lo");

/**
 * deps: { store, idx, q, res, go, star, playerBadge, teamBadge, fmts, fmtVal, stats, moreFilters, back }
 *  - fmts: [[formatIndex, "T20"], ...] the player has data in; stats: [[key, label], ...]
 *  - moreFilters: a ready-made form node (opposition, venue, innings, ...) shown in the filter sheet
 */
export function playerScreen(deps) {
  const { store, idx, q, res, go, star, playerBadge, teamBadge, fmts, fmtVal, stats, moreFilters, back } = deps;
  const name = store.playerName(idx);
  const team = store.teamName(store.P.tm[idx]);
  const root = h("div", { class: "pa" });

  const bar = h("div", { class: "pa-bar" },
    h("button", { type: "button", class: "pa-back", "aria-label": "Back", onclick: back, html: BACK }),
    h("div", { class: "pa-title" }, name), star("player", idx));
  const hero = h("section", { class: "pa-hero" }, playerBadge(store, idx, "crest"),
    h("div", { class: "pa-id" }, h("h1", {}, name), h("div", { class: "muted" }, team),
      h("div", { class: "pa-chips" }, ...fmts.map(([, f]) => h("span", { class: "chip" }, f)), h("span", { class: "chip dim" }, `Last played ${store.P.last[idx]}`))));
  root.append(bar, hero);

  if (!res.ok) { root.append(h("div", { class: "card err" }, h("p", {}, res.error))); return root; }

  const rail = segment(stats, q.stat || "runs", (k) => go(`player/${idx}`, { ...hashQuery(), stat: k, line: "" }), { scrollable: true, cls: "pa-rail", label: "Prop" });
  const fmtSeg = fmts.length > 1 ? segment(fmts.map(([i, f]) => [i, f]), fmtVal, (v) => go(`player/${idx}`, { ...hashQuery(), fmt: v, line: "" }), { cls: "pa-fmt", label: "Format" }) : null;
  const strip = h("section", { class: "pa-strip" });
  const chartCard = h("section", { class: "pa-card pa-chart" });
  const side = h("aside", { class: "pa-side" });
  const filterBar = h("div", { class: "pa-filterbar" });
  const tabsHost = h("div", { class: "pa-tabs" });
  const secs = h("div", { class: "pa-secs" });

  const c = res.chart;
  const entries = c ? c.entries : [];
  const st = { line: c ? c.line : null, side: c ? c.side : "over", win: 0 };
  st.win = entries.length >= 20 ? 20 : 0;

  const saveView = () => {
    const base = location.hash.slice(2).split("?")[0];
    const nq = { ...Object.fromEntries(new URLSearchParams(location.hash.split("?")[1] || "")), line: st.line ?? "", side: st.side, tab: tab };
    history.replaceState(null, "", `#/${base}?${new URLSearchParams(Object.entries(nq).filter(([, v]) => v !== "" && v != null))}`);
  };

  // ------------------------------------------------------------ chart + strip (redrawn locally when line / side / window change)
  function drawChart() {
    if (!c || !entries.length) { chartCard.replaceChildren(h("p", { class: "muted pad" }, "No fixtures match these filters.")); strip.replaceChildren(); return; }
    const ws = windowRates(entries, st.line, st.side);
    const cur = ws.find((w) => w.n === st.win) || ws[ws.length - 1];
    const shown = cur.n ? entries.slice(-cur.n) : entries;
    const vals = shown.filter((e) => e.value != null).map((e) => e.value);
    const top = Math.max(2, Math.ceil(Math.max(st.line + 0.5, ...vals, 1)));
    const nt = Math.min(top, 5);
    const ticks = Array.from({ length: nt + 1 }, (_, i) => Math.round((top / nt) * i * 10) / 10);
    const wide = shown.length > 20;
    const colw = wide ? 30 : 0;

    strip.replaceChildren(
      tile("Hit rate", cur.p == null ? "–" : `${Math.round(cur.p * 100)}%`, `${cur.hits}/${cur.played} · ${cur.label}`, `hit ${bandOf(cur.p)}`),
      tile("Line", `${st.side === "over" ? "Over" : "Under"} ${st.line}`, res.statLabel),
      tile("Fair odds", cur.p ? odds(1 / cur.p) : "–", "no margin"),
      tile(`${cur.label} avg`, num(cur.mean == null ? null : Math.round(cur.mean * 100) / 100), `mean ${num(res.summary.mean)} overall`),
      tile("Median", num(res.summary.median), "all fixtures"),
      tile("Sample", String(res.summary.n), res.sample.unit));

    const bars = shown.map((e) => {
      const s = barState(e, st.line, st.side);
      const tip = `${e.date} v ${e.opp}${e.venueName ? ` · ${e.venueName}` : ""}${e.value == null ? ({ void: " · in the XI, did not bat/bowl: bet void", na: " · XI not recorded", dnp: " · not in the XI" })[s] : ` · ${e.value}`}`;
      return h("button", { type: "button", class: `col ${s}`, "aria-label": tip, title: tip, onclick: () => openGame(e, s) },
        e.value == null ? h("div", { class: "bar none" }, h("em", {}, s === "void" ? "VOID" : s === "na" ? "N/A" : "DNP"))
          : h("div", { class: "bar", style: `height:${Math.max((Math.min(e.value, top) / top) * 100, 1.5)}%` }, h("em", {}, String(e.value))));
    });
    const labels = shown.map((e) => h("div", { class: "col" }, teamBadge(e.opp), h("small", {}, shortDate(e.date))));
    const plot = h("div", { class: "pa-plot", style: wide ? `--colw:${colw}px` : "" },
      h("div", { class: "pa-inner" },
        h("div", { class: "pa-area" },
          ...ticks.map((t) => h("i", { class: "gl", style: `bottom:${(t / top) * 100}%` })),
          h("div", { class: "pa-line", style: `bottom:${(Math.min(st.line, top) / top) * 100}%` }, h("span", {}, String(st.line))),
          h("div", { class: "pa-bars" }, bars)),
        h("div", { class: "pa-xl" }, labels)));
    const yax = h("div", { class: "pa-y" }, ticks.slice().reverse().map((t) => h("span", {}, String(t))));

    const step = (d) => { st.line = Math.max(0.5, Math.round((st.line + d) * 100) / 100); saveView(); drawChart(); };
    chartCard.replaceChildren(
      h("div", { class: "pa-ctl" },
        segment([["over", "Over"], ["under", "Under"]], st.side, (v) => { st.side = v; saveView(); drawChart(); }, { cls: "pa-side-seg", label: "Side" }),
        h("div", { class: "pa-step" }, h("button", { type: "button", "aria-label": "Lower line", onclick: () => step(-0.5) }, "−"), h("b", {}, String(st.line)),
          h("button", { type: "button", "aria-label": "Raise line", onclick: () => step(0.5) }, "+"))),
      h("div", { class: "pa-chartwrap" }, yax, plot),
      segment(ws.map((w) => [w.n, h("span", { class: "pa-win" }, h("span", {}, w.label), h("b", { class: bandOf(w.p) }, w.p == null ? "–" : `${Math.round(w.p * 100)}%`))]), cur.n,
        (v) => { st.win = Number(v); drawChart(); }, { cls: "pa-range", label: "Look-back" }),
      h("p", { class: "muted small pa-foot" }, `${res.statLabel} ${st.side} ${st.line} · green = cleared, red = missed · DNP/VOID fixtures are not counted`));
    // keep the newest games in view on a long, scrollable chart
    requestAnimationFrame(() => { const p = chartCard.querySelector(".pa-plot"); if (p) p.scrollLeft = p.scrollWidth; });
  }

  function openGame(e, s) {
    const rows = [["Date", e.date], ["Opponent", e.opp], e.venueName ? ["Venue", e.venueName] : null,
      [res.statLabel, e.value == null ? ({ void: "VOID: in the XI, did not bat/bowl", na: "N/A: XI not recorded", dnp: "DNP: not in the XI" })[s] : String(e.value)],
      e.value != null && c.auxLabel ? [c.auxLabel, e.aux ?? "–"] : null, e.pos ? ["Batting position", `No. ${e.pos}`] : null].filter(Boolean);
    sheet(h("div", { class: "pa-game" }, rows.map(([k, v]) => h("div", { class: "row" }, h("span", { class: "muted" }, k), h("b", {}, v)))), { title: `${name} · ${shortDate(e.date)}`, initial: 0.4, breakpoints: [0, 0.4, 0.8] });
  }

  // ------------------------------------------------------------ filters
  const active = (res.filters || []).filter(([k]) => !FILTER_SKIP.has(k));
  const openFilters = () => sheet(h("div", { class: "pa-filters" }, moreFilters, h("p", { class: "muted small" }, "Filters apply as you change them.")), { title: "Filters", initial: 0.75, breakpoints: [0, 0.75, 0.95] });
  filterBar.append(h("button", { type: "button", class: "pa-fbtn", onclick: openFilters }, h("span", { html: SLIDERS }), `Filters${active.length ? ` · ${active.length}` : ""}`),
    active.length ? chips(active) : h("span", { class: "muted small" }, "All matches"),
    active.length ? h("button", { type: "button", class: "pa-clear", onclick: () => go(`player/${idx}`, { fmt: hashQuery().fmt, stat: hashQuery().stat }) }, "Clear") : h("span"));

  // ------------------------------------------------------------ tabs: Lines / Game log / Splits
  let tab = ["lines", "logs", "splits"].includes(q.tab) ? q.tab : "lines";
  const logs = [...entries].reverse();
  let logCount = 30;
  const logList = h("div", { class: "pa-logs" });
  const drawLogs = () => {
    logList.replaceChildren(...logs.slice(0, logCount).map((e) => {
      const s = barState(e, st.line, st.side);
      return h("button", { type: "button", class: "pa-log", onclick: () => openGame(e, s) },
        h("span", { class: "who" }, teamBadge(e.opp), h("span", {}, h("b", {}, e.opp), h("small", {}, `${e.date}${e.venueName ? ` · ${e.venueName}` : ""}`))),
        h("span", { class: `val ${s}` }, e.value == null ? (s === "void" ? "VOID" : s === "na" ? "N/A" : "DNP") : String(e.value)));
    }), logs.length > logCount ? h("button", { type: "button", class: "ghost pa-more", onclick: () => { logCount += 30; drawLogs(); } }, `Show more (${logs.length - logCount} left)`) : null);
  };
  drawLogs();
  const corr = res.corr ? h("div", { class: "pa-card" }, h("h3", {}, `When ${res.statLabel.toLowerCase()} ${res.plan.side || "over"} ${c?.line ?? res.line} hits`),
    h("p", { class: "muted small" }, `${res.corr.n} of ${res.corr.of} ${res.sample.unit}: how often his other props also clear in those games.`),
    table(["Prop", "Normal", "When it hits", "Lift"], res.corr.rows.map((x) => [`${x.label} over ${x.line}`, pc(x.base), pc(x.cond), `${x.lift >= 0 ? "+" : ""}${Math.round(x.lift * 100)}pp`]))) : null;
  const sections = {
    lines: h("div", {}, h("div", { class: "pa-card" }, h("h3", {}, "Hit rate at every line"), ladderTable(res.ladder)), corr),
    logs: h("div", { class: "pa-card flat" }, logList),
    splits: h("div", {}, ...splitTables(res.splits)),
  };
  const showTab = (t) => { tab = t; for (const [k, el] of Object.entries(sections)) el.hidden = k !== t; };
  Object.values(sections).forEach((el) => secs.append(el));
  showTab(tab);
  tabsHost.append(segment([["lines", "Lines"], ["logs", "Game log"], ["splits", "Splits"]], tab, (v) => { showTab(v); saveView(); }, { cls: "pa-tabseg", label: "Section" }));

  side.append(h("div", { class: "pa-card pa-insight" }, h("h3", {}, "At a glance"), h("p", {}, res.headline), h("p", { class: "muted small" }, res.freshness)));
  drawChart();
  root.append(h("div", { class: "pa-railwrap" }, rail), fmtSeg, strip,
    h("div", { class: "pa-grid" }, h("div", { class: "pa-main" }, chartCard, filterBar, tabsHost, secs), side));
  return root;
}
