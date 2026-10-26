// The player page as an app screen: sticky app bar, stat strip, stat rail, one big tappable chart with look-back pills,
// filters in a bottom sheet and Lines / Game log / Splits as swipe-free tabs. Every number comes from the engine result
// (`res`) or from windows.js over the chart entries: nothing is computed from an LLM or invented here.
import { bookName } from "./engine/lines.js";
import { barState, windowRate, windowRates } from "./engine/windows.js";
import { ladderTable, splitTables } from "./render.js";
import { segment, sheet } from "./ionic.js";
import { chips, h, hashQuery, localWhen, num, odds, pc, table } from "./ui.js";

const BACK = '<svg class="i" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
const SLIDERS = '<svg class="i" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>';
const FILTER_SKIP = new Set(["Player", "Stat", "Format", "Line", "Side"]); // those are on screen already

const tile = (k, v, sub, cls = "") => h("div", { class: `pa-tile ${cls}` }, h("span", { class: "k" }, k), h("b", { class: "v" }, v), sub ? h("span", { class: "s" }, sub) : null);
const SHARE = '<svg class="i" viewBox="0 0 24 24"><path d="M21 3L3 10.5l7 3 3 7z"/><path d="M10 13.5L21 3"/></svg>';
const abbr = (n) => { const w = String(n).replace(/\(W\)/, "").trim().split(/\s+/); return (w.length > 1 ? w.map((x) => x[0]).join("") : w[0]).slice(0, 3).toUpperCase(); };
const shortDate = (d) => d.slice(5).split("-").reverse().join("/");
const bandOf = (p) => (p == null ? "" : p >= 0.6 ? "hi" : p >= 0.4 ? "mid" : "lo");

/**
 * deps: { store, idx, q, res, go, star, playerBadge, teamBadge, fmts, fmtVal, stats, moreFilters, back }
 *  - fmts: [[formatIndex, "T20"], ...] the player has data in; stats: [[key, label], ...]
 *  - moreFilters: a ready-made form node (opposition, venue, innings, ...) shown in the filter sheet
 *  - book: the market's lines for his next match (engine/lines.js bookLinesFor) or null; bookDefault: the line shown was taken from it
 */
export function playerScreen(deps) {
  const { store, idx, q, res, go, star, playerBadge, teamBadge, fmts, fmtVal, stats, moreFilters, back, book = null, bookDefault = false } = deps;
  const name = store.playerName(idx);
  const team = store.teamName(store.P.tm[idx]);
  const root = h("div", { class: "pa" });

  const bar = h("div", { class: "pa-bar" },
    h("button", { type: "button", class: "pa-back", "aria-label": "Back", onclick: back, html: BACK }),
    h("div", { class: "pa-title" }, name), star("player", idx));
  const share = h("button", { type: "button", class: "pa-round", "aria-label": "Share", html: SHARE, onclick: () => { const u = location.href; (navigator.share ? navigator.share({ title: name, url: u }) : navigator.clipboard.writeText(u)).catch(() => {}); } });
  const gauge = h("div", { class: "pa-gauge" });
  const hero = h("section", { class: "pa-hero" },
    h("div", { class: "pa-photo" }, playerBadge(store, idx, "crest")),
    h("div", { class: "pa-id" }, h("h1", {}, name), h("div", { class: "pa-team" }, team), h("div", { class: "pa-team" }, fmts.map(([, f]) => f).join(" · ")),
      h("div", { class: "pa-acts" }, h("span", { class: "pa-round" }, teamBadge(team)), star("player", idx), share)));
  const strip = h("section", { class: "pa-strip" });
  hero.append(h("div", { class: "pa-stats" }, strip, gauge));
  root.append(bar);

  if (!res.ok) { root.append(hero, h("div", { class: "card err" }, h("p", {}, res.error))); return root; }

  const rail = segment(stats, q.stat || "runs", (k) => go(`player/${idx}`, { ...hashQuery(), stat: k, line: "" }), { scrollable: true, cls: "pa-rail", label: "Prop" });
  const fmtSeg = fmts.length > 1 ? segment(fmts.map(([i, f]) => [i, f]), fmtVal, (v) => go(`player/${idx}`, { ...hashQuery(), fmt: v, line: "" }), { cls: "pa-fmt", label: "Format" }) : null;
  const chartCard = h("section", { class: "pa-card pa-chart" });
  const bookHost = h("div", { class: "pa-bookhost" });
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
    if (!c || !entries.length) { chartCard.replaceChildren(h("p", { class: "muted pad" }, "No fixtures match these filters.")); strip.replaceChildren(); gauge.replaceChildren(); drawBook({ n: 0, label: "All" }); return; }
    const ws = windowRates(entries, st.line, st.side);
    const cur = ws.find((w) => w.n === st.win) || ws[ws.length - 1];
    const shown = cur.n ? entries.slice(-cur.n) : entries;
    const vals = shown.filter((e) => e.value != null).map((e) => e.value);
    const top = Math.max(2, Math.ceil(Math.max(st.line + 0.5, ...vals, 1)));
    const nt = Math.min(top, 5);
    const ticks = Array.from({ length: nt + 1 }, (_, i) => Math.round((top / nt) * i * 10) / 10);
    const wide = shown.length > 20;
    const colw = wide ? 30 : 0;

    const bookAt = book ? book.lines.find((l) => l.line === st.line) : null;
    const bestPrice = bookAt ? Math.max(0, ...bookAt.books.map((b) => b[st.side] || 0)) : 0;
    const edge = bestPrice && cur.p ? bestPrice * cur.p - 1 : 0;
    const played = shown.filter((e) => e.value != null);
    const auxAvg = played.length ? played.reduce((t, e) => t + (e.aux || 0), 0) / played.length : null;
    strip.replaceChildren(
      tile(`${cur.label} avg`, num(cur.mean == null ? null : Math.round(cur.mean * 100) / 100), "", cur.p != null && cur.mean > st.line ? "up" : ""),
      tile("Line", `${st.side === "over" ? "O" : "U"} ${st.line}`, bookAt ? bookAt.books.map((b) => `${bookName(b.source)} ${odds(b[st.side])}`).join(" · ") : ""),
      tile("Prop", res.statLabel, ""),
      tile("Hit rate", cur.p == null ? "–" : `${Math.round(cur.p * 100)}%`, `${cur.hits}/${cur.played}`, `hit ${bandOf(cur.p)}`),
      tile(`Avg ${(c.auxLabel || "").toLowerCase()}`, num(auxAvg == null ? null : Math.round(auxAvg * 100) / 100), ""),
      tile("Fair odds", cur.p ? odds(1 / cur.p) : "–", bestPrice && cur.p ? `book ${odds(bestPrice)} · ${edge >= 0 ? "+" : ""}${Math.round(edge * 100)}% edge` : ""));

    const arc = cur.p == null ? 0 : cur.p;
    gauge.replaceChildren(h("div", { html: `<svg viewBox="0 0 48 48" width="52" height="52"><circle cx="24" cy="24" r="19" fill="none" stroke="#3a3a3a" stroke-width="4" stroke-dasharray="89.6 29.9" stroke-linecap="round" transform="rotate(135 24 24)"/><circle cx="24" cy="24" r="19" fill="none" stroke="${arc >= 0.6 ? "#27da8e" : arc >= 0.4 ? "#f5a524" : "#ff4444"}" stroke-width="4" stroke-dasharray="${(89.6 * arc).toFixed(1)} 200" stroke-linecap="round" transform="rotate(135 24 24)"/><text x="24" y="28" text-anchor="middle" font-size="11" font-weight="600" fill="#fff">${cur.p == null ? "–" : Math.round(arc * 100) + "%"}</text></svg>` }), h("span", {}, `${cur.label} hit`));

    const bars = shown.map((e) => {
      const s = barState(e, st.line, st.side);
      const tip = `${e.date} v ${e.opp}${e.venueName ? ` · ${e.venueName}` : ""}${e.value == null ? ({ void: " · in the XI, did not bat/bowl: bet void", na: " · XI not recorded", dnp: " · not in the XI" })[s] : ` · ${e.value}`}`;
      return h("button", { type: "button", class: `col ${s}`, "aria-label": tip, title: tip, onclick: () => openGame(e, s) },
        e.value == null ? h("div", { class: "bar none" }, h("em", {}, s === "void" ? "VOID" : s === "na" ? "N/A" : "DNP"))
          : h("div", { class: "bar", style: `height:${Math.max((Math.min(e.value, top) / top) * 100, 1.5)}%` }, h("em", {}, String(e.value))));
    });
    const labels = shown.map((e) => h("div", { class: "col" }, h("small", {}, shortDate(e.date)), h("small", {}, abbr(e.opp))));
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
    drawBook(cur);
    // keep the newest games in view on a long, scrollable chart
    requestAnimationFrame(() => { const p = chartCard.querySelector(".pa-plot"); if (p) p.scrollLeft = p.scrollWidth; });
  }

  /** The market's lines next to his own hit rate over the same lines (window chosen on the chart): where they differ is what to look at. */
  function drawBook(cur) {
    if (!book) { bookHost.replaceChildren(); return; }
    const rows = book.lines.map((l) => {
      const hist = windowRate(entries, cur.n, l.line, "over");
      return [h("button", { type: "button", class: `pa-use ${st.line === l.line ? "on" : ""}`, "aria-label": `Use line ${l.line}`, onclick: () => { st.line = l.line; saveView(); drawChart(); } },
          String(l.line), l === book.main ? h("small", {}, "main") : null),
        h("span", { class: "pa-odds" }, l.books.map((b) => h("span", {}, h("em", {}, bookName(b.source)), `${odds(b.over)} / ${odds(b.under)}`))),
        l.prob == null ? "–" : pc(l.prob), hist.p == null ? "–" : pc(hist.p)];
    });
    bookHost.replaceChildren(h("section", { class: "pa-card pa-book" }, h("h3", {}, "Bookmaker lines"),
      h("p", { class: "muted small" }, `${book.match}${book.start_utc ? ` · ${localWhen(book.start_utc)}` : ""}${book.competition ? ` · ${book.competition}` : ""}. Decimal odds, over / under. Tap a line to put it on the chart.${bookDefault ? " The chart opened on the main line." : ""}`),
      table(["Line", "Odds", "Market", `Hit ${cur.label}`], rows),
      h("p", { class: "muted small" }, "Market = the chance of the over once each book's margin is removed. Hit rate = how often he has gone over that line in the games shown on the chart.")));
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
  root.append(h("div", { class: "pa-railwrap" }, rail), hero, ...(fmtSeg ? [fmtSeg] : []),
    h("div", { class: "pa-grid" }, h("div", { class: "pa-main" }, chartCard, bookHost, filterBar, tabsHost, secs), side));
  return root;
}
