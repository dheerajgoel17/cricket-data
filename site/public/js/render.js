// Turns a runPlan() result into DOM. Every number shown here was computed by the engine from the data.
import { FORMATS } from "./engine/util.js";
import { bars, chips, freshText, h, num, odds, pc, stat, table } from "./ui.js";

const ladderTable = (ladder, label = "Line") => table([label, "Over %", "Fair over", "Under %", "Fair under", "n"],
  ladder.filter((l) => l.n).map((l) => [`${l.line}`, pc(l.pOver), h("span", { class: "odds" }, odds(l.fairOver)), pc(l.pUnder), h("span", { class: "odds" }, odds(l.fairUnder)), l.n]));

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

function splitTables(splits, title = (k) => k) {
  return Object.entries(splits).filter(([, rows]) => rows.length).map(([kind, rows]) => h("details", { open: kind === "opposition" || kind === "venue_type" },
    h("summary", {}, `Split by ${title(kind).replace("_", " ")}`),
    table([title(kind).replace("_", " "), "n", "Median", "Mean", "Over %", "Fair over"],
      rows.map((x) => [x.label, x.n, num(x.median), num(x.mean), pc(x.pOver), h("span", { class: "odds" }, odds(x.fairOver))]))));
}

export function renderResult(r, { source } = {}) {
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
    out.append(h("h2", {}, "Hit rate at every line"), h("div", { class: "card" }, ladderTable(r.ladder)));
    if (r.last.length) {
      const vals = r.last.map((x) => x.value).reverse();
      out.append(h("h2", {}, `Last ${r.last.length} (oldest → newest)`), h("div", { class: "card" }, bars(vals, r.summary.line),
        table(["Date", "Opponent", "Venue", "Value", "Home/away", "Innings"], r.last.map((x) => [x.date, x.opp, x.venue, x.value, x.home ?? "?", x.innings ?? "?"]))));
    }
    out.append(...splitTables(r.splits));
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
