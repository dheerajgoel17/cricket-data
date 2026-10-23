// Turns a runPlan() result into DOM. Every number shown here was computed by the engine from the data.
import { FORMATS } from "./engine/util.js";
import { teamBadge } from "./assets.js";
import { Accordion, Badge } from "./shadcn.js";
import { bars, chips, freshText, h, num, odds, pc, stat, table } from "./ui.js";

const cell = (p) => (p == null ? "–" : h("span", { class: `pcell ${p >= 0.6 ? "hi" : p >= 0.4 ? "mid" : "lo"}` }, pc(p)));
const ladderTable = (ladder, label = "Line") => table([label, "Over %", "Fair over", "Under %", "Fair under", "n"],
  ladder.filter((l) => l.n).map((l) => [`${l.line}`, cell(l.pOver), h("span", { class: "odds" }, odds(l.fairOver)), cell(l.pUnder), h("span", { class: "odds" }, odds(l.fairUnder)), l.n]));

function summaryCards(r) {
  const s = r.summary;
  const side = r.plan.side || "over";
  const cards = [stat("Sample", String(s.n), r.sample.unit), stat("Median", num(s.median), `mean ${num(s.mean)}`)];
  if (s.line != null && s.n) {
    cards.push(stat(`${side === "over" ? "Over" : "Under"} ${s.line}`, pc(side === "over" ? s.pOver : s.pUnder), `${side === "over" ? s.over : s.under} of ${s.n}${s.push ? `, ${s.push} push` : ""}`));
    cards.push(stat("Fair decimal odds", h("span", { class: "odds" }, odds(side === "over" ? s.fairOver : s.fairUnder)), `other side ${odds(side === "over" ? s.fairUnder : s.fairOver)}`));
  }
  return h("div", { class: "grid" }, cards);
}

function formChart(r, { onLine, onStat, stats } = {}) {
  const c = r.chart;
  if (!c.entries.length) return null;
  const root = h("div", { class: "trend fchart" });
  const st = { line: c.line, side: c.side, games: Math.min(20, c.entries.length) };
  const hitOf = (v) => (st.side === "over" ? v > st.line : v < st.line);
  const step = (el, key, delta, min, max, fixed) => { st[key] = Math.min(max, Math.max(min, Math.round((st[key] + delta) * 100) / 100)); draw(); };
  const draw = () => {
    const ents = c.entries.slice(-st.games);
    const played = ents.filter((e) => e.value != null);
    const vals = played.map((e) => e.value);
    const hits = vals.filter(hitOf).length;
    const p = vals.length ? hits / vals.length : null;
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const auxAvg = played.length ? played.reduce((a, e) => a + (e.aux || 0), 0) / played.length : null;
    const top = Math.max(2, Math.ceil(Math.max(st.line + 0.5, ...vals)));
    const ticks = Array.from({ length: Math.min(top, 8) + 1 }, (_, i) => Math.round((top / Math.min(top, 8)) * i * 10) / 10);
    const auxMax = Math.max(1, ...played.map((e) => e.aux || 0));
    const colw = 100 / ents.length;
    const pts = ents.map((e, i) => (e.value == null ? null : [(i + 0.5) * colw, 100 - ((e.aux || 0) / auxMax) * 100])).filter(Boolean);
    const svg = `<svg class="auxline" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline fill="none" stroke="#4c8dff" stroke-width="2" vector-effect="non-scaling-stroke" points="${pts.map((q) => q.join(",")).join(" ")}"/></svg>`;
    const cw = (w) => Math.max(w, 0);
    root.replaceChildren(
      stats ? h("div", { class: "stabs" }, stats.map(([k, l]) => h("button", { type: "button", class: k === r.stat ? "on" : "", onclick: () => onStat?.(k) }, l))) : null,
      h("div", { class: "chead" }, h("div", { class: "who" }, playerBadge0(r), h("div", { class: "nm" }, r.player?.name || r.name || "")),
        h("div", { class: "cstats" },
          h("div", {}, h("span", {}, "Graph avg"), h("b", {}, num(avg))),
          h("div", {}, h("span", {}, "Hit rate"), h("b", {}, p == null ? "–" : `${Math.round(p * 100)}% (${hits}/${vals.length})`)),
          h("div", {}, h("span", {}, `Avg ${c.auxLabel.toLowerCase()}`), h("b", {}, num(auxAvg))),
          h("div", {}, h("span", {}, "Fair odds"), h("b", { class: "odds" }, p ? odds(1 / p) : "–")),
          h("div", {}, h("span", {}, "Line"), h("b", { class: "lp" }, `${st.side === "over" ? "Over" : "Under"} ${st.line}`)))),
      h("div", { class: "chartwrap" },
        h("div", { class: "yax" }, ticks.slice().reverse().map((t) => h("span", {}, String(t)))),
        h("div", { class: "plot" },
          ...ticks.map((t) => h("i", { class: "grid", style: `bottom:${(t / top) * 100}%` })),
          h("div", { class: "lineMark", style: `bottom:${(Math.min(st.line, top) / top) * 100}%` }, h("span", {}, String(st.line))),
          h("div", { class: "bars2" }, ents.map((e) => h("div", { class: "col", title: `${e.date} v ${e.opp}${e.venueName ? ` · ${e.venueName}` : ""}${e.value == null ? (e.void ? " · in the XI but did not bat/bowl: bet void" : e.unknown ? " · XI not recorded for this match" : " · not in the XI") : ` · ${e.value}`}` },
            e.value == null ? h("div", { class: `bar dnp${e.void ? " void" : ""}` }, h("em", {}, e.void ? "VOID" : e.unknown ? "N/A" : "DNP")) : h("div", { class: `bar ${hitOf(e.value) ? "hit" : "miss"}`, style: `height:${(Math.min(e.value, top) / top) * 100}%` }, h("em", {}, String(e.value))))))),
        h("div", { class: "yax r" }, [1, 0.66, 0.33, 0].map((f) => h("span", {}, String(Math.round(auxMax * f))))),
        h("div", { class: "auxwrap", html: svg })),
      h("div", { class: "xlab" }, ents.map((e) => h("div", { class: "col" }, e.pos ? h("small", {}, `No.${e.pos}`) : h("small", {}, "·"), teamBadge(e.opp), h("small", {}, e.date.slice(5).split("-").reverse().map((x, i) => (i ? x : x)).join("/"))))),
      h("div", { class: "legend" }, h("span", {}, h("i", { style: "background:#f5c542" }), "Line"), h("span", {}, h("i", { style: "background:#4c8dff" }), c.auxLabel)),
      h("div", { class: "steppers" },
        h("div", { class: "stp" }, h("span", {}, "Line"), h("button", { type: "button", class: "ghost", onclick: () => step(0, "line", -0.5, 0.5, 999) }, "−"), h("b", {}, String(st.line)), h("button", { type: "button", class: "ghost", onclick: () => step(0, "line", 0.5, 0.5, 999) }, "+")),
        h("div", { class: "stp" }, h("span", {}, "Games"), h("button", { type: "button", class: "ghost", onclick: () => step(0, "games", -5, 5, c.entries.length) }, "−"), h("b", {}, String(st.games)), h("button", { type: "button", class: "ghost", onclick: () => step(0, "games", 5, 5, c.entries.length) }, "+")),
        h("div", { class: "pills" }, [5, 10, 20, 30, 50].filter((n) => n <= c.entries.length || n === 5).map((n) => h("button", { type: "button", class: `pill ${st.games === Math.min(n, c.entries.length) ? "on" : ""}`, onclick: () => { st.games = Math.min(n, c.entries.length); draw(); } }, `L${n}`)),
          h("button", { type: "button", class: `pill ${st.games === c.entries.length ? "on" : ""}`, onclick: () => { st.games = c.entries.length; draw(); } }, "All")),
        st.side ? h("div", { class: "seg2" }, ["over", "under"].map((sd) => h("button", { type: "button", class: sd === st.side ? "on" : "", onclick: () => { st.side = sd; draw(); } }, sd === "over" ? "Over" : "Under"))) : null),
      h("details", { class: "winTable" }, h("summary", {}, "Compare windows: last 5 / 10 / 20 / 30 / all"),
        table(["Window", "Fixtures", "Played", "DNP", "Hit", "Hit rate", "Avg", "Median", "Fair odds"], WINROWS(c, st))));
  };
  draw();
  return root;
}
const WINROWS = (c, st) => [5, 10, 20, 30, 50, 0].map((n) => {
  const w = n ? c.entries.slice(-n) : c.entries;
  const v = w.filter((e) => e.value != null).map((e) => e.value);
  const k = v.filter((x) => (st.side === "over" ? x > st.line : x < st.line)).length;
  const p = v.length ? k / v.length : null;
  const sorted = [...v].sort((a, b) => a - b);
  const med = sorted.length ? (sorted.length % 2 ? sorted[sorted.length >> 1] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : null;
  return [n ? `Last ${n}` : "All", w.length, v.length, w.length - v.length, `${k}`, cell(p), num(v.length ? v.reduce((a, b) => a + b, 0) / v.length : null), num(med), h("span", { class: "odds" }, p ? odds(1 / p) : "–")];
});
const playerBadge0 = (r) => (r.badge ? r.badge() : h("span", { class: "dot ph", style: "width:46px;height:46px" }));
const store0 = (r, id) => (typeof id === "string" ? id : r.teamNames?.[id] ?? "?");

function trendCard(r) {
  const s = r.summary, side = r.plan.side || "over", line = s.line;
  const hitCount = (v) => (line == null ? false : side === "over" ? v > line : v < line);
  const p = side === "over" ? s.pOver : s.pUnder;
  const recent = r.last.slice(0, 15).reverse();
  return h("div", { class: "trend" },
    h("div", { class: "tt" }, h("div", { class: "who" }, h("div", {}, r.player.name, h("small", {}, `${r.fmtName} · ${r.sample.n} ${r.sample.unit}`))),
      h("span", { class: "linepill" }, line != null ? `${side === "over" ? "O" : "U"} ${line}` : "Median", h("b", {}, line != null ? odds(side === "over" ? s.fairOver : s.fairUnder) : num(s.median)))),
    h("div", { class: "lab" }, `${r.statLabel} ${line != null ? `${side} ${line}` : "recent form"}`),
    h("div", { class: "nums" },
      h("div", { class: "l" }, h("b", {}, line != null ? `${side === "over" ? s.over : s.under}/${s.n}` : String(s.n)), h("span", {}, line != null ? "Record" : "Sample")),
      h("div", {}, h("b", {}, line != null ? pc(p) : "–"), h("span", {}, "Hit rate")), h("div", {}, h("b", {}, num(s.median)), h("span", {}, "Median")), h("div", {}, h("b", {}, num(s.mean)), h("span", {}, "Average"))),
    h("div", { class: "gstrip" }, recent.map((x) => h("div", { class: "gcell", title: `${x.date} v ${x.opp} at ${x.venue}` },
      h("div", { class: `v ${hitCount(x.value) ? "hit" : ""}` }, String(x.value)), teamBadge(x.opp), h("em", {}, x.date.slice(5).split("-").reverse().join("/"))))));
}

function splitTables(splits, title = (k) => k) {
  const items = Object.entries(splits).filter(([, rows]) => rows.length).map(([kind, rows]) => ({
    open: kind === "opposition" || kind === "venue_type",
    title: `Split by ${title(kind).replace("_", " ")}`, meta: Badge(String(rows.length), "secondary"),
    content: table([title(kind).replace("_", " "), "n", "Median", "Mean", "Over %", "Fair over"],
      rows.map((x) => [x.label, x.n, num(x.median), num(x.mean), cell(x.pOver), h("span", { class: "odds" }, odds(x.fairOver))])),
  }));
  return items.length ? [Accordion(items, { type: "multiple", cls: "faq" })] : [];
}

export function renderResult(r, { source, onLine, onStat, stats, badge } = {}) {
  if (r.chart && badge) r.badge = badge;
  if (!r.ok) return h("div", { class: "card err" }, h("p", {}, r.error));
  const out = h("div", { class: "answer" });
  out.append(h("div", { class: "card" },
    source ? h("span", { class: "badge" }, source) : null,
    h("h2", {}, r.headline),
    h("div", { class: "muted small" }, `Sample size: ${r.sample.n} ${r.sample.unit}.`),
    chips(r.filters)));
  if (r.kind === "player_prop") {
    out.append(summaryCards(r));
    if (r.player.alternatives?.length) out.append(h("p", { class: "muted small" }, "Also matched: ", r.player.alternatives.join(", "), " (be more specific to pick another)."));
    const fc = r.chart && formChart(r, { onLine, onStat, stats });
    const logs = r.chart ? [...r.chart.entries].reverse() : [];
    const corr = r.corr ? h("div", { class: "card" }, h("h3", {}, `Correlated props: when ${r.statLabel.toLowerCase()} ${r.plan.side || "over"} ${r.chart?.line ?? r.line} hits`),
      h("p", { class: "muted small" }, `${r.corr.n} of ${r.corr.of} ${r.sample.unit}. Shows how often his other props also clear in those games versus his normal rate.`),
      table(["Prop", "Normal", "When it hits", "Lift"], r.corr.rows.map((c) => [`${c.label} over ${c.line}`, pc(c.base), pc(c.cond), h("span", { class: `pcell ${c.lift >= 0.1 ? "hi" : c.lift <= -0.1 ? "lo" : "mid"}` }, `${c.lift >= 0 ? "+" : ""}${Math.round(c.lift * 100)}pp`)]))) : null;
    out.append(h("div", { "data-sec": "props" }, fc || trendCard(r), corr),
      h("div", { "data-sec": "logs" }, h("div", { class: "card flat" }, table(["Date", "Opponent", "Venue", r.statLabel, r.chart?.auxLabel || "", "No."],
        logs.map((e) => [e.date, e.opp, e.venueName || "", e.value == null ? (e.void ? Badge("VOID: in XI, did not bat/bowl", "warning") : e.unknown ? Badge("N/A: XI not recorded", "outline") : Badge("DNP", "secondary")) : e.value, e.aux ?? "–", e.pos ?? "–"])))),
      h("div", { "data-sec": "splits" }, h("h2", {}, "Hit rate at every line"), h("div", { class: "card flat" }, ladderTable(r.ladder)), ...splitTables(r.splits)));
  } else if (r.kind === "partnership") {
    const s = r.summary;
    out.append(h("div", { class: "grid" },
      stat("Stands", String(s.n), `${s.ended} ended by a dismissal`),
      stat(`${s.nameA} out first`, pc(s.pFirstOutA), `${s.aOut}× · fair ${odds(s.fairFirstOutA)}`),
      stat(`${s.nameB} out first`, pc(s.pFirstOutB), `${s.bOut}× · fair ${odds(s.fairFirstOutB)}`),
      stat("Median stand", num(s.medianRuns), `mean ${num(s.avgRuns)} runs, 50+ stands ${s.stand50}`)));
    for (const [kind, rows] of Object.entries(r.splits)) {
      if (!rows.length) continue;
      out.append(h("details", { open: kind === "format" }, h("summary", {}, `Split by ${kind}`),
        table([kind, "n", `${s.nameA} out`, `${s.nameB} out`, "Fair A first", "Fair B first", "Median stand"],
          rows.map((x) => [x.label, x.n, x.aOut, x.bOut, odds(x.fairFirstOutA), odds(x.fairFirstOutB), num(x.medianRuns)]))));
    }
    if (r.last.length) out.append(h("h2", {}, "Latest stands"), h("div", { class: "card" }, table(["Date", "Opponent", "Venue", "Runs", "Balls", "Wicket", "First out"], r.last.map((x) => [x.date, x.opp, x.venue, x.runs, x.balls, x.wicket, x.out]))));
    if (r.together?.length) out.append(h("details", {}, h("summary", {}, `Matches both batted for the same team (${r.together.length})`),
      table(["Date", "Format", "Opponent", "Source"], r.together.slice(-30).reverse().map((t) => [t.date, t.fmt, t.opp, t.pv ? "provisional (totals only)" : "ball-by-ball"]))));
  } else if (r.kind === "match_market") {
    for (const t of r.tables) {
      if (!t.n) continue;
      out.append(h("div", { class: "card" }, h("h3", {}, t.label), h("div", { class: "muted small" }, `n=${t.n} · median ${num(t.summary.median)} · mean ${num(t.summary.mean)} · range ${num(t.summary.min)}–${num(t.summary.max)}`),
        t.summary.line != null ? h("p", {}, `Over ${t.summary.line}: ${pc(t.summary.pOver)} (fair `, h("span", { class: "odds" }, odds(t.summary.fairOver)), `) · Under: ${pc(t.summary.pUnder)} (fair `, h("span", { class: "odds" }, odds(t.summary.fairUnder)), ")") : null,
        ladderTable(t.ladder)));
    }
  } else if (r.kind === "top_batter") {
    out.append(h("div", { class: "card" }, table(["Batter", "Sole top", "Tied top", "Share (sole)", "Fair odds"], r.rows.map((x) => [x.name, x.sole, x.tied, pc(x.pSole), h("span", { class: "odds" }, odds(x.fairSole))]))));
  }
  if (r.notes?.length) out.append(h("div", { class: "card" }, h("h3", {}, "Notes"), h("ul", {}, r.notes.map((n) => h("li", { class: "small" }, n)))));
  out.append(h("p", { class: "muted small" }, r.freshness));
  return out;
}

export { FORMATS, freshText };
