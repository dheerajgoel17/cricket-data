// Query plans: the only thing the language model produces. A plan is plain data that is validated here,
// resolved against the real name tables, and executed on the real rows. The model never supplies a number.
import { aggregateByMatch } from "./filters.js";
import { ALL_MARKETS, MATCH_MARKETS, TEAM_MARKETS, marketReport, selectMatches, topBatters } from "./markets.js";
import { filterPairs, pairSummary, splitPairs } from "./partnership.js";
import { SPLITS, playerReport } from "./props.js";
import { STATS, STAT_WORDS } from "./rules.js";
import { FORMATS, fmtIndex, norm, round } from "./util.js";

export const KINDS = ["player_prop", "partnership", "match_market", "top_batter", "unknown"];
const FMT_WORDS = { t20: "T20", t20i: "T20", t20s: "T20", twenty20: "T20", it20: "T20", odi: "ODI", odis: "ODI", "one day": "ODI",
  oneday: "ODI", "50 over": "ODI", test: "Test", tests: "Test", "test match": "Test", hundred: "Hundred", "the hundred": "Hundred", "100 ball": "Hundred",
  t10: "T10", o60: "O60", "60 over": "O60" };
const str = (v, n = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
const num = (v) => (v === null || v === "" || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
const isoDate = (v) => {
  const s = str(v, 10);
  if (!s) return null;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** Hand-validate whatever the model (or the rule parser) returned. Unknown keys are dropped. */
export function sanitizePlan(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const f = r.filters && typeof r.filters === "object" ? r.filters : {};
  const kind = KINDS.includes(r.kind) ? r.kind : "unknown";
  let stat = str(r.stat, 30)?.toLowerCase().replace(/\s+/g, "_") ?? null;
  if (stat && !STATS[stat]) stat = STAT_WORDS[stat] || null;
  const fmtRaw = str(f.format ?? r.format, 20);
  const fmt = fmtRaw ? (FMT_WORDS[norm(fmtRaw)] ?? (fmtIndex(fmtRaw) >= 0 ? FORMATS[fmtIndex(fmtRaw)] : null)) : null;
  const side = ["over", "under"].includes(r.side) ? r.side : null;
  let pos = f.position;
  if (typeof pos === "number") pos = [pos, pos];
  else if (typeof pos === "string") {
    const m = pos.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    pos = m ? [Number(m[1]), Number(m[2] ?? m[1])] : null;
  } else if (!Array.isArray(pos)) pos = null;
  if (pos) {
    pos = pos.map((x) => Math.round(Number(x)));
    pos = pos.length === 2 && pos.every((x) => x >= 1 && x <= 11) ? [Math.min(...pos), Math.max(...pos)] : null;
  }
  const market = str(r.market, 40);
  return {
    kind, player: str(r.player), player2: str(r.player2), stat,
    line: num(r.line), side,
    market: market && ALL_MARKETS[market] ? market : null,
    team: str(r.team), venue: str(r.venue ?? f.venue), competition: str(f.competition ?? r.competition),
    opening: r.opening === true || f.opening === true,
    scope: r.scope === "match" ? "match" : "innings",
    splitBy: SPLITS.filter((s) => (Array.isArray(r.split_by) ? r.split_by : [r.split_by]).includes(s)),
    filters: {
      format: fmt, gender: ["male", "female"].includes(f.gender) ? f.gender : null,
      opposition: str(f.opposition), venueType: ["home", "away", "neutral"].includes(f.venue_type) ? f.venue_type : null,
      forTeam: str(f.for_team), innings: ["first", "second"].includes(f.innings) ? f.innings : null,
      teamInnings: [1, 2].includes(Number(f.team_innings)) ? Number(f.team_innings) : null,
      position: pos, since: isoDate(f.since), until: isoDate(f.until),
      lastN: num(f.last_n) && num(f.last_n) >= 1 ? Math.min(500, Math.round(num(f.last_n))) : null,
      international: typeof f.international === "boolean" ? f.international : null,
    },
    question: str(r.question, 300),
  };
}

const title = (s) => String(s).replace(/\b[a-z]/g, (c) => c.toUpperCase());
const d2 = (x) => (x == null ? "n/a" : x.toFixed(2));
const P = (x) => (x == null ? "n/a" : `${round(x * 100, 1)}%`);

function chips(store, plan, extra = []) {
  const f = plan.filters;
  const out = [...extra];
  if (f.format) out.push(["Format", f.format]);
  if (f.gender) out.push(["Gender", f.gender]);
  if (f.opposition) out.push(["Opposition", title(f.opposition)]);
  if (plan.venue) out.push(["Venue", plan.venue]);
  if (f.venueType) out.push(["Venue type", f.venueType + (f.forTeam ? ` for ${title(f.forTeam)}` : "")]);
  if (f.innings) out.push(["Innings", f.innings === "first" ? "batting first" : "chasing"]);
  if (f.teamInnings) out.push(["Test innings", f.teamInnings === 1 ? "his side's 1st" : "his side's 2nd"]);
  if (f.position) out.push(["Batting position", f.position[0] === f.position[1] ? `No. ${f.position[0]}` : `Nos ${f.position[0]}-${f.position[1]}`]);
  if (f.since || f.until) out.push(["Dates", `${f.since || "start"} → ${f.until || "latest"}`]);
  if (f.lastN) out.push(["Last N", String(f.lastN)]);
  if (plan.competition) out.push(["Competition", plan.competition.length <= 5 ? plan.competition.toUpperCase() : title(plan.competition)]);
  if (f.international != null) out.push(["Level", f.international ? "international" : "club/league"]);
  return out;
}

function freshness(store) {
  const fr = store.freshness();
  return `Newest match in the base data: ${fr.newestBase}. ${fr.provisionalIncluded
    ? `Includes ${fr.provisionalMatches} provisional (scraped) matches up to ${fr.newestProvisional}.` : "No provisional matches included."}`;
}

/** Resolve names → indices and translate the plan's filters into the engine's filter object. */
export function buildFilters(store, rz, plan, ctx = {}) {
  const f = plan.filters;
  const notes = [];
  const out = {};
  if (f.format) out.fmt = FORMATS.indexOf(f.format);
  const gender = f.gender ? (f.gender === "female" ? 1 : 0) : ctx.gender ?? null;
  if (gender != null) out.gender = gender;
  if (f.opposition) {
    const t = rz.team(f.opposition, gender);
    if (t) { out.opp = t.idx; } else notes.push(`Could not find a team called "${f.opposition}".`);
  }
  if (plan.venue) {
    const v = rz.venue(plan.venue);
    if (v) { out.venue = v.idx; plan.venue = v.name; } else notes.push(`Could not find a venue called "${plan.venue}".`);
  }
  if (f.forTeam) {
    const t = rz.team(f.forTeam, gender);
    if (t) out.team = t.idx; else notes.push(`Could not find a team called "${f.forTeam}".`);
  }
  if (f.venueType) out.venueType = f.venueType;
  if (f.innings) out.innings = f.innings;
  if (f.teamInnings) out.tinn = f.teamInnings;
  if (f.position) out.pos = f.position;
  if (f.since) out.since = f.since;
  if (f.until) out.until = f.until;
  if (f.lastN) out.lastN = f.lastN;
  if (f.international != null) out.intl = f.international ? 1 : 0;
  if (plan.competition) {
    const e = rz.event(plan.competition);
    if (e) out.event = e.idx; else notes.push(`Could not find a competition called "${plan.competition}".`);
  }
  return { filters: out, notes };
}

/** Execute a (sanitised) plan against the data. Always returns {ok, ...}; never throws for user errors. */
export async function runPlan(store, rz, rawPlan, hints = {}) {
  const plan = sanitizePlan(rawPlan);
  try {
    if (plan.kind === "player_prop") return await runPlayerProp(store, rz, plan, hints);
    if (plan.kind === "partnership") return await runPartnership(store, rz, plan, hints);
    if (plan.kind === "match_market") return runMarket(store, rz, plan, hints);
    if (plan.kind === "top_batter") return runTopBatter(store, rz, plan, hints);
  } catch (e) {
    return { ok: false, error: `Could not run that query: ${e.message}`, plan };
  }
  return { ok: false, error: "I could not tell what to look up. Try: \"Harry Brook ODI sixes over 0.5 away\", \"when Banton and Duckett open, who gets out first\", or \"IPL match sixes at Wankhede\".", plan };
}

async function runPlayerProp(store, rz, plan, hints) {
  if (!plan.player && hints.playerIdx == null) return { ok: false, error: "Which player?", plan };
  if (!plan.stat) return { ok: false, error: "Which stat (runs, balls, fours, sixes, wickets, runs conceded)?", plan };
  const fmtIdx = plan.filters.format ? FORMATS.indexOf(plan.filters.format) : null;
  const gender = plan.filters.gender ? (plan.filters.gender === "female" ? 1 : 0) : null;
  const teamHint = plan.team ? rz.team(plan.team, gender)?.idx : null;
  const who = hints.playerIdx != null ? { idx: hints.playerIdx, ambiguous: [] } : rz.player(plan.player, { gender, fmt: fmtIdx, team: teamHint });
  if (!who) return { ok: false, error: `I could not find a player called "${plan.player}".`, plan };
  const { filters, notes } = buildFilters(store, rz, plan, { gender: store.P.g[who.idx] });
  delete filters.fmt;
  const rep = await playerReport(store, who.idx, { stat: plan.stat, line: plan.line, side: plan.side, fmt: fmtIdx, filters, splits: plan.splitBy,
    scope: plan.scope, lastN: 10 });
  if (!rep.ok) return { ...rep, plan };
  const s = rep.summary;
  const side = plan.side || "over";
  const k = side === "over" ? s.over : s.under;
  const p = side === "over" ? s.pOver : s.pUnder;
  const fair = side === "over" ? s.fairOver : s.fairUnder;
  let headline;
  if (plan.line != null && s.n) {
    headline = `${rep.name} ${rep.fmtName} ${rep.statLabel.toLowerCase()} ${side} ${plan.line}: ${k} of ${s.n} ${rep.scope === "match" ? "matches" : "innings"} (${P(p)})${s.push ? `, ${s.push} push` : ""} → fair decimal price ${d2(fair)}`;
  } else {
    headline = `${rep.name} ${rep.fmtName} ${rep.statLabel.toLowerCase()}: median ${s.median ?? "n/a"}, mean ${s.mean ?? "n/a"} over ${s.n} ${rep.scope === "match" ? "matches" : "innings"}`;
  }
  const alt = who.ambiguous.map((a) => a.name);
  const allNotes = [...notes, ...rep.notes];
  if (s.n && s.n < 20) allNotes.push(`Small sample (n=${s.n}): treat the hit rate with caution.`);
  if (s.n && s.pOverLo != null) allNotes.push(`90% interval for the hit rate: ${P(s.pOverLo)} to ${P(s.pOverHi)} (fair price ${d2(s.fairOverWorst)} to ${d2(s.fairOverBest)} on the over).`);
  return {
    ok: true, kind: "player_prop", headline, title: `${rep.name}: ${rep.fmtName} ${rep.statLabel}`, player: { idx: who.idx, name: rep.name, alternatives: alt },
    sample: { n: s.n, unit: rep.scope === "match" ? "matches" : "innings" }, summary: s, ladder: rep.ladder, splits: rep.splits, last: rep.last, corr: rep.corr, chart: rep.chart ? { ...rep.chart, entries: rep.chart.entries.map((e) => ({ ...e, opp: store.teamName(e.opp, true), venueName: store.venueName(e.venue) })) } : null,
    filters: chips(store, plan, [["Player", rep.name], ["Stat", rep.statLabel], ...(plan.line != null ? [["Line", `${side} ${plan.line}`]] : [])]),
    notes: allNotes, freshness: freshness(store), plan, statLabel: rep.statLabel, fmtName: rep.fmtName,
  };
}

async function runPartnership(store, rz, plan, hints) {
  if ((!plan.player || !plan.player2) && hints.playerIdx == null) return { ok: false, error: "Name two batters, e.g. \"when Banton and Duckett open, who gets out first\".", plan };
  const gender = plan.filters.gender ? (plan.filters.gender === "female" ? 1 : 0) : null;
  const fmtIdx = plan.filters.format ? FORMATS.indexOf(plan.filters.format) : null;
  const a = hints.playerIdx != null ? { idx: hints.playerIdx, ambiguous: [] } : rz.player(plan.player, { gender, fmt: fmtIdx });
  const b = hints.player2Idx != null ? { idx: hints.player2Idx, ambiguous: [] } : rz.player(plan.player2, { gender: gender ?? (a ? store.P.g[a.idx] : null), fmt: fmtIdx, team: a ? store.P.tm[a.idx] : null });
  if (!a) return { ok: false, error: `I could not find a player called "${plan.player}".`, plan };
  if (!b) return { ok: false, error: `I could not find a player called "${plan.player2}".`, plan };
  if (a.idx === b.idx) return { ok: false, error: "Those resolve to the same player.", plan };
  const all = await store.pairRows(a.idx, b.idx);
  const { filters, notes } = buildFilters(store, rz, plan, { gender: store.P.g[a.idx] });
  const rows0 = all;
  const pf = { gender: filters.gender, opening: plan.opening, opp: filters.opp, venue: filters.venue, since: filters.since,
    until: filters.until, venueType: filters.venueType, innings: filters.innings, intl: filters.intl, event: filters.event };
  // never mix formats: pick the format with most stands that match every other filter, unless one was asked for
  let fmt = filters.fmt;
  if (fmt == null) {
    const c = FORMATS.map(() => 0);
    for (const r of filterPairs(rows0, { ...pf, fmt: null }, store)) c[r.fmt]++;
    fmt = c.indexOf(Math.max(...c));
    if (Math.max(...c) > 0) notes.push(`No format given, using ${FORMATS[fmt]} (the format where they have most such partnerships). Formats are never mixed.`);
  }
  pf.fmt = fmt;
  const rows = filterPairs(rows0, pf, store);
  // opening flag is true only when the pair opened together; non-opening stands are different markets
  const [na, nb] = [store.playerName(Math.min(a.idx, b.idx)), store.playerName(Math.max(a.idx, b.idx))];
  const sum = pairSummary(rows, na, nb);
  const labelOf = (i) => store.playerName(i);
  const splitNames = [na, nb];
  const splits = {
    opposition: splitPairs(rows, (r) => store.teamName(r.opp, true), splitNames),
    venue: splitPairs(rows, (r) => store.venueName(r.v), splitNames),
    format: [],
  };
  // formats are shown side by side but computed separately (never pooled)
  for (let f = 0; f < FORMATS.length; f++) {
    const rr = filterPairs(rows0, { ...pf, fmt: f }, store);
    if (rr.length) splits.format.push({ label: FORMATS[f], ...pairSummary(rr, na, nb) });
  }
  const verb = plan.opening ? "open together" : "bat together";
  let headline;
  if (!sum.n) headline = `No recorded ${FORMATS[fmt]} partnerships for ${labelOf(a.idx)} and ${labelOf(b.idx)} with these filters.`;
  else headline = `${na} & ${nb} ${verb} (${FORMATS[fmt]}): ${sum.n} stands. First out: ${na} ${sum.aOut}× (${P(sum.pFirstOutA)} of stands ended by a dismissal, fair price ${d2(sum.fairFirstOutA)}), ${nb} ${sum.bOut}× (${P(sum.pFirstOutB)}, fair price ${d2(sum.fairFirstOutB)})${sum.notBroken ? `; ${sum.notBroken} stand(s) ended without either being dismissed` : ""}. Median stand ${sum.medianRuns} runs.`;
  if (sum.n && sum.n < 15) notes.push(`Small sample (n=${sum.n}).`);
  let together = [];
  if (!sum.n) {
    // explain the gap honestly: list matches where both batted for the same team (provisional games carry no partnership detail)
    const [ra, rb] = await Promise.all([store.playerRows(a.idx), store.playerRows(b.idx)]);
    const key = (r) => `${r.m}:${r.t}`;
    const setB = new Set(rb.bat.map(key));
    together = ra.bat.filter((r) => setB.has(key(r))).map((r) => ({ date: r.date, fmt: FORMATS[r.fmt], pv: r.pv, opp: store.teamName(r.opp, true) }));
    const prov = together.filter((t) => t.pv);
    if (!together.length) notes.push("These two have never batted for the same team in the data, so there is nothing to measure.");
    else {
      notes.push(`They batted in the same team in ${together.length} recorded match(es) but never appear as a ball-by-ball partnership${prov.length ? `; ${prov.length} of those are provisional (scraped) matches with totals only, no batting order or fall of wickets, so who was out first cannot be derived until the base data has them` : ""}.`);
    }
  }
  if (rows0.some((r) => r.pv)) notes.push("Partnerships need ball-by-ball data, so provisional (scraped) matches are not included.");
  return {
    ok: true, kind: "partnership", headline, title: `${na} & ${nb}`, sample: { n: sum.n, unit: "partnerships" }, summary: sum, splits,
    players: [{ idx: a.idx, name: store.playerName(a.idx), alternatives: a.ambiguous.map((x) => x.name) },
      { idx: b.idx, name: store.playerName(b.idx), alternatives: b.ambiguous.map((x) => x.name) }],
    last: rows.slice(-10).reverse().map((r) => ({ date: r.date, opp: store.teamName(r.opp, true), venue: store.venueName(r.v),
      runs: r.r, balls: r.n, wicket: r.w, out: r.x === 0 ? "neither" : r.x === 1 ? na : nb })),
    filters: chips(store, { ...plan, filters: { ...plan.filters, format: FORMATS[fmt] } }, [["Pair", `${na} & ${nb}`], ...(plan.opening ? [["Stand", "opening partnership"]] : [])]),
    notes, freshness: freshness(store), plan, together,
  };
}

function marketMatches(store, rz, plan, hints = {}) {
  const gender = plan.filters.gender ? (plan.filters.gender === "female" ? 1 : 0) : null;
  const { filters, notes } = buildFilters(store, rz, plan, { gender });
  const team = hints.teamIdx != null ? { idx: hints.teamIdx } : plan.team ? rz.team(plan.team, gender) : null;
  if (hints.venueIdx != null) { filters.venue = hints.venueIdx; plan.venue = store.venueName(hints.venueIdx); }
  if (plan.team && !team) notes.push(`Could not find a team called "${plan.team}".`);
  if (team) filters.gender = store.genderOfTeam(team.idx);
  let fmt = filters.fmt;
  if (fmt == null) {
    fmt = 0;
    notes.push("No format given, using T20. Formats are never mixed; say ODI or Test to switch.");
  }
  return { f: { ...filters, fmt, team: team ? team.idx : null, opp: team ? filters.opp ?? null : null, event: filters.event }, notes, team, fmt };
}

function runMarket(store, rz, plan, hints = {}) {
  const { f, notes, team, fmt } = marketMatches(store, rz, plan, hints);
  if (!team && f.venue == null && !f.event) return { ok: false, error: "Which team, venue or competition?", plan };
  const ms = selectMatches(store, { ...f, teamFirst: false });
  const keys = plan.market ? [plan.market] : [...Object.keys(MATCH_MARKETS), ...(team ? Object.keys(TEAM_MARKETS) : [])];
  const tables = [];
  for (const key of keys) {
    const isTeam = key.startsWith("team_");
    const mm = isTeam ? selectMatches(store, { ...f, teamFirst: true }) : ms;
    const rep = marketReport(store, mm, key, plan.line);
    tables.push({ key, label: rep.label, n: rep.n, summary: rep.summary, ladder: rep.ladder });
  }
  const label = team ? store.teamName(team.idx) : f.venue != null ? store.venueName(f.venue) : plan.competition;
  const one = tables[0];
  let headline = `${label}: ${FORMATS[fmt]} match markets from ${ms.length} qualifying matches (void matches excluded).`;
  if (plan.market && plan.line != null && one.n) {
    const side = plan.side || "over";
    const p = side === "over" ? one.summary.pOver : one.summary.pUnder;
    const k = side === "over" ? one.summary.over : one.summary.under;
    headline = `${label} ${FORMATS[fmt]} ${one.label.toLowerCase()} ${side} ${plan.line}: ${k} of ${one.n} (${P(p)}) → fair decimal price ${d2(side === "over" ? one.summary.fairOver : one.summary.fairUnder)}`;
  }
  if (ms.length < 20) notes.push(`Small sample (n=${ms.length}).`);
  notes.push("Summary markets follow exchange void rules: both innings need 80% of overs (Tests: a result or 300/200 overs). Team markets use the innings of the team batting first.");
  return { ok: true, kind: "match_market", headline, title: `${label}: ${FORMATS[fmt]} markets`, sample: { n: plan.market ? one.n : ms.length, unit: "matches" }, tables,
    filters: chips(store, { ...plan, filters: { ...plan.filters, format: FORMATS[fmt] } }, [["Subject", label]]), notes, freshness: freshness(store), plan };
}

function runTopBatter(store, rz, plan, hints = {}) {
  const { f, notes, team, fmt } = marketMatches(store, rz, plan, hints);
  if (!team && f.venue == null && !f.event) return { ok: false, error: "Which team, venue or competition?", plan };
  const scope = team ? "team" : "match";
  const ms = selectMatches(store, { ...f, teamFirst: !!team });
  const t = topBatters(store, ms, { team: team ? team.idx : null, scope });
  const label = team ? store.teamName(team.idx) : f.venue != null ? store.venueName(f.venue) : plan.competition;
  notes.push(team ? "Team top batter counts the innings of the team batting first only." : "Match top batter counts the highest score in the match; ties are shown separately.");
  const top = t.rows[0];
  return { ok: true, kind: "top_batter", headline: top ? `${label} ${FORMATS[fmt]} top batter: ${top.name} ${top.sole} sole + ${top.tied} tied of ${t.n} matches (fair price ${d2(top.fairSole)})` : `No data for ${label}.`,
    title: `${label}: top batter`, sample: { n: t.n, unit: "matches" }, rows: t.rows,
    filters: chips(store, { ...plan, filters: { ...plan.filters, format: FORMATS[fmt] } }, [["Subject", label]]), notes, freshness: freshness(store), plan };
}
